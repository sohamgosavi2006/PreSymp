import type { Box, Doc, Obs, Pt } from '../store/types'
import { reportSections } from './reportLines'

// Find in reports. Every result is a real line of a real report: the seeded report lines, or the text read from a
// file that was added. Lines are ranked with BM25 (a plain word-count formula, no model). Nothing is generated.

export type Found = {
  docId: string; page: number; ln?: string; box?: Box
  text: string; docLabel: string; lab: string; d: string
  rank: number // BM25 value, higher is a closer match
}

const docLabel = (d: Doc) =>
  d.kind === 'fundus' ? 'Eye report' : d.kind === 'foot' ? 'Foot test report' : `Kidney test${d.scan ? ' (scanned)' : ''}`

// ordinary words and the report words they stand for. a typed word also finds its synonyms (weighs 0.6),
// and each synonym finds the ordinary word back
export const SYNONYMS: Record<string, string[]> = {
  eye: ['fundus', 'retina', 'retinopathy', 'ophthalmic'],
  foot: ['monofilament', 'pedal'],
  urine: ['uacr', 'acr', 'microalbumin'],
  kidney: ['egfr', 'creatinine'],
  sugar: ['glucose', 'hba1c', 'fbs', 'ppbs'],
}

const K1 = 1.2
const B = 0.75
const W_SYN = 0.6
const W_PREFIX = 0.3
const W_NUMBER = 0.6 // a number in a line counts less than a word
const W_LABEL = 0.3 // a line of an "Eye report" gets a small lift for the word "eye"
const MAX_RESULTS = 120
const STOP = new Set(['the', 'of', 'and', 'in', 'a', 'an', 'for', 'to', 'on', 'is'])

// lower-case, accents removed (Latin accents only, so Indic letters stay whole)
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const WORD = /[\p{L}\p{N}]+(?:\.\p{N}+)?/gu
const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const isNum = (w: string) => /^[\d.]+$/.test(w)
const words = (s: string) => (fold(s).match(WORD) ?? []).map(stem)

const REVERSE: Record<string, string[]> = {}
for (const [k, list] of Object.entries(SYNONYMS)) for (const s of list) (REVERSE[stem(s)] ??= []).push(k)
const expand = (w: string): string[] => [...new Set([...(SYNONYMS[w] ?? []), ...(REVERSE[w] ?? [])].map(stem))].filter((x) => x !== w)

// words that a report line stands for without printing them
const ALIAS: [string[], string[]][] = [[['albumin', 'creatinine', 'ratio'], ['acr', 'uacr']]]

type Spec = { term: string; prefix: boolean; w: number }
type Q = { word: string; specs: Spec[] }

function parseQuery(q: string): Q[] {
  const seen = new Set<string>()
  const out: Q[] = []
  for (const raw of fold(q).match(WORD) ?? []) {
    const w = stem(raw)
    if (STOP.has(w) || seen.has(w)) continue
    seen.add(w)
    const specs: Spec[] = [{ term: w, prefix: false, w: 1 }]
    for (const s of expand(w)) specs.push({ term: s, prefix: false, w: W_SYN })
    if (w.length >= 3 && !isNum(w)) specs.push({ term: w, prefix: true, w: W_PREFIX })
    out.push({ word: w, specs })
  }
  return out
}

const hit = (s: Spec, tok: string) => (s.prefix ? tok.length > s.term.length && tok.startsWith(s.term) : tok === s.term)

type L = Omit<Found, 'rank'> & { tf: Map<string, number>; len: number; label: Set<string>; at: number }

function lineOf(base: Omit<Found, 'rank' | 'text' | 'page' | 'ln' | 'box'>, label: Set<string>, extra: Pick<Found, 'page' | 'ln' | 'box' | 'text'>, at: number): L {
  const tf = new Map<string, number>()
  const toks = words(extra.text)
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + (isNum(t) ? W_NUMBER : 1))
  for (const [need, add] of ALIAS) if (need.every((n) => tf.has(n))) for (const a of add) tf.set(a, (tf.get(a) ?? 0) + 1)
  return { ...base, ...extra, tf, len: toks.length, label, at }
}

