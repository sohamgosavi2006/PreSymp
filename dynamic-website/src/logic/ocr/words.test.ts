import { describe, expect, it } from 'vitest'
import { readReport } from '../intake/readPdf'
import { attachConf, checkedConf, firstNumber, fixNumeric, fixUnitCell, hitConf, linesFromWords, meanConf, wordsToBits, type OcrWord } from './words'

// a word on a straight page: 24 px tall, 13 px per letter
const H = 24
const w = (text: string, x: number, y: number, conf = 92): OcrWord => ({ text, conf, x0: x, y0: y, x1: x + text.length * 13, y1: y + H })

// a small lab page, straight, in pixels of a 1000 x 1400 picture
function straight(overrides: Record<string, string> = {}): OcrWord[] {
  const o = (k: string, d: string) => overrides[k] ?? d
  return [
    w('Collected', 700, 60), w('18', 840, 60), w('Dec', 880, 60), w('2025', 910, 60),
    w('Reported', 700, 100), w('18', 840, 100), w('Dec', 880, 100), w('2025', 910, 100),
    w('Patient:', 60, 160), w('Arif', 180, 160), w('Khan', 240, 160),
    w('Age', 330, 160), w('/', 380, 160), w('Sex:', 400, 160), w('47', 460, 160), w('/', 500, 160), w('M', 520, 160),
    w('ID:', 580, 160), w('P-0932', 630, 160),
    w('Creatinine', 60, 400), w('(blood)', 200, 400), w('0.92', 560, 400, 95), w('mg/dL', 700, 400, 95), w('0.60-1.10', 860, 400),
    w('Blood', 60, 460), w('test', 135, 460), w('(eGFR)', 190, 460), w('·', 270, 460), w('CKD-EPI', 290, 460), w('2021', 380, 460),
    w('93', 560, 460, 90), w('mL/min/1.73', 700, 460, 81), w('m?', 835, 460, 91), w('≥90', 900, 460),
    w('Albumin/Creatinine', 60, 800), w('ratio', 310, 800),
    w(o('uacr', '1.4'), 560, 800, 92), w('mg/mmol', 700, 800, 90), w('<30', 860, 800),
  ]
}

// tilt the word boxes by `deg` about the picture centre (what a camera does), then turn them back (what we do)
function tiltThenStraighten(words: OcrWord[], deg: number, jitter = 0): OcrWord[] {
  const cx = 500
  const cy = 700
  const rot = (x: number, y: number, d: number): [number, number] => {
    const t = (d * Math.PI) / 180
    return [cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t), cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t)]
  }
  return words.map((q, i) => {
    const [mx, my] = rot((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, deg)
    const [sx, sy] = rot(mx, my, -deg)
    const j = jitter ? ((i * 7) % 5) - 2 : 0 // up to 2 px of reading noise
    const hw = (q.x1 - q.x0) / 2
    return { ...q, x0: sx - hw, x1: sx + hw, y0: sy - H / 2 + j, y1: sy + H / 2 + j }
  })
}

describe('numeric fix-ups', () => {
  it('fixes O, l, I and S only inside a token that is otherwise digits', () => {
    expect(fixNumeric('1O.4')).toEqual({ text: '10.4', changed: true })
    expect(fixNumeric('l.4')).toEqual({ text: '1.4', changed: true })
    expect(fixNumeric('9S')).toEqual({ text: '95', changed: true })
    expect(fixNumeric('I05')).toEqual({ text: '105', changed: true })
  })
  it('leaves real words, units and plain numbers alone', () => {
    for (const t of ['Sodium', 'mg/dL', 'mmol/L', 'OIS', 'Lab', 'Glucose,', '12.4', '93', 'IS', 'SOS'])
      expect(fixNumeric(t).changed, t).toBe(false)
  })
  it('fixes an ID, but not a word that looks a bit like one', () => {
    expect(fixNumeric('P-O932')).toEqual({ text: 'P-0932', changed: true })
    expect(fixNumeric('KB-1O42').text).toBe('KB-1042')
    expect(fixNumeric('Page').changed).toBe(false)
  })
  it('turns m? after mL/min/1.73 into the m² it must be, and lowers the confidence', () => {
    const cell = [{ text: 'mL/min/1.73', conf: 80 }, { text: 'm?', conf: 90, fixed: undefined as boolean | undefined }]
    fixUnitCell(cell)
    expect(cell[1].text).toBe('m²')
    expect(cell[1].conf).toBeCloseTo(81)
    expect(cell[1].fixed).toBe(true)
  })
  it('does not touch an m that follows anything else', () => {
    const cell = [{ text: 'mg/dL', conf: 80 }, { text: 'm?', conf: 90 }]
    fixUnitCell(cell)
    expect(cell[1].text).toBe('m?')
  })
})

