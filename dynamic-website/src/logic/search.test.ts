import { describe, expect, it } from 'vitest'
import { seed } from '../store/seed'
import type { Doc } from '../store/types'
import { findInReports, matchedTerms, queryTerms, SYNONYMS } from './search'

const s = seed()
const find = (q: string, pid = 'P-0417') => findInReports(q, pid, s.docs, s.obs, s.pts)
const docOf = (id: string) => s.docs.find((d) => d.id === id)!

// a small fixture of added files: every line is real text
const mk = (id: string, d: string, lines: string[]): Doc => ({
  id, pid: 'P-X', kind: 'kidney', lab: 'A', d, who: 'Test Patient', pages: 1,
  text: [{ page: 1, lines: lines.map((text, i) => ({ text, bbox: [0, i * 0.1, 1, 0.05] as [number, number, number, number] })) }],
})

describe('find in reports', () => {
  it('returns nothing for an empty query or only spaces', () => {
    expect(find('')).toEqual([])
    expect(find('   ')).toEqual([])
  })

  it('returns nothing for a word that is in no report', () => {
    expect(find('xyzzy')).toEqual([])
    expect(find('eye xyzzy')).toEqual([])
  })

  it('eye finds the fundus report first', () => {
    const r = find('eye')
    expect(r.length).toBeGreaterThan(0)
    expect(docOf(r[0].docId).kind).toBe('fundus')
    expect(r[0].docLabel).toBe('Eye report')
  })

  it('foot finds the foot report first', () => {
    const r = find('foot')
    expect(docOf(r[0].docId).kind).toBe('foot')
  })

  it('urine finds lines of the urine section and the albumin ratio', () => {
    const r = find('urine')
    const txt = r.map((x) => x.text)
    expect(txt.some((t) => t.startsWith('Urine microalbumin'))).toBe(true)
    expect(txt.some((t) => t.startsWith('Albumin/Creatinine ratio'))).toBe(true)
    expect(txt.some((t) => t === 'Urine')).toBe(true)
    expect(r.every((x) => docOf(x.docId).kind === 'kidney')).toBe(true)
  })

  it('kidney finds eGFR and creatinine lines', () => {
    const r = find('kidney')
    expect(r.length).toBeGreaterThan(0)
    expect(r.slice(0, 6).every((x) => /egfr|creatinine/i.test(x.text))).toBe(true)
    expect(r.some((x) => /egfr/i.test(x.text))).toBe(true)
  })

  it('albumin finds the Albumin/Creatinine ratio line', () => {
    const r = find('albumin')
    expect(r.some((x) => x.text.startsWith('Albumin/Creatinine ratio') && x.ln === 'acr')).toBe(true)
  })

  it('sugar finds glucose and HbA1c lines', () => {
    const t = find('sugar').map((x) => x.text)
    expect(t.some((x) => x.startsWith('Glucose, fasting'))).toBe(true)
    expect(t.some((x) => x.startsWith('HbA1c'))).toBe(true)
  })

  it('a reverse synonym works: fundus finds lines that say eye', () => {
    const r = find('retinopathy')
    expect(r.length).toBeGreaterThan(0)
    expect(docOf(r[0].docId).kind).toBe('fundus')
    expect(find('fundus').some((x) => /^Eye test$/.test(x.text))).toBe(true)
  })

  it('typing the start of a word works', () => {
    const r = find('creat')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => /creat/i.test(x.text))).toBe(true)
  })

  it('is case blind and accent blind', () => {
    expect(find('EGFR').map((x) => x.text)).toEqual(find('egfr').map((x) => x.text))
    const d = mk('D-1', '2025-01-01', ['Café test  4  mg'])
    expect(findInReports('cafe', 'P-X', [d], [], []).length).toBe(1)
    expect(findInReports('CAFÉ', 'P-X', [d], [], []).length).toBe(1)
  })

  it('ignores a trailing s', () => {
    const d = mk('D-1', '2025-01-01', ['Lipid panel'])
    expect(findInReports('lipids', 'P-X', [d], [], []).length).toBe(1)
  })

  it('ranks the same way every time', () => {
    const a = find('creatinine')
    const b = find('creatinine')
    expect(b).toEqual(a)
    for (let i = 1; i < a.length; i++) expect(a[i - 1].rank).toBeGreaterThanOrEqual(a[i].rank)
  })

  it('equal matches come newest report first', () => {
    const r = find('urine').filter((x) => x.text === 'Urine')
    const dates = r.map((x) => x.d)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('only searches the patient asked for', () => {
    const r = find('eye', 'P-0288')
    expect(r).toEqual([])
    const r2 = find('foot', 'P-0932')
    expect(r2.every((x) => docOf(x.docId).pid === 'P-0932')).toBe(true)
  })

  it('every result is a real line of a real report', () => {
    for (const x of find('creatinine')) {
      const d = docOf(x.docId)
      expect(d.pid).toBe('P-0417')
      expect(x.text.length).toBeGreaterThan(0)
      expect(x.lab).toBe(`Lab ${d.lab}`)
      expect(x.d).toBe(d.d)
    }
  })

  it('BM25 prefers a shorter line that holds the word', () => {
    const d = mk('D-1', '2025-01-01', [
      'Creatinine  0.9  mg/dL  and a good many other words on this very long line of the report',
      'Creatinine  0.9  mg/dL',
      'Urea  28  mg/dL',
    ])
    const r = findInReports('creatinine', 'P-X', [d], [], [])
    expect(r.map((x) => x.text.slice(0, 22))).toEqual(['Creatinine  0.9  mg/dL', 'Creatinine  0.9  mg/dL'])
    expect(r[0].text.length).toBeLessThan(r[1].text.length)
    expect(r[0].rank).toBeGreaterThan(r[1].rank)
  })

  it('BM25 prefers the rarer word', () => {
    const d = mk('D-1', '2025-01-01', ['Urea  28  test', 'Sodium  139  test', 'Potassium  4.3  test', 'Chloride  103  test'])
    const r = findInReports('chloride test', 'P-X', [d], [], [])
    expect(r[0].text.startsWith('Chloride')).toBe(true)
    expect(r.length).toBe(1)
  })

  it('a line with every query word comes before a line with some', () => {
    const d = mk('D-1', '2025-01-01', ['Blood test  eGFR  95', 'eGFR  95'])
    const r = findInReports('egfr blood', 'P-X', [d], [], [])
    expect(r.length).toBe(1)
    expect(r[0].text.startsWith('Blood test')).toBe(true)
  })

  it('searches the text of an added file and keeps the box', () => {
    const d = mk('D-UP', '2025-12-01', ['Estimated GFR  95  mL/min/1.73 m²  CKD-EPI 2021', 'Reported 01 Dec 2025'])
    const r = findInReports('gfr', 'P-X', [d], [], [])
    expect(r.length).toBe(1)
    expect(r[0].docId).toBe('D-UP')
    expect(r[0].box).toEqual([0, 0, 1, 0.05])
    expect(r[0].page).toBe(1)
    expect(r[0].ln).toBeUndefined()
    expect(findInReports('ckd-epi', 'P-X', [d], [], []).length).toBe(1)
    expect(findInReports('1.73', 'P-X', [d], [], []).length).toBe(1)
  })

  it('expands synonyms and weighs them less than the typed word', () => {
    const d = mk('D-1', '2025-01-01', ['Fundus examination  done', 'Eye test  done'])
    const r = findInReports('eye', 'P-X', [d], [], [])
    expect(r.map((x) => x.text.slice(0, 3))).toEqual(['Eye', 'Fun'])
    expect(r[0].rank).toBeGreaterThan(r[1].rank)
  })

  it('a word of the report title counts: eye report finds lines of an eye report', () => {
    const fundus = s.docs.find((x) => x.pid === 'P-0417' && x.kind === 'fundus')!
    const r = find('eye report')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.docId === fundus.id)).toBe(true)
  })
})

describe('matched terms', () => {
  it('lists the printed words that the query or its synonyms find', () => {
    expect(matchedTerms('eye', 'Eye test (fundus examination, retina)')).toEqual(['fundus', 'retina', 'eye'])
  })
  it('gives the word as printed for a start of a word', () => {
    expect(matchedTerms('creat', 'Creatinine (blood)  1.15  mg/dL')).toEqual(['creatinine'])
  })
  it('is empty when nothing is printed', () => {
    expect(matchedTerms('eye', 'Urea  28  mg/dL')).toEqual([])
    expect(matchedTerms('', 'Urea')).toEqual([])
  })
  it('query terms hold the typed words and their synonyms', () => {
    const t = queryTerms('foot')
    expect(t).toContain('foot')
    for (const x of SYNONYMS.foot) expect(t).toContain(x)
  })
})
