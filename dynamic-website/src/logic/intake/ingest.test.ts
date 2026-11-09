import { describe, expect, it } from 'vitest'
import { buildObs, checkRead, planFor } from './ingest'
import { PTS } from '../../store/seed'
import { UNREAD } from './types'
import type { Hit, Obs, Read } from '../../store/types'
import type { Kind } from '../units'

const base = { id: 'D-UP-x', name: 'x.pdf', mime: 'application/pdf', file: new Blob([]), pages: 1, hash: 'x', text: [] }
const hit = (kind: Kind, v: number, printedUnit: string, conf?: number): Hit => ({
  kind, v, printedUnit, page: 1, bbox: [0.1, 0.2, 0.5, 0.02], line: `${kind} ${v} ${printedUnit}`, ...(conf !== undefined ? { conf } : {}),
})
// a Kabita Banerjee report, matched by ID, with parts swapped in
const rd = (o: { egfr?: Hit; uacr?: Hit; creat?: Hit | null; head?: Partial<Read> } = {}): Read => ({
  name: 'Kabita Banerjee', age: 52, sex: 'F', id: 'P-0533', date: '2025-12-18', ...o.head,
  hits: {
    egfr: o.egfr ?? hit('egfr', 95, 'mL/min/1.73 m²'),
    uacr: o.uacr ?? hit('uacr', 9, 'mg/g'),
    ...(o.creat === null ? {} : { creat: o.creat ?? hit('creat', 0.75, 'mg/dL') }),
  },
})
const plan = (r: Read, known: string[] = [], obs: Obs[] = []) => planFor(r, base, PTS, known, obs)

describe('reading gate', () => {
  it('a clean text read has no confidence and is saved', () => {
    expect(plan(rd())).toMatchObject({ how: 'clean', pid: 'P-0533' })
  })
  it('a hit under 80% is not saved: how sure, and the lowest one is reported', () => {
    const p = plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.91), uacr: hit('uacr', 9, 'mg/g', 0.72) }))
    expect(p).toMatchObject({ how: 'check', conf: 0.72, reason: 'How sure: 72%. A person needs to check these numbers.' })
    expect(p.stages).toEqual(['Report came in', 'Report read', 'Numbers read · unit is right ✓'])
    expect(p.last).toBe('Staff check it')
  })
  it('80% is enough, 79% is not', () => {
    expect(plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.8) })).how).toBe('clean')
    expect(plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.79) })).how).toBe('check')
  })
  it('creatinine counts too', () => {
    expect(plan(rd({ creat: hit('creat', 0.75, 'mg/dL', 0.5) })).how).toBe('check')
  })
  it('a missing unit is not saved and is not refused as a wrong unit', () => {
    const p = plan(rd({ egfr: hit('egfr', 95, '') }))
    expect(p).toMatchObject({ how: 'check', reason: 'No unit printed next to the eGFR.' })
    expect(p.stages[2]).toBe('Numbers read · no unit ✗')
    expect(plan(rd({ uacr: hit('uacr', 9, '  ') })).reason).toBe('No unit printed next to the UACR.')
    expect(plan(rd({ creat: hit('creat', 0.75, '') })).reason).toBe('No unit printed next to the creatinine.')
  })
  it('a value outside its range is not saved', () => {
    expect(plan(rd({ egfr: hit('egfr', 950, 'mL/min/1.73 m²') }))).toMatchObject({ how: 'check', reason: 'The eGFR value 950 is outside 1 to 200.' })
    expect(plan(rd({ uacr: hit('uacr', 6000, 'mg/g') })).reason).toBe('The UACR value 6000 is outside 0 to 5000.')
    expect(plan(rd({ creat: hit('creat', 25, 'mg/dL') })).reason).toBe('The creatinine value 25 is outside 0.1 to 20.')
  })
  it('the limits are inclusive', () => {
    expect(plan(rd({ egfr: hit('egfr', 200, 'mL/min/1.73 m²') })).how).toBe('clean')
    expect(plan(rd({ egfr: hit('egfr', 1, 'mL/min/1.73 m²') })).how).toBe('clean')
    expect(plan(rd({ egfr: hit('egfr', 0, 'mL/min/1.73 m²') })).how).toBe('check')
    expect(plan(rd({ uacr: hit('uacr', 0, 'mg/g') })).how).toBe('clean')
    expect(plan(rd({ creat: hit('creat', 0.1, 'mg/dL') })).how).toBe('clean')
  })
  it('the range is checked after the unit is converted', () => {
    expect(plan(rd({ creat: hit('creat', 106, 'µmol/L') })).how).toBe('clean')
    expect(plan(rd({ uacr: hit('uacr', 1.4, 'mg/mmol') })).how).toBe('clean')
    expect(plan(rd({ uacr: hit('uacr', 600, 'mg/mmol') })).reason).toBe('The UACR value 5304 is outside 0 to 5000.')
  })
  it('says everything that is wrong, in one reason', () => {
    const p = plan(rd({ egfr: hit('egfr', 950, '', 0.6) }))
    expect(p.reason).toContain('How sure: 60%')
    expect(p.reason).toContain('No unit printed next to the eGFR.')
    expect(p.reason).toContain('outside 1 to 200')
  })
  it('creatinine is optional', () => {
    expect(plan(rd({ creat: null })).how).toBe('clean')
  })
})

