import { describe, expect, it } from 'vitest'
import { groupLines, labelOf, readHeader, readLine, readReport, type Bit } from './readPdf'
import { matchPatient } from './matchPatient'
import { planFor } from './ingest'
import { PTS } from '../../store/seed'

// fixture text items, as pdf.js would give them (page 600 x 800, y is the baseline)
const b = (str: string, x: number, y: number, w = str.length * 5): Bit => ({ str, x, y, w, h: 10 })

describe('groupLines', () => {
  it('joins bits within 3 points and orders them by x', () => {
    const lines = groupLines([b('95', 250, 301.5), b('eGFR', 50, 300), b('mL/min/1.73 m²', 320, 299), b('Sodium', 50, 330)], 1, 600, 800)
    expect(lines).toHaveLength(2)
    expect(lines[0].bits.map((x) => x.str)).toEqual(['eGFR', '95', 'mL/min/1.73 m²'])
    expect(lines[1].text).toBe('Sodium')
  })
  it('keeps lines apart when they are more than 3 points away', () => {
    expect(groupLines([b('a', 10, 100), b('b', 40, 104)], 1, 600, 800)).toHaveLength(2)
  })
  it('normalises the box to 0..1 of the page', () => {
    const [l] = groupLines([b('eGFR', 60, 400, 40)], 3, 600, 800)
    expect(l.page).toBe(3)
    expect(l.bbox[0]).toBeCloseTo(0.1, 2)
    expect(l.bbox[2]).toBeCloseTo(40 / 600, 2)
    expect(l.bbox[1]).toBeGreaterThan(0.48)
    expect(l.bbox[1] + l.bbox[3]).toBeLessThan(0.52)
  })
})

describe('labels', () => {
  it('finds each test', () => {
    expect(labelOf('eGFR (CKD-EPI 2021)  95')?.kind).toBe('egfr')
    expect(labelOf('Estimated GFR  60')?.kind).toBe('egfr')
    expect(labelOf('Albumin/Creatinine ratio  9')?.kind).toBe('uacr')
    expect(labelOf('Microalbumin/Creatinine  9')?.kind).toBe('uacr')
    expect(labelOf('UACR  9')?.kind).toBe('uacr')
    expect(labelOf('Creatinine (serum)  0.75')?.kind).toBe('creat')
  })
  it('does not take urine creatinine or the ratio for blood creatinine', () => {
    expect(labelOf('Urine creatinine  78.0')).toBeUndefined()
    expect(labelOf('Sodium  139')).toBeUndefined()
  })
})

const line = (...bits: Bit[]) => groupLines(bits, 2, 600, 800)[0]
describe('readLine', () => {
  it('takes the first number to the right of the label, then the unit', () => {
    const h = readLine(line(b('eGFR (CKD-EPI 2021)', 50, 300), b('95', 250, 300), b('mL/min/1.73 m²', 320, 300), b('>90', 450, 300)))!
    expect(h).toMatchObject({ kind: 'egfr', v: 95, printedUnit: 'mL/min/1.73 m²', page: 2 })
  })
  it('does not take the 2021 in the label as the value', () => {
    expect(readLine(line(b('eGFR (CKD-EPI 2021)', 50, 300), b('71', 250, 300), b('mL/min', 320, 300)))!.v).toBe(71)
  })
  it('reads a number and unit that share one item', () => {
    expect(readLine(line(b('UACR', 50, 300), b('9 mg/g', 250, 300)))).toMatchObject({ v: 9, printedUnit: 'mg/g' })
  })
  it('reads the unit-first layout', () => {
    const h = readLine(line(b('mL/min', 50, 300), b('eGFR (CKD-EPI 2021)', 150, 300), b('55', 340, 300), b('[>90]', 410, 300)))!
    expect(h).toMatchObject({ v: 55, printedUnit: 'mL/min' })
  })
  it('returns nothing for a line with a label but no number', () => {
    expect(readLine(line(b('eGFR', 50, 300), b('pending', 250, 300)))).toBeUndefined()
  })
})

