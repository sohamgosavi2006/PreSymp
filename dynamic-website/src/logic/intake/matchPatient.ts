import type { Cand, Pt, Read } from '../../store/types'

// how the file was tied to a patient
//   id    the printed ID is on file and the printed name does not disagree: saved
//   name  full name, age within one year and sex all agree, and only one patient fits: saved
//   weak  anything else: a person checks, with the candidates and why each one is listed
export type Match =
  | { how: 'id' | 'name'; pid: string; cands: Cand[]; on: string }
  | { how: 'weak'; cands: Cand[]; on: string }

const toks = (s = '') =>
  s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)

// "R. Das" and "Ramesh Das" agree on surname and first initial
function nameFits(printed: string | undefined, p: Pt) {
  const a = toks(printed)
  const b = toks(p.name)
  if (a.length < 1) return true
  return a[a.length - 1] === b[b.length - 1] && (a.length === 1 || a[0][0] === b[0][0])
}

// a full printed name has a first name, not an initial
const isFull = (printed?: string) => toks(printed).length >= 2 && toks(printed)[0].length > 1

// same first and last name (middle names may differ)
const sameName = (printed: string | undefined, p: Pt) => {
  const a = toks(printed)
  const b = toks(p.name)
  return isFull(printed) && a.length >= 2 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]
}

const years = (n: number) => `${n} year${n === 1 ? '' : 's'}`

// the reason a patient is on the list, in plain words
function why(r: Read, p: Pt): string {
  const parts = [sameName(r.name, p) ? 'Same name' : 'Same surname']
  if (r.age === undefined) parts.push('age not on report')
  else if (Math.abs(r.age - p.age) <= 1) parts.push('age matches')
  else parts.push(`age differs by ${years(Math.abs(r.age - p.age))}`)
  if (r.sex && r.sex !== p.sex) parts.push('sex differs')
  return parts.join(', ')
}

const confOf = (r: Read, p: Pt) =>
  Math.round((0.55 + (r.sex && r.sex === p.sex ? 0.03 : 0) + (r.age !== undefined && Math.abs(r.age - p.age) <= 1 ? 0.2 : 0)) * 100) / 100

function byName(r: Read, pts: Pt[]): Cand[] {
  const sur = toks(r.name).at(-1)
  return pts
    .filter((p) => sur && toks(p.name).at(-1) === sur && nameFits(r.name, p))
    .map((p) => ({ pid: p.id, conf: confOf(r, p), why: why(r, p) }))
    .sort((a, b) => b.conf - a.conf)
}

export function matchPatient(r: Read, pts: Pt[]): Match {
  const printed = r.id?.trim().toLowerCase()
  const byId = printed ? pts.find((p) => p.id.toLowerCase() === printed) : undefined
  if (byId) {
    if (nameFits(r.name, byId)) return { how: 'id', pid: byId.id, cands: [{ pid: byId.id, conf: 0.97, why: 'ID matches' }], on: 'ID' }
    // the ID belongs to someone whose name is different: a person decides
    const others = byName(r, pts).filter((c) => c.pid !== byId.id)
    return { how: 'weak', cands: [{ pid: byId.id, conf: 0.5, why: 'ID matches, name does not' }, ...others], on: 'ID found, name does not agree' }
  }
  if (isFull(r.name) && r.age !== undefined && r.sex) {
    const full = pts.filter((p) => sameName(r.name, p) && Math.abs(p.age - r.age!) <= 1 && p.sex === r.sex)
    if (full.length === 1) return { how: 'name', pid: full[0].id, cands: [{ pid: full[0].id, conf: 0.9, why: 'Same name, age and sex' }], on: 'full name, age and sex' }
  }
  const cands = byName(r, pts)
  return { how: 'weak', cands, on: cands.length > 1 ? 'name only (several possible patients)' : 'name only' }
}
