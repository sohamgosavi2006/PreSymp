// Pure word handling for the photo reader: no DOM, no tesseract. Tested in node.
// Turns tesseract words into the same line shape pdf.js gives, so one parser reads both.
import { groupLines, type Bit, type PageLine } from '../intake/readPdf'
import type { Hit, Read } from '../../store/types'

// one word from tesseract, in pixels of the image it read. conf is 0 to 100
export type OcrWord = { text: string; conf: number; x0: number; y0: number; x1: number; y1: number }
// a word inside a cell, with the correction flag so confidence stays honest
export type CellWord = { text: string; conf: number; fixed?: boolean; box: [number, number, number, number] } // box: x0, y0, x1, y1 in image pixels
// a piece of a line (one table cell or phrase), in the Bit shape plus the words it came from
export type OcrBit = Bit & { conf: number; words: CellWord[] }

const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const meanConf = (words: { conf: number }[]) => (words.length ? words.reduce((t, w) => t + w.conf, 0) / words.length : 0)

// Fix the letters tesseract mixes up with digits, but only inside a token that is otherwise digits
// (or an ID like P-0932), and only the three unambiguous pairs: O to 0, l and I to 1, S to 5.
const SUB: Record<string, string> = { O: '0', o: '0', l: '1', I: '1', S: '5' }
export function fixNumeric(text: string): { text: string; changed: boolean } {
  const t = text.trim()
  const swap = (s: string) => s.replace(/[OolIS]/g, (c) => SUB[c])
  const digits = (s: string) => (s.match(/\d/g) ?? []).length
  // a plain number: 12.4  1O.4  l.4
  if (/^[0-9OolIS]+(?:\.[0-9OolIS]+)?$/.test(t) && t.length <= 8 && digits(t) >= 1 && digits(t) * 2 >= t.replace('.', '').length) {
    const out = swap(t)
    return { text: out, changed: out !== t }
  }
  // an ID: P-0932  P-O932  UHID values like KB-1O42
  const id = /^([A-Z]{1,4}-?)([0-9OolIS]{2,6})$/.exec(t)
  if (id && digits(id[2]) >= 1 && digits(id[2]) * 2 >= id[2].length) {
    const out = id[1] + swap(id[2])
    return { text: out, changed: out !== t }
  }
  return { text: text, changed: false }
}

// each word fixed where it can be; a fixed word gives up some confidence
export function fixWords(words: OcrWord[]): { text: string; conf: number; fixed: boolean; w: OcrWord }[] {
  return words.map((w) => {
    const f = fixNumeric(w.text)
    return { text: f.text, conf: f.changed ? w.conf * 0.9 : w.conf, fixed: f.changed, w }
  })
}

// The superscript in "m²" is often read as m?, m2 or mz. After "mL/min/1.73" there is only one thing it can be.
// The fix is flagged, so the confidence goes down with it.
export function fixUnitCell<T extends { text: string; conf: number; fixed?: boolean }>(cell: T[]): void {
  for (let i = 0; i + 1 < cell.length; i++) {
    if (!/^mL\/min\/1[.,]73$/i.test(cell[i].text)) continue
    const n = cell[i + 1]
    if (n.text !== 'm²' && /^m(?:[^A-Za-z0-9\s]|[2²zZ]|\^2)?$/.test(n.text)) {
      n.text = 'm²'
      n.fixed = true
      n.conf *= 0.9
    }
  }
}

// words closer than this (in word heights) belong to the same cell, like words in one pdf.js text item
export const CELL_GAP = 0.8