// the words (and their synonyms) of the query that are printed in this text, as written in the text,
// so the caller can mark them. longest first. case-blind: compare in lower case
export function matchedTerms(q: string, text: string): string[] {
  const query = parseQuery(q)
  const out = new Set<string>()
  for (const raw of text.toLowerCase().match(WORD) ?? []) {
    const tok = stem(fold(raw))
    if (query.some((x) => x.specs.some((s) => hit(s, tok)))) out.add(raw)
  }
  return [...out].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

// the words to mark in a result line: the query words plus their synonyms
export function queryTerms(q: string): string[] {
  const out = new Set<string>()
  for (const x of parseQuery(q)) for (const s of x.specs) if (!s.prefix) out.add(s.term)
  return [...out]
}

// every report line for one patient: the seeded lines, plus the real text of added files. best match first,
// equal matches newest report first, then in the order they are printed
export function findInReports(q: string, pid: string, docs: Doc[], obs: Obs[], pts: Pt[]): Found[] {
  const query = parseQuery(q)
  if (!query.length) return []
  const lines: L[] = []
  const mine = docs.filter((x) => x.pid === pid).sort((a, b) => b.d.localeCompare(a.d) || a.id.localeCompare(b.id))
  for (const d of mine) {
    const base = { docId: d.id, docLabel: docLabel(d), lab: `Lab ${d.lab}`, d: d.d }
    const label = new Set(words(base.docLabel))
    if (d.text) {
      for (const pg of d.text) for (const l of pg.lines) lines.push(lineOf(base, label, { page: pg.page, box: l.bbox, text: l.text.replace(/\s{2,}/g, '  ') }, lines.length))
      continue
    }
    for (const s of reportSections(d, obs, pts)) {
      lines.push(lineOf(base, label, { page: s.page, text: s.heading }, lines.length))
      for (const l of s.lines) lines.push(lineOf(base, label, { page: s.page, ln: l.id, text: [l.test, l.res, l.unit, l.ref].filter(Boolean).join('  ') }, lines.length))
    }
  }
  const n = lines.length
  if (!n) return []
  const avg = lines.reduce((a, l) => a + l.len, 0) / n || 1

  // document frequency of each term, counted over lines
  const tfOf = (l: L, s: Spec) => {
    if (!s.prefix) return l.tf.get(s.term) ?? 0
    let t = 0
    for (const [tok, c] of l.tf) if (hit(s, tok)) t += c
    return t
  }
  const df = query.map((x) => x.specs.map((s) => lines.reduce((a, l) => a + (tfOf(l, s) > 0 ? 1 : 0), 0)))

  const found: Found[] = []
  const order = new Map<Found, number>()
  for (const l of lines) {
    let sum = 0
    let any = false
    let all = true
    query.forEach((x, qi) => {
      let got = false
      x.specs.forEach((s, si) => {
        const tf = tfOf(l, s)
        if (tf <= 0) return
        got = true
        any = true
        const idf = Math.log(1 + (n - df[qi][si] + 0.5) / (df[qi][si] + 0.5))
        sum += s.w * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * l.len) / avg)))
      })
      if (got) return
      // a word of the report title counts too: "eye report" finds lines of an Eye report
      if (x.specs.some((s) => [...l.label].some((t) => hit(s, t)))) return
      all = false
    })
    if (!any || !all) continue
    for (const x of query) if (x.specs.some((s) => !s.prefix && [...l.label].some((t) => hit(s, t)))) sum += W_LABEL
    const { tf: _tf, len: _len, label: _label, at, ...rest } = l
    const f: Found = { ...rest, rank: Math.round(sum * 1e6) / 1e6 }
    order.set(f, at)
    found.push(f)
  }
  found.sort((a, b) => b.rank - a.rank || b.d.localeCompare(a.d) || order.get(a)! - order.get(b)!)
  return found.slice(0, MAX_RESULTS)
}
