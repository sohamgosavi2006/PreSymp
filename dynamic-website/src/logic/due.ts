import { TODAY, addMonths, daysBetween, fmtMonth, sinceText } from './dates'
import type { Cfg, Doc, Obs, Pt } from '../store/types'

export type Visit = {
  pid: string; d: string; egfr: number; uacr: number; creat?: number
  lab: string; doc: string; via: string; conf?: number
}

// one visit = an eGFR and a UACR from the same date
export function visitsOf(obs: Obs[], docs: Doc[], pid: string): Visit[] {
  const byDate = new Map<string, Obs[]>()
  for (const o of obs) if (o.pid === pid) byDate.set(o.d, [...(byDate.get(o.d) ?? []), o])
  const out: Visit[] = []
  for (const [d, list] of byDate) {
    const e = list.find((o) => o.kind === 'egfr')
    const u = list.find((o) => o.kind === 'uacr')
    if (!e || !u) continue
    const c = list.find((o) => o.kind === 'creat')
    out.push({
      pid, d, egfr: e.v, uacr: u.v, creat: c?.v,
      lab: docs.find((x) => x.id === u.source.docId)?.lab ?? 'A', doc: u.source.docId, via: u.source.via, conf: u.source.conf,
    })
  }
  return out.sort((a, b) => a.d.localeCompare(b.d))
}

type Rep =
  | { st: 'none' }
  | { st: 'one_on_file' | 'repeat_due'; first: string; last: string; due: string }
  | { st: 'repeat_on_file'; first: string; last: string }

// walks the readings oldest to newest; a reading that does not match resets the run
function repeatState(vs: Visit[], hit: (v: Visit) => boolean, wait: number, today: string): Rep {
  let run = 0
  let first = ''
  let last = ''
  for (const v of vs) {
    if (hit(v)) {
      if (run === 0) first = v.d
      run++
      last = v.d
    } else {
      run = 0
      first = last = ''
    }
  }
  if (run === 0) return { st: 'none' }
  if (run >= 2) return { st: 'repeat_on_file', first, last }
  const due = addMonths(first, wait)
  return { st: due <= today ? 'repeat_due' : 'one_on_file', first, last, due }
}

export const LABEL = {
  panel: 'Kidney tests (blood and urine)',
  rpt: 'Repeat urine test (if first result is high)',
  egfr2: 'Repeat blood test (if first result is low)',
  fundus: 'Eye test',
  foot: 'Foot test',
} as const
export const SHORT = {
  panel: 'Yearly kidney test',
  rpt: 'Repeat urine test',
  egfr2: 'Repeat blood test',
  fundus: 'Eye test',
  foot: 'Foot test',
} as const
// key used by the phrase bank
export const PHRASE_KEY = { panel: 'panel', rpt: 'repeat_uacr', egfr2: 'egfr2', fundus: 'fundus', foot: 'foot' } as const
export type ItemKey = keyof typeof LABEL

export type Item = {
  pid: string; key: ItemKey; label: string; every: string; due?: string; pending: boolean
  text: string; since: string; days: number
  mark: 'pill' | 'dot' | 'hollow' // late = pill, soon = dot, later = hollow
  extra?: string; forced: boolean; last?: string
}

function mk(pid: string, key: ItemKey, every: string, due: string, today: string, waiting: boolean, forced: boolean): Item {
  const pending = due <= today
  const days = pending ? daysBetween(due, today) : 0
  const since = pending ? (days === 0 ? 'today' : sinceText(due, today)) : ''
  let text: string
  let mark: Item['mark']
  if (pending) {
    text = days === 0 ? 'due today' : waiting ? `waiting since ${since}` : `${since} late`
    mark = waiting || days === 0 ? 'dot' : 'pill'
  } else if (daysBetween(today, due) <= 60 || waiting) {
    text = waiting ? `repeat test due ${fmtMonth(due)}` : `due ${fmtMonth(due)}`
    mark = 'dot'
  } else {
    text = `next test ${fmtMonth(due)}`
    mark = 'hollow'
  }
  return { pid, key, label: LABEL[key], every, due, pending, text, since, days, mark, forced }
}

// marks: a check that staff marked done without a report, as 'pid:key' -> date
export type Ctx = { pts: Pt[]; obs: Obs[]; docs: Doc[]; cfg: Cfg; ovr: Record<string, number>; forced: string[]; marks?: Record<string, string>; today?: string }

export function itemsFor(c: Ctx, pid: string): Item[] {
  const today = c.today ?? TODAY
  const vs = visitsOf(c.obs, c.docs, pid)
  const forced = (k: string) => c.forced.includes(`${pid}:${k}`)
  const mark = (k: string) => c.marks?.[`${pid}:${k}`]
  const later = (a: string, b?: string) => (b && b > a ? b : a)
  const doneItem = (key: ItemKey, every: string, when: string): Item => ({
    pid, key, label: LABEL[key], every, pending: false, text: `done, ${fmtMonth(when)}`, since: '', days: 0, mark: 'hollow',
    extra: 'marked done by staff', forced: forced(key), last: when,
  })
  const out: Item[] = []
  if (vs.length) {
    const lastD = later(vs[vs.length - 1].d, mark('panel'))
    const every = c.ovr[pid] ?? c.cfg.panel
    const panel = mk(pid, 'panel', `${every} months`, addMonths(lastD, every), today, false, forced('panel'))
    panel.last = lastD
    if (c.ovr[pid]) panel.extra = 'set by doctor'
    out.push(panel)

    const rep = repeatState(vs, (v) => v.uacr >= 30, c.cfg.rptMin, today)
    const win = `${c.cfg.rptMin}–${c.cfg.rptMax} months`
    if (mark('rpt') && rep.st !== 'none' && rep.st !== 'repeat_on_file') {
      out.push(doneItem('rpt', win, mark('rpt')!))
    } else if (rep.st === 'repeat_on_file') {
      out.push({
        pid, key: 'rpt', label: LABEL.rpt, every: win, pending: false, text: `done, ${fmtMonth(rep.last)}`,
        since: '', days: 0, mark: 'hollow', extra: 'doctor reviews both', forced: forced('rpt'),
      })
    } else if (rep.st !== 'none') out.push(mk(pid, 'rpt', win, rep.due, today, true, forced('rpt')))

    const low = repeatState(vs, (v) => v.egfr < 60, c.cfg.egfr2, today)
    if ((low.st === 'one_on_file' || low.st === 'repeat_due') && mark('egfr2')) out.push(doneItem('egfr2', `${c.cfg.egfr2} months`, mark('egfr2')!))
    else if (low.st === 'one_on_file' || low.st === 'repeat_due')
      out.push(mk(pid, 'egfr2', `${c.cfg.egfr2} months`, low.due, today, true, forced('egfr2')))
  }
  for (const k of ['fundus', 'foot'] as const) {
    const ds = c.docs.filter((x) => x.pid === pid && x.kind === k).sort((a, b) => a.d.localeCompare(b.d))
    if (!ds.length) continue
    const n = c.cfg[k]
    const lastK = later(ds[ds.length - 1].d, mark(k))
    const it = mk(pid, k, `${n} months`, addMonths(lastK, n), today, false, forced(k))
    it.last = lastK
    out.push(it)
  }
  return out
}

export const allItems = (c: Ctx) => c.pts.flatMap((p) => itemsFor(c, p.id))
export const dueItems = (c: Ctx) => allItems(c).filter((i) => i.pending || i.forced)
export const pendingItems = (c: Ctx) => dueItems(c).filter((i) => i.pending)
