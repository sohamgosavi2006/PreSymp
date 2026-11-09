import { create } from 'zustand'
import { clock, fmt } from '../logic/dates'
import { itemsFor, pendingItems, SHORT, type Ctx } from '../logic/due'
import { buildObs, checkRead, ingest, type IntakeResult } from '../logic/intake'
import { checkUnit } from '../logic/units'
import { obsFor, seed } from './seed'
import type { Aud, Cfg, Doc, Obs, QItem, Rem, Role, Undo, Ver, Viewer } from './types'

let nextAud = 100
const who = (r: Role) => (r === 'doc' ? { who: 'Dr. M.', role: 'Doctor' } : { who: 'K.', role: 'Front desk' })
const hhmm = () => clock().slice(-5)
export const lastCfg = (vers: Ver[]) => vers[vers.length - 1].cfg

export type Intake = {
  open: boolean; step: number
  status: 'idle' | 'read' | 'run' | 'done' | 'stop' | 'wait'
  plan?: IntakeResult
  note?: string
  busy?: { label: string; pct: number }
}

const fresh = () => ({
  ...seed(),
  role: 'front' as Role,
  forced: [] as string[],
  marks: {} as Record<string, string>, // 'pid:key' -> date a check was marked done without a report
  rem: {} as Record<string, Rem>,
  remText: {} as Record<string, string>,
  heard: {} as Record<string, 'listened' | 'read'>, // how a person checked a message before sending
  appt: {} as Record<string, string>,
  note: {} as Record<string, string>, // doctor's note for the follow-up card, exactly as typed
  viewer: null as Viewer | null,
  toast: '',
  selDue: '',
  intake: { open: false, step: 0, status: 'idle' } as Intake,
  findQ: '',
  tour: 0,
  mapPeek: false,
  menu: false,
  edHint: null as { cfg: Partial<Cfg>; reason: string } | null,
})

export type S = ReturnType<typeof fresh> & Actions
type Actions = {
  setRole: (r: Role) => void
  openSrc: (o: Obs) => void
  openAt: (v: Viewer) => void
  openDoc: (d: Doc) => void
  closeViewer: () => void
  setPg: (n: number) => void
  say: (t: string) => void
  log: (act: string, det: string, undo?: Undo) => void
  setSelDue: (k: string) => void
  setRemText: (k: string, text: string, before: string, by: string) => void
  setHeard: (k: string, h: 'listened' | 'read') => void
  approve: (k: string, text: string, by: string) => void
  skip: (k: string, reason: string, by: string) => void
  undo: (id: string) => void
  addForced: (pid: string, key: string) => void
  markDone: (pid: string, key: string, date: string, what: string) => void
  saveVer: (cfg: Cfg, reason: string, act?: string) => void
  revert: (n: number) => void
  setOvr: (pid: string, n: number | null, reason: string) => void
  setAppt: (pid: string, d: string) => void
  setNote: (pid: string, t: string) => void
  approveCard: (pid: string, lang: string, values: boolean, how: string) => void
  setFindQ: (q: string) => void
  openIntake: () => void
  ingestFile: (f: File) => Promise<void>
  ingestSample: (name: string) => Promise<void>
  setStep: (n: number) => void
  closeIntake: () => void
  finishIntake: () => void
  confirmMatch: (qid: string, pid: string) => void
  noMatch: (qid: string) => void
  unitAct: (qid: string, how: 'request' | 'discard') => void
  manualEntry: (qid: string, egfr: number, unit: string, uacr: number) => { ok: boolean; why: string }
  setTour: (n: number) => void
  setPeek: (b: boolean) => void
  setMenu: (b: boolean) => void
  setEdHint: (h: S['edHint']) => void
  reset: () => void
}

export const ctxOf = (s: Pick<S, 'pts' | 'obs' | 'docs' | 'vers' | 'ovr' | 'forced' | 'marks'>): Ctx => ({
  pts: s.pts, obs: s.obs, docs: s.docs, cfg: lastCfg(s.vers), ovr: s.ovr, forced: s.forced, marks: s.marks,
})