// Words to cells to Bits. Rows are found by word centres, cells by the gap between words.
export function wordsToBits(words: OcrWord[]): { bits: OcrBit[]; tol: number } {
  const ok = words.filter((w) => w.text.trim() !== '' && w.x1 > w.x0 && w.y1 > w.y0)
  if (!ok.length) return { bits: [], tol: 0 }
  const hm = median(ok.map((w) => w.y1 - w.y0)) || 10
  const fixed = fixWords(ok)
  const cy = (w: OcrWord) => (w.y0 + w.y1) / 2
  const order = fixed.map((f, i) => i).sort((a, b) => cy(fixed[a].w) - cy(fixed[b].w))
  // rows by centre height
  const rows: number[][] = []
  for (const i of order) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(cy(fixed[i].w) - cy(fixed[row[0]].w)) <= hm * 0.6) row.push(i)
    else rows.push([i])
  }
  const bits: OcrBit[] = []
  for (const row of rows) {
    const inRow = row.map((i) => fixed[i]).sort((a, b) => a.w.x0 - b.w.x0)
    let cell: typeof inRow = []
    const flush = () => {
      if (!cell.length) return
      fixUnitCell(cell)
      const x0 = Math.min(...cell.map((c) => c.w.x0))
      const x1 = Math.max(...cell.map((c) => c.w.x1))
      const y0 = Math.min(...cell.map((c) => c.w.y0))
      const y1 = Math.max(...cell.map((c) => c.w.y1))
      const h = y1 - y0
      const wordsIn: CellWord[] = cell.map((c) => ({ text: c.text, conf: c.conf, fixed: c.fixed || undefined, box: [c.w.x0, c.w.y0, c.w.x1, c.w.y1] }))
      // y is the baseline: the middle of the cell plus a share of its height, the same for every cell
      bits.push({ str: cell.map((c) => c.text).join(' '), x: x0, y: (y0 + y1) / 2 + h * 0.35, w: x1 - x0, h, conf: meanConf(wordsIn), words: wordsIn })
      cell = []
    }
    for (const f of inRow) {
      const last = cell[cell.length - 1]
      if (last) {
        const gap = f.w.x0 - last.w.x1
        const h = Math.max(last.w.y1 - last.w.y0, f.w.y1 - f.w.y0, hm)
        if (gap > h * CELL_GAP) flush()
      }
      cell.push(f)
    }
    flush()
  }
  return { bits, tol: hm * 0.7 }
}

// words to lines for one page image of w x h pixels
export function linesFromWords(words: OcrWord[], page: number, w: number, h: number): PageLine[] {
  const { bits, tol } = wordsToBits(words)
  return groupLines(bits, page, w, h, tol)
}

const NUM = /^[\s):]*(-?\d+(?:\.\d+)?)\s*(.*)$/

// Give every hit its confidence: the mean of the value word and the unit word, 0 to 1.
// A hit that cannot be matched back to its words gets 0, so it goes to To check.
export function attachConf(read: Read, pages: PageLine[][]): Read {
  const hits: Read['hits'] = {}
  for (const k of Object.keys(read.hits) as (keyof Read['hits'])[]) {
    const h = read.hits[k]
    if (h) hits[k] = { ...h, conf: hitConf(h, pages[h.page - 1] ?? []) }
  }
  return { ...read, hits }
}

// the words behind a hit: the value word and the unit words
export function locate(h: Hit, lines: PageLine[]): { value: CellWord; unit: CellWord[] } | undefined {
  const line = lines.find((l) => l.text === h.line)
  if (!line) return
  const bits = line.bits as OcrBit[]
  const unit = h.printedUnit.trim()
  for (let i = 0; i < bits.length; i++) {
    const m = NUM.exec(bits[i].str.trim())
    if (!m || Number(m[1]) !== h.v || !bits[i].words) continue
    const ws = bits[i].words
    const at = ws.findIndex((w) => NUM.test(w.text) && Number(NUM.exec(w.text)![1]) === h.v)
    if (at < 0) continue
    let unitWords: CellWord[] = []
    if (m[2].trim() !== '' && m[2].trim() === unit) unitWords = ws.slice(at + 1) // value and unit in one cell
    else {
      const ub = bits.slice(i + 1).find((b) => b.str.trim() === unit) ?? bits.find((b) => b.str.trim() === unit)
      if (ub) unitWords = ub.words
    }
    return { value: ws[at], unit: unitWords }
  }
}

export function hitConf(h: Hit, lines: PageLine[]): number {
  const at = locate(h, lines)
  if (!at || !at.unit.length) return 0 // no value word or no unit word: nothing to be sure about
  return Math.min(1, Math.max(0, (at.value.conf + meanConf(at.unit)) / 2 / 100))
}

// the first number in a second reading of the value cell on its own
export function firstNumber(text: string): number | undefined {
  const m = /\d+(?:\.\d+)?/.exec(text)
  return m ? Number(m[0]) : undefined
}

// A second, close-up reading of the value. If it does not give the same number, the first reading is
// not to be trusted (a dropped decimal point is the usual slip): the confidence falls to this cap.
export const DISAGREE_CAP = 0.5
export function checkedConf(conf: number, first: number, second: number | undefined): number {
  return second !== undefined && second === first ? conf : Math.min(conf, DISAGREE_CAP)
}
