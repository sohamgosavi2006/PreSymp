import { TODAY } from '../dates'
import { checkUnit, inRange, NAME, RANGE, UNIT, type Kind } from '../units'
import { matchPatient } from './matchPatient'
import { UNREAD, type IntakeResult } from './types'
import type { Doc, Obs, PageText, Pt, Read } from '../../store/types'

const KINDS: Kind[] = ['egfr', 'uacr', 'creat']

export type Refusal = { kind: Kind; why: string }
type Ok = Partial<Record<Kind, { v: number; u: string; asPrinted?: { v: number; u: string } }>>

// unit-check every number read from the file; returns what can be saved and the first one refused.
// A number with no unit printed is not refused here (the reading gate sends it to a person);
// assume = a person has looked at the file, so a missing unit means the standard one
export function checkRead(read: Read, assume = false): { ok: Ok; refused?: Refusal } {
  const ok: Ok = {}
  for (const k of KINDS) {
    const h = read.hits[k]
    if (!h) continue
    const printed = h.printedUnit.trim() || (assume ? UNIT[k] : '')
    if (!printed) continue
    const r = checkUnit(k, h.v, printed)
    if (r.res === 'refused') return { ok, refused: { kind: k, why: r.why } }
    ok[k] = { v: r.v, u: r.u, asPrinted: r.res === 'converted' ? { v: h.v, u: h.printedUnit.trim() } : undefined }
  }
  return { ok }
}

// real observations for a file that is now matched to a patient. confirmed: a person approved the reading
export function buildObs(read: Read, pid: string, docId: string, d: string, via: 'text' | 'ocr' = 'text', confirmed = false): Obs[] {
  const { ok } = checkRead(read, confirmed)
  const out: Obs[] = []
  for (const k of KINDS) {
    const h = read.hits[k]
    const v = ok[k]
    if (!h || !v) continue
    out.push({
      id: `${pid}-${d}-${k}`, pid, kind: k, v: v.v, u: UNIT[k], d,
      source: {
        docId, page: h.page, bbox: h.bbox, via, ln: k, ...(h.conf !== undefined ? { conf: h.conf } : {}),
        ...(v.asPrinted ? { asPrinted: v.asPrinted } : {}), ...(h.equation ? { equation: h.equation } : {}),
      },
    })
  }
  return out
}

// reading gate: low confidence, no unit, or a value no kidney result can have. one plain reason each
export function readingGate(read: Read): { reason: string; conf: number; noUnit: boolean } | undefined {
  const { ok } = checkRead(read)
  const why: string[] = []
  let noUnit = false
  const confs = KINDS.map((k) => read.hits[k]?.conf).filter((c): c is number => c !== undefined)
  const lowest = confs.length ? Math.min(...confs) : undefined
  if (lowest !== undefined && lowest < 0.8) why.push(`How sure: ${Math.round(lowest * 100)}%. A person needs to check these numbers.`)
  for (const k of KINDS) {
    const h = read.hits[k]
    if (!h) continue
    if (!h.printedUnit.trim()) { why.push(`No unit printed next to the ${NAME[k]}.`); noUnit = true }
  }
  for (const k of KINDS) {
    const h = read.hits[k]
    if (!h) continue
    const v = ok[k]?.v ?? h.v
    if (!inRange(k, v)) why.push(`The ${NAME[k]} value ${v} is outside ${RANGE[k][0]} to ${RANGE[k][1]}.`)
  }
  if (!why.length) return
  return { reason: why.join(' '), conf: lowest ?? 0, noUnit }
}

const stagesFor = (n: number, unit: 'ok' | 'wrong' | 'missing') =>
  [
    'Report came in', 'Report read',
    unit === 'ok' ? 'Numbers read · unit is right ✓' : unit === 'wrong' ? 'Numbers read · unit is wrong ✗' : 'Numbers read · no unit ✗',
    'Patient found', 'Saved',
  ].slice(0, n)

export type Base = { id: string; name: string; mime: string; file: Blob; pages: number; hash: string; text: PageText[]; views?: Blob[] }

// decide the outcome for a file that has been read. pure, so it is tested without a pdf.
// order: unread, wrong unit, reading not sure, patient not sure, already saved, clean
export function planFor(read: Read, base: Base, pts: Pt[], known: string[], obs: Obs[] = []): IntakeResult {
  const d = read.date ?? TODAY
  const doc: Doc = {
    id: base.id, pid: '', kind: 'kidney', lab: read.lab === 'B' ? 'B' : 'A', d, who: read.name ?? 'Name not printed',
    ageSex: read.age !== undefined && read.sex ? `${read.age} / ${read.sex}` : 'not printed', pages: base.pages, isNew: true,
    name: base.name, mime: base.mime, file: base.file, views: base.views, text: base.text, printedId: read.id,
  }
  const p = { doc, read, hash: base.hash, title: base.name, conf: 0 }
  if (known.includes(base.id)) return { ...p, how: 'dup', on: '', stages: [], reason: 'This report is already in the app.' }
  if (!read.hits.egfr || !read.hits.uacr || !read.date)
    return { ...p, how: 'unread', on: '', reason: UNREAD, stages: ['Report came in', 'Report read', 'Could not read the numbers'], last: 'Staff check it' }
  const { ok, refused } = checkRead(read)
  const m = matchPatient(read, pts)
  const sure = m.how === 'weak' ? undefined : m.pid
  if (refused)
    return {
      ...p, how: 'unit', pid: sure, cands: m.cands, on: m.on, conf: m.cands[0]?.conf ?? 0,
      reason: refused.why, stages: stagesFor(3, 'wrong'), last: 'Sent to check list',
    }
  const gate = readingGate(read)
  if (gate)
    return {
      ...p, how: 'check', pid: sure, cands: m.cands, on: m.on, conf: gate.conf, reason: gate.reason,
      stages: stagesFor(3, gate.noUnit ? 'missing' : 'ok'), last: 'Staff check it',
    }
  if (m.how === 'weak')
    return {
      ...p, how: 'ambiguous', cands: m.cands, on: m.on, conf: m.cands[0]?.conf ?? 0,
      stages: [...stagesFor(3, 'ok'), m.cands.length > 1 ? `Not sure: ${m.cands.length} possible patients` : 'Not sure which patient'],
      last: 'Staff check it',
    }
  // the same patient, the same day and the same numbers are already on file: add nothing
  const same = (Object.keys(ok) as Kind[]).every((k) => obs.some((o) => o.pid === m.pid && o.d === d && o.kind === k && o.v === ok[k]!.v))
  if (same && Object.keys(ok).length)
    return { ...p, how: 'dup', pid: m.pid, on: m.on, conf: m.cands[0].conf, stages: [], reason: 'Already saved. Nothing was added twice.' }
  return { ...p, how: 'clean', pid: m.pid, on: m.on, conf: m.cands[0].conf, stages: stagesFor(5, 'ok') }
}