describe('precedence', () => {
  it('unread beats everything', () => {
    const r = rd({ egfr: hit('egfr', 55, 'mL/min', 0.1), head: { date: undefined } })
    expect(plan(r)).toMatchObject({ how: 'unread', reason: UNREAD })
    const noUacr = { ...rd(), hits: { egfr: hit('egfr', 55, 'mL/min') } } as Read
    expect(plan(noUacr).how).toBe('unread')
  })
  it('a wrong unit beats a low reading and a doubtful patient', () => {
    const p = plan(rd({ egfr: hit('egfr', 55, 'mL/min', 0.3), head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } }))
    expect(p.how).toBe('unit')
    expect(p.reason).toContain('55 mL/min')
    expect(p.last).toBe('Sent to check list')
  })
  it('a doubtful reading beats a doubtful patient', () => {
    expect(plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.5), head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } })).how).toBe('check')
  })
  it('a doubtful patient beats an already saved file', () => {
    const r = rd({ head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } })
    expect(plan(r).how).toBe('ambiguous')
  })
  it('a file already in the app is a duplicate before anything is read', () => {
    expect(plan(rd({ egfr: hit('egfr', 55, 'mL/min') }), ['D-UP-x'])).toMatchObject({ how: 'dup', reason: 'This report is already in the app.' })
  })
})

describe('check keeps what a person needs', () => {
  it('a sure patient is kept, a doubtful one is listed', () => {
    expect(plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.5) }))).toMatchObject({ how: 'check', pid: 'P-0533' })
    const p = plan(rd({ egfr: hit('egfr', 95, 'mL/min/1.73 m²', 0.5), head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } }))
    expect(p.pid).toBeUndefined()
    expect(p.cands?.map((c) => c.pid).sort()).toEqual(['P-0288', 'P-0299'])
  })
})

describe('patient not sure', () => {
  it('lists the patients with a reason each, and stops after the unit stage', () => {
    const p = plan(rd({ head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } }))
    expect(p).toMatchObject({ how: 'ambiguous', last: 'Staff check it' })
    expect(p.cands?.every((c) => typeof c.why === 'string' && c.why.length > 0)).toBe(true)
    expect(p.stages).toEqual(['Report came in', 'Report read', 'Numbers read · unit is right ✓', 'Not sure: 2 possible patients'])
  })
})