const head = (...rows: Bit[][]) => groupLines(rows.flat(), 1, 600, 800)
describe('header', () => {
  it('reads dates, name, age, sex and id', () => {
    const lines = head(
      [b('Lab A · Sample Pathology Pvt Ltd', 50, 790), b('Collected', 400, 778), b('17 Dec 2025', 470, 778)],
      [b('Reported', 400, 766), b('18 Dec 2025', 470, 766)],
      [b('Patient: Kabita Banerjee', 50, 740), b('Age / Sex: 52 / F', 250, 740), b('ID: P-0533', 400, 740)],
    )
    expect(readHeader(lines)).toMatchObject({ lab: 'A', date: '2025-12-18', name: 'Kabita Banerjee', age: 52, sex: 'F', id: 'P-0533' })
  })
  it('falls back to the collected date, and leaves missing facts empty', () => {
    const r = readHeader(head([b('Collected', 400, 778), b('17 Dec 2025', 470, 778)], [b('Patient: R. Das', 50, 740), b('Age / Sex: not printed', 250, 740), b('ID: not printed', 400, 740)]))
    expect(r.date).toBe('2025-12-17')
    expect(r).toMatchObject({ name: 'R. Das' })
    expect(r.age).toBeUndefined()
    expect(r.id).toBeUndefined()
  })
})

// a whole small report, then the outcome
const report = (name: string, ageSex: string, id: string, egfr: string, unit: string) => [
  head(
    [b('Reported', 400, 766), b('18 Dec 2025', 470, 766)],
    [b(`Patient: ${name}`, 50, 740), b(`Age / Sex: ${ageSex}`, 250, 740), b(`ID: ${id}`, 400, 740)],
    [b('eGFR (CKD-EPI 2021)', 50, 600), b(egfr, 250, 600), b(unit, 320, 600)],
    [b('Albumin/Creatinine ratio', 50, 500), b('9', 250, 500), b('mg/g', 320, 500)],
    [b('Creatinine (serum)', 50, 400), b('0.75', 250, 400), b('mg/dL', 320, 400)],
  ),
]
const base = { id: 'D-UP-x', name: 'x.pdf', mime: 'application/pdf', file: new Blob([]), pages: 1, hash: 'x', text: [] }
const plan = (r: ReturnType<typeof readReport>) => planFor(r, base, PTS, [])

describe('outcome', () => {
  it('exact ID: saved', () => {
    const p = plan(readReport(report('Kabita Banerjee', '52 / F', 'P-0533', '95', 'mL/min/1.73 m²')))
    expect(p).toMatchObject({ how: 'clean', pid: 'P-0533' })
  })
  it('full name with age and sex: saved', () => {
    expect(plan(readReport(report('Kabita Banerjee', '52 / F', 'not printed', '95', 'mL/min/1.73 m²')))).toMatchObject({ how: 'clean', pid: 'P-0533' })
  })
  it('name only, two patients: goes to check with both listed', () => {
    const p = plan(readReport(report('R. Das', 'not printed', 'not printed', '71', 'mL/min/1.73 m²')))
    expect(p.how).toBe('ambiguous')
    expect(p.cands?.map((c) => c.pid).sort()).toEqual(['P-0288', 'P-0299'])
  })
  it('the ID points at one patient but the name is another: a person decides', () => {
    expect(plan(readReport(report('Arif Khan', '47 / M', 'P-0533', '95', 'mL/min/1.73 m²'))).how).toBe('ambiguous')
  })
  it('mL/min is refused', () => {
    const p = plan(readReport(report('Mohan Roy', '71 / M', 'P-0061', '55', 'mL/min')))
    expect(p.how).toBe('unit')
    expect(p.reason).toContain('55 mL/min')
  })
  it('a page with no matching label is never guessed', () => {
    const p = plan(readReport([head([b('Reported', 400, 766), b('18 Dec 2025', 470, 766)], [b('Patient: Mohan Roy', 50, 740)], [b('Sodium', 50, 600), b('139', 250, 600)])]))
    expect(p).toMatchObject({ how: 'unread', reason: 'Could not read kidney results from this file' })
  })
  it('the same file twice is not saved twice', () => {
    expect(planFor(readReport(report('Kabita Banerjee', '52 / F', 'P-0533', '95', 'mL/min/1.73 m²')), base, PTS, ['D-UP-x']).how).toBe('dup')
  })
})

describe('matchPatient', () => {
  it('an initial is never a full name', () => {
    expect(matchPatient({ hits: {}, name: 'R. Das', age: 63, sex: 'M' }, PTS).how).toBe('weak')
  })
})
