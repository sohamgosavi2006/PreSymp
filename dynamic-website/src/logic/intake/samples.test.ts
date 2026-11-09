import { describe, expect, it } from 'vitest'
import { groupLines, readReport, type Bit, type PageLine } from './readPdf'
import { buildObs, planFor } from './ingest'
import { PTS } from '../../store/seed'
import fixtures from './fixtures/samples.json'

// Real pdf.js text items from the three printed samples in public/samples (the pages that hold the kidney results)
type Fx = Record<string, { page: number; vw: number; vh: number; bits: [string, number, number, number, number][] }[]>
const pagesOf = (file: string): PageLine[][] =>
  (fixtures as unknown as Fx)[file].map((p) => groupLines(p.bits.map(([str, x, y, w, h]): Bit => ({ str, x, y, w, h })), p.page, p.vw, p.vh))
const base = { id: 'D-UP-s', name: 's.pdf', mime: 'application/pdf', file: new Blob([]), pages: 5, hash: 's', text: [] }

describe('sample 1: kabita-banerjee-text.pdf (wrapped cells, year under the date)', () => {
  const read = readReport(pagesOf('kabita-banerjee-text.pdf'))
  it('reads the header', () => {
    expect(read).toMatchObject({ lab: 'A', date: '2025-12-18', name: 'Kabita Banerjee', age: 52, sex: 'F', id: 'P-0533' })
  })
  it('reads the three results, the unit that wrapped, and the equation', () => {
    expect(read.hits.egfr).toMatchObject({ v: 95, printedUnit: 'mL/min/1.73 m²', page: 1, equation: 'CKD-EPI 2021' })
    expect(read.hits.uacr).toMatchObject({ v: 9, printedUnit: 'mg/g', page: 4 })
    expect(read.hits.creat).toMatchObject({ v: 0.75, printedUnit: 'mg/dL', page: 1 })
  })
  it('puts the box on the row, as a share of the page', () => {
    const [x, y, w, h] = read.hits.egfr!.bbox
    expect(x).toBeGreaterThan(0.2)
    expect(x + w).toBeLessThan(0.7)
    expect(y).toBeGreaterThan(0.69)
    expect(y + h).toBeLessThan(0.76)
  })
  it('is saved to P-0533 by ID, with the equation on the source', () => {
    const p = planFor(read, base, PTS, [], [])
    expect(p).toMatchObject({ how: 'clean', pid: 'P-0533', on: 'ID' })
    const obs = buildObs(read, 'P-0533', 'D-UP-s', '2025-12-18')
    expect(obs.map((o) => [o.kind, o.v, o.u])).toEqual([['egfr', 95, 'mL/min/1.73 m²'], ['uacr', 9, 'mg/g'], ['creat', 0.75, 'mg/dL']])
    expect(obs[0].source).toMatchObject({ via: 'text', page: 1, equation: 'CKD-EPI 2021' })
  })
})

describe('sample 2: r-das-text.pdf (name only)', () => {
  const read = readReport(pagesOf('r-das-text.pdf'))
  it('reads the name and no age, sex or ID', () => {
    expect(read).toMatchObject({ name: 'R. Das', date: '2025-12-18' })
    expect(read.age).toBeUndefined()
    expect(read.id).toBeUndefined()
    expect(read.hits.egfr?.v).toBe(71)
    expect(read.hits.uacr?.v).toBe(78)
  })
  it('goes to check with both patients and a reason for each', () => {
    const p = planFor(read, base, PTS, [], [])
    expect(p.how).toBe('ambiguous')
    expect(p.cands?.map((c) => c.pid).sort()).toEqual(['P-0288', 'P-0299'])
    expect(p.cands?.find((c) => c.pid === 'P-0288')?.why).toBe('Same surname, age not on report')
  })
})

describe('sample 3: m-roy-wrong-unit.pdf (unit first, name over six lines)', () => {
  const read = readReport(pagesOf('m-roy-wrong-unit.pdf'))
  it('reads the header and the numbers with their own units', () => {
    expect(read).toMatchObject({ lab: 'B', date: '2025-12-18', name: 'Mohan Roy', age: 71, sex: 'M', id: 'P-0061' })
    expect(read.hits.egfr).toMatchObject({ v: 55, printedUnit: 'mL/min', equation: 'CKD-EPI 2021' })
    expect(read.hits.uacr).toMatchObject({ v: 24, printedUnit: 'mg/g', page: 2 })
    expect(read.hits.creat).toMatchObject({ v: 106, printedUnit: 'μmol/L' })
  })
  it('is refused for the eGFR unit and the creatinine is not lost', () => {
    const p = planFor(read, base, PTS, [], [])
    expect(p).toMatchObject({ how: 'unit', pid: 'P-0061' })
    expect(p.reason).toContain('55 mL/min')
  })
})