describe('already saved', () => {
  const have = (kind: Kind, v: number, d = '2025-12-18', pid = 'P-0533'): Obs => ({
    id: `${pid}-${d}-${kind}`, pid, kind, v, u: '', d, source: { docId: 'D-1', page: 1, bbox: [0, 0, 0, 0], via: 'text' },
  })
  const all = [have('egfr', 95), have('uacr', 9), have('creat', 0.75)]
  it('same patient, date and values: nothing is added twice', () => {
    const p = plan(rd(), [], all)
    expect(p).toMatchObject({ how: 'dup', pid: 'P-0533', reason: 'Already saved. Nothing was added twice.' })
  })
  it('compares the stored value, so a converted number is a duplicate too', () => {
    const p = plan(rd({ creat: hit('creat', 106, 'µmol/L') }), [], [have('egfr', 95), have('uacr', 9), have('creat', 1.2)])
    expect(p.how).toBe('dup')
  })
  it('one value that differs makes it a new report', () => {
    expect(plan(rd(), [], [have('egfr', 95), have('uacr', 10), have('creat', 0.75)]).how).toBe('clean')
  })
  it('another date or another patient is a new report', () => {
    expect(plan(rd(), [], all.map((o) => ({ ...o, d: '2025-12-02' }))).how).toBe('clean')
    expect(plan(rd(), [], all.map((o) => ({ ...o, pid: 'P-0814' }))).how).toBe('clean')
  })
  it('a patient who is not sure is never called a duplicate', () => {
    const r = rd({ head: { id: undefined, name: 'R. Das', age: undefined, sex: undefined } })
    expect(plan(r, [], all).how).toBe('ambiguous')
  })
  it('no obs given is the same as none on file', () => {
    expect(planFor(rd(), base, PTS, []).how).toBe('clean')
  })
})

describe('converted values reach the source', () => {
  it('keeps what was printed, the reading confidence and the equation', () => {
    const r = rd({
      egfr: { ...hit('egfr', 95, 'mL/min/1.73 m²', 0.93), equation: 'CKD-EPI 2021' },
      uacr: hit('uacr', 1.4, 'mg/mmol', 0.91),
      creat: hit('creat', 106, 'µmol/L', 0.95),
    })
    const obs = buildObs(r, 'P-0533', 'D-UP-x', '2025-12-18', 'ocr')
    const by = Object.fromEntries(obs.map((o) => [o.kind, o]))
    expect(by.uacr).toMatchObject({ v: 12.4, u: 'mg/g' })
    expect(by.uacr.source).toMatchObject({ via: 'ocr', conf: 0.91, asPrinted: { v: 1.4, u: 'mg/mmol' }, page: 1, ln: 'uacr' })
    expect(by.creat).toMatchObject({ v: 1.2, u: 'mg/dL' })
    expect(by.creat.source.asPrinted).toEqual({ v: 106, u: 'µmol/L' })
    expect(by.egfr.source.equation).toBe('CKD-EPI 2021')
    expect(by.egfr.source.asPrinted).toBeUndefined()
    expect(by.egfr.source.bbox).toEqual([0.1, 0.2, 0.5, 0.02])
  })
  it('a number with no unit is saved only when a person has confirmed it', () => {
    const r = rd({ egfr: hit('egfr', 95, '') })
    expect(buildObs(r, 'P-0533', 'D-UP-x', '2025-12-18').map((o) => o.kind)).toEqual(['uacr', 'creat'])
    expect(buildObs(r, 'P-0533', 'D-UP-x', '2025-12-18', 'text', true).map((o) => o.kind)).toEqual(['egfr', 'uacr', 'creat'])
  })
  it('a wrong unit is refused even when a person confirms', () => {
    expect(checkRead(rd({ egfr: hit('egfr', 55, 'mL/min') }), true).refused?.kind).toBe('egfr')
  })
  it('checkRead skips a missing unit and keeps the rest', () => {
    const c = checkRead(rd({ egfr: hit('egfr', 95, '') }))
    expect(c.refused).toBeUndefined()
    expect(Object.keys(c.ok)).toEqual(['uacr', 'creat'])
  })
})