describe('confidence', () => {
  it('is the mean of the words', () => {
    expect(meanConf([{ conf: 90 }, { conf: 80 }])).toBe(85)
    expect(meanConf([])).toBe(0)
  })
  it('a close-up that repeats the number keeps the confidence; one that does not caps it', () => {
    expect(checkedConf(0.9, 1.4, 1.4)).toBe(0.9)
    expect(checkedConf(0.9, 1.4, 14)).toBe(0.5)
    expect(checkedConf(0.9, 1.4, undefined)).toBe(0.5)
    expect(checkedConf(0.3, 1.4, 14)).toBe(0.3)
  })
  it('reads the first number of a close-up', () => {
    expect(firstNumber(' 1.4 ')).toBe(1.4)
    expect(firstNumber('')).toBeUndefined()
  })
})

describe('words to lines', () => {
  it('joins words of one cell and keeps table columns apart', () => {
    const { bits } = wordsToBits(straight())
    const y = bits.find((x) => x.str.startsWith('Albumin'))!.y
    const row = bits.filter((b) => Math.abs(b.y - y) < 12)
    expect(row.map((b) => b.str)).toEqual(['Albumin/Creatinine ratio', '1.4', 'mg/mmol', '<30'])
  })
  it('groups a tilted-then-straightened page into the same rows', () => {
    const lines = linesFromWords(tiltThenStraighten(straight(), 3, 1), 1, 1000, 1400)
    const texts = lines.map((l) => l.text)
    expect(texts).toContain('Creatinine (blood)  0.92  mg/dL  0.60-1.10')
    expect(texts.some((t) => t.startsWith('Patient:'))).toBe(true)
    expect(lines).toHaveLength(6)
  })
  it('normalises each line box to the picture and keeps it inside', () => {
    for (const l of linesFromWords(straight(), 2, 1000, 1400)) {
      expect(l.page).toBe(2)
      expect(l.bbox[0]).toBeGreaterThanOrEqual(0)
      expect(l.bbox[1] + l.bbox[3]).toBeLessThanOrEqual(1)
      expect(l.bbox[2]).toBeGreaterThan(0)
    }
    const al = linesFromWords(straight(), 1, 1000, 1400).find((l) => l.text.startsWith('Albumin'))!
    expect(al.bbox[1]).toBeCloseTo(800 / 1400, 1)
  })
})

describe('reading a photo like a pdf', () => {
  const read = (words: OcrWord[]) => {
    const pages = [linesFromWords(words, 1, 1000, 1400)]
    return attachConf(readReport(pages), pages)
  }
  it('finds the header and the three kidney lines', () => {
    const r = read(tiltThenStraighten(straight(), 3, 1))
    expect(r.id).toBe('P-0932')
    expect(r.name).toBe('Arif Khan')
    expect(r.age).toBe(47)
    expect(r.hits.creat?.v).toBe(0.92)
    expect(r.hits.egfr?.v).toBe(93)
    expect(r.hits.uacr?.v).toBe(1.4)
    expect(r.hits.uacr?.printedUnit).toBe('mg/mmol')
    expect(r.hits.egfr?.printedUnit).toBe('mL/min/1.73 m²')
  })
  it('conf is the mean of the value word and the unit word', () => {
    const r = read(straight())
    expect(r.hits.uacr?.conf).toBeCloseTo((92 + 90) / 2 / 100, 3)
    expect(r.hits.creat?.conf).toBeCloseTo(0.95, 3)
    // the unit cell is mL/min/1.73 (81) and m² (91 lowered by the fix to 81.9)
    expect(r.hits.egfr?.conf).toBeCloseTo((90 + (81 + 81.9) / 2) / 2 / 100, 3)
  })
  it('a corrected digit gives up some confidence', () => {
    const r = read(straight({ uacr: '1O.4' }))
    expect(r.hits.uacr?.v).toBe(10.4)
    expect(r.hits.uacr?.conf).toBeCloseTo((92 * 0.9 + 90) / 2 / 100, 3)
  })
  it('a hit with no unit word has no confidence', () => {
    const pages = [linesFromWords(straight(), 1, 1000, 1400)]
    const h = readReport(pages).hits.uacr!
    expect(hitConf({ ...h, printedUnit: 'not on the page' }, pages[0])).toBe(0)
  })
})