export const useStore = create<S>()((set, get) => {
  const log = (act: string, det: string, undo?: Undo) =>
    set((s) => ({ aud: [{ id: `A${++nextAud}`, when: clock(), ...who(s.role), act, det, undo } as Aud, ...s.aud] }))
  const pend = (s: S) => pendingItems(ctxOf(s)).map((i) => `${i.pid}:${i.key}`)
  const pt = (id: string) => get().pts.find((p) => p.id === id)!
  const shortFor = (k: string) => {
    const [pid, key] = k.split(':')
    return `${pt(pid).short} · ${SHORT[key as keyof typeof SHORT]}`
  }

  // file results for a patient. the same patient, date and values twice is not added twice.
  // logs the due items that this result clears
  function fileObs(pid: string, docId: string, obs: Obs[], via: string): string[] | null {
    const have = get().obs.filter((o) => o.pid === pid && o.d === obs[0].d)
    if (have.some((o) => obs.some((n) => n.kind === o.kind && n.v === o.v))) return null
    const before = pend(get())
    set((s) => ({
      obs: [...s.obs.filter((o) => !(o.pid === pid && o.d === obs[0].d && obs.some((n) => n.kind === o.kind))), ...obs],
      docs: s.docs.map((d) => (d.id === docId ? { ...d, pid, isNew: true } : d)),
    }))
    const after = pend(get())
    for (const k of before.filter((x) => !after.includes(x))) log('Cleared: result saved', `${shortFor(k)} · ${via}`)
    return obs.map((o) => o.id)
  }

  // the numbers of a document that is matched to a patient
  function obsOf(doc: Doc, pid: string, read?: QItem['read'], confirmed = false): Obs[] {
    if (read) return buildObs(read, pid, doc.id, doc.d, doc.views ? 'ocr' : 'text', confirmed)
    const pre = doc.pre!
    return obsFor(pid, doc.d, parseFloat(pre.egfr), pre.uacr, pre.creat, doc.id)
  }

  return {
    ...fresh(),
    setRole: (role) => set({ role }),
    openSrc: (o) => set({ viewer: { docId: o.source.docId, pg: o.source.page, ln: o.source.ln, obsId: o.id, box: o.source.via === 'seed' ? undefined : o.source.bbox } }),
    openAt: (v) => set({ viewer: v }),
    openDoc: (d) => set({ viewer: { docId: d.id, pg: 1 } }),
    closeViewer: () => set({ viewer: null }),
    setPg: (n) => set((s) => (s.viewer ? { viewer: { ...s.viewer, pg: n, ln: undefined, box: undefined } } : {})),
    say: (toast) => set({ toast }),
    log,
    setSelDue: (selDue) => set({ selDue }),

    setRemText: (k, text, before, by) => {
      set((s) => ({ remText: { ...s.remText, [k]: text } }))
      log('Message edited', `${shortFor(k)} · by ${by} · before: "${before}" · after: "${text}"`)
    },
    setHeard: (k, h) => set((s) => ({ heard: { ...s.heard, [k]: h } })),
    approve: (k, text, by) => {
      const prev = get().rem[k]
      const time = hhmm()
      const heard = get().heard[k] === 'listened'
      set((s) => ({ rem: { ...s.rem, [k]: { st: 'sent', via: 'clinic WhatsApp', time, text, heard } } }))
      log('Message sent', `${shortFor(k)} · by ${by} · ${heard ? 'listened' : 'read'} first · via clinic WhatsApp · ${time} · demo, nothing sent`, { t: 'rem', key: k, prev })
    },
    skip: (k, reason, by) => {
      const prev = get().rem[k]
      set((s) => ({ rem: { ...s.rem, [k]: { st: 'skipped', reason } } }))
      log('Message skipped', `${shortFor(k)} · by ${by} · reason: ${reason}`, { t: 'rem', key: k, prev })
    },
    undo: (id) => {
      const a = get().aud.find((x) => x.id === id)
      if (!a?.undo || a.undone) return
      const u = a.undo
      if (u.t === 'rem')
        set((s) => {
          const rem = { ...s.rem }
          if (u.prev) rem[u.key] = u.prev
          else delete rem[u.key]
          return { rem }
        })
      else if (u.t === 'mark')
        set((s) => {
          const marks = { ...s.marks }
          if (u.prev) marks[u.key] = u.prev
          else delete marks[u.key]
          return { marks }
        })
      else if (u.t === 'queue')
        set((s) => ({
          obs: s.obs.filter((o) => !u.obsIds.includes(o.id)),
          docs: s.docs.map((d) => (u.docIds.includes(d.id) ? { ...d, pid: '', isNew: false } : d)),
          queue: s.queue.map((q) => (q.id === u.qid ? { ...q, state: 'open', note: undefined } : q)),
        }))
      else get().revert(u.to)
      set((s) => ({ aud: s.aud.map((x) => (x.id === id ? { ...x, undone: true } : x)) }))
      if (u.t !== 'ver') log(`Undid: ${a.act}`, a.det)
    },
    addForced: (pid, key) => {
      set((s) => ({ forced: s.forced.includes(`${pid}:${key}`) ? s.forced : [...s.forced, `${pid}:${key}`] }))
      log('Added to call list', `${pt(pid).short} · ${SHORT[key as keyof typeof SHORT]}`)
    },
    markDone: (pid, key, date, what) => {
      const k = `${pid}:${key}`
      const prev = get().marks[k]
      set((s) => ({ marks: { ...s.marks, [k]: date } }))
      log('Marked done', `${shortFor(k)} · ${what} · done ${fmt(date)} · no report on file`, { t: 'mark', key: k, prev })
    },

    saveVer: (cfg, reason, act = 'Schedule saved') => {
      if (get().role !== 'doc') return
      const to = get().vers.length
      const n = to + 1
      const old = lastCfg(get().vers)
      set((s) => ({ vers: [...s.vers, { n, cfg, by: 'Dr. M.', at: '18 Dec 2025', reason }] }))
      const diff = (Object.keys(cfg) as (keyof Cfg)[]).filter((k) => old[k] !== cfg[k]).map((k) => `${k} ${old[k]} → ${cfg[k]}`).join(', ')
      log(act, `Version ${n} · ${diff ? diff + ' · ' : ''}${reason}`, act === 'Schedule saved' ? { t: 'ver', to } : undefined)
      set({ toast: `Saved as version ${n}` })
    },
    revert: (n) => {
      const v = get().vers.find((x) => x.n === n)
      if (v) get().saveVer({ ...v.cfg }, `Went back to version ${n}`, 'Schedule changed back')
    },
    setOvr: (pid, n, reason) => {
      if (get().role !== 'doc') return
      set((s) => {
        const ovr = { ...s.ovr }
        if (n === null) delete ovr[pid]
        else ovr[pid] = n
        return { ovr }
      })
      log('Changed for one patient', `${pt(pid).short} · kidney test ${n === null ? 'back to clinic default' : `every ${n} months`} · ${reason}`)
    },
    setAppt: (pid, d) => set((s) => ({ appt: { ...s.appt, [pid]: d } })),
    setNote: (pid, t) => set((s) => ({ note: { ...s.note, [pid]: t } })),
    approveCard: (pid, lang, values, how) =>
      log('Follow-up card approved', `${pt(pid).short} · ${lang.toUpperCase()} · ${values ? 'with last results' : 'no results'} · ${how}`),
    setFindQ: (findQ) => set({ findQ }),

    // ---- adding a report ----
    openIntake: () => set({ intake: { open: true, step: 0, status: 'idle' } }),
    ingestFile: async (f) => {
      set({ intake: { open: true, step: 0, status: 'read', busy: { label: 'Reading the file…', pct: 5 } } })
      const s = get()
      const plan = await ingest(f, {
        pts: s.pts, known: s.docs.map((d) => d.id), obs: s.obs,
        onProgress: (label, pct) => set((x) => (x.intake.status === 'read' ? { intake: { ...x.intake, busy: { label, pct } } } : {})),
      })
      set((x) => (x.intake.open ? { intake: { open: true, step: 0, status: plan.how === 'dup' ? 'done' : 'run', plan, note: plan.how === 'dup' ? plan.reason : undefined } } : {}))
    },
    // a bundled sample goes through exactly the same door as a file the user picks
    ingestSample: async (name) => {
      set({ intake: { open: true, step: 0, status: 'read', busy: { label: 'Opening the sample…', pct: 2 } } })
      try {
        const r = await fetch(`./samples/${name}`)
        if (!r.ok) throw new Error(String(r.status))
        const b = await r.blob()
        await get().ingestFile(new File([b], name, { type: b.type || (name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') }))
      } catch {
        set({ intake: { open: true, step: 0, status: 'idle', note: 'This sample file could not be opened here.' } })
      }
    },
    setStep: (step) => set((s) => ({ intake: { ...s.intake, step } })),
    closeIntake: () => set((s) => ({ intake: { ...s.intake, open: false } })),

    finishIntake: () => {
      const plan = get().intake.plan
      if (!plan) return
      const doc = plan.doc
      const have = get().docs.some((d) => d.id === doc.id)
      const done = (status: Intake['status'], note?: string) => set((s) => ({ intake: { ...s.intake, status, note } }))
      const q = get().queue.find((x) => x.docId === doc.id)
      const lab = `Lab ${doc.lab}`
      if (have) return done(q?.state === 'open' ? (plan.how === 'ambiguous' ? 'wait' : 'stop') : 'done', q?.state === 'open' ? 'Already in the check list.' : 'This report is already saved.')
      if (plan.how === 'dup') return done('done', plan.reason)

      if (plan.how === 'clean') {
        const ids = fileObs(plan.pid!, doc.id, obsOf(doc, plan.pid!, plan.read), 'auto')
        if (!ids) return done('done', 'Already saved. Nothing was added twice.')
        set((s) => ({ docs: [...s.docs, { ...doc, pid: plan.pid!, isNew: true }] }))
        log('Report saved', `${pt(plan.pid!).short} · ${lab} · matched by ${plan.on}`)
        return done('done')
      }
      const qid = `Q-${get().queue.length + 1}`
      const ex = `${doc.who} · ${doc.ageSex === 'not printed' ? 'age and sex not printed' : doc.ageSex}`
      const item: QItem =
        plan.how === 'unit'
          ? { id: qid, kind: 'unit', docId: doc.id, pid: plan.pid, ex, state: 'open', reason: plan.reason, read: plan.read, cands: plan.cands }
          : plan.how === 'unread'
            ? { id: qid, kind: 'unread', docId: doc.id, ex: doc.name ?? doc.who, state: 'open', reason: plan.reason, read: plan.read }
            : { id: qid, kind: plan.how === 'check' ? 'check' : 'match', docId: doc.id, ex, cands: plan.cands, state: 'open', reason: plan.reason, read: plan.read }
      set((s) => ({ docs: [...s.docs, doc], queue: [...s.queue, item] }))
      done(plan.how === 'ambiguous' || plan.how === 'check' ? 'wait' : 'stop')
      log('Report sent to check list', plan.how === 'unit' ? `${doc.who} · ${lab} · wrong unit` : plan.how === 'unread' ? `${doc.name ?? doc.who} · could not read kidney results` : `${doc.who} · ${lab} · ${plan.cands?.length ?? 0} possible patients`)
    },

    confirmMatch: (qid, pid) => {
      const q = get().queue.find((x) => x.id === qid)
      if (!q) return
      const doc = get().docs.find((d) => d.id === q.docId)!
      if (q.read) {
        const { refused } = checkRead(q.read)
        if (refused) {
          set((s) => ({ queue: s.queue.map((x) => (x.id === qid ? { ...x, kind: 'unit', pid, reason: refused.why } : x)) }))
          return get().say('The unit is not right, so nothing is saved. A person can type the number.')
        }
      }
      log('Patient confirmed', `${doc.who} → ${pt(pid).name} · by staff`)
      const ids = fileObs(pid, doc.id, obsOf(doc, pid, q.read, true), 'confirmed by staff')
      if (!ids) {
        set((s) => ({ queue: s.queue.map((x) => (x.id === qid ? { ...x, state: 'done', note: `Already saved for ${pt(pid).name}. Nothing was added twice.` } : x)) }))
        return
      }
      set((s) => ({
        queue: s.queue.map((x) => (x.id === qid ? { ...x, state: 'done', note: `Saved to ${pt(pid).name}` } : x)),
        docs: s.docs.map((d) => (d.id === doc.id ? { ...d, pid, isNew: true } : d)),
      }))
      log('Report saved', `${pt(pid).short} · Lab ${doc.lab} · confirmed by ${get().role === 'doc' ? 'Dr. M.' : 'K.'}`, { t: 'queue', qid, obsIds: ids, docIds: [doc.id] })
    },
    noMatch: (qid) => {
      set((s) => ({ queue: s.queue.map((x) => (x.id === qid ? { ...x, state: 'done', note: 'Not matched. None of them is right.' } : x)) }))
      log('Not matched', `Check item ${qid} · none is right`)
    },
    unitAct: (qid, how) => {
      const q = get().queue.find((x) => x.id === qid)
      if (!q) return
      set((s) => ({ queue: s.queue.map((x) => (x.id === qid ? { ...x, state: 'done', note: how === 'request' ? 'New report asked from lab' : 'Thrown away' } : x)) }))
      log(how === 'request' ? 'New report asked from lab' : 'Report thrown away', q.ex)
    },
    manualEntry: (qid, egfr, unit, uacr) => {
      const q = get().queue.find((x) => x.id === qid)!
      const doc = get().docs.find((d) => d.id === q.docId)!
      const chk = checkUnit('egfr', egfr, unit)
      if (chk.res === 'refused') return { ok: false, why: chk.why }
      let obs: Obs[]
      if (q.read) {
        const r = q.read
        const fake = { ...r, hits: { ...r.hits, egfr: { ...r.hits.egfr!, v: chk.v, printedUnit: 'mL/min/1.73 m²' }, uacr: { ...r.hits.uacr!, v: uacr, printedUnit: 'mg/g' } } }
        obs = buildObs(fake, q.pid!, doc.id, doc.d, doc.views ? 'ocr' : 'text')
      } else obs = obsFor(q.pid!, doc.d, chk.v, uacr, doc.pre!.creat, doc.id)
      const ids = fileObs(q.pid!, doc.id, obs, 'entered by staff')
      if (!ids) return { ok: false, why: 'These numbers are already saved for this patient on this date.' }
      set((s) => ({ queue: s.queue.map((x) => (x.id === qid ? { ...x, state: 'done', note: 'Typed by hand' } : x)) }))
      log('Number typed by hand', `${pt(q.pid!).short} · eGFR ${chk.v} ${chk.u} · printed value kept on the report`, { t: 'queue', qid, obsIds: ids, docIds: [doc.id] })
      return { ok: true, why: 'Filed.' }
    },

    setTour: (tour) => set({ tour }),
    setPeek: (mapPeek) => set({ mapPeek }),
    setMenu: (menu) => set({ menu }),
    setEdHint: (edHint) => set({ edHint }),
    reset: () => set({ ...fresh() }),
  }
})

export { itemsFor }
