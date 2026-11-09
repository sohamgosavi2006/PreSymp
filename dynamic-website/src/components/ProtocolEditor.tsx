import { useEffect, useMemo, useState } from 'react'
import { useCtxState } from '../hooks'
import { allItems, SHORT } from '../logic/due'
import { lastCfg, useStore } from '../store/store'
import type { Cfg } from '../store/types'
import { Human } from './ui'

const FIELDS: { k: keyof Cfg; txt: string; lo: number; hi: number }[] = [
  { k: 'panel', txt: 'Kidney test every', lo: 1, hi: 24 },
  { k: 'rptMin', txt: 'Repeat urine test: not before', lo: 1, hi: 6 },
  { k: 'rptMax', txt: 'Repeat urine test: not after', lo: 1, hi: 12 },
  { k: 'egfr2', txt: 'Repeat blood test after', lo: 1, hi: 6 },
  { k: 'fundus', txt: 'Eye test every', lo: 1, hi: 24 },
  { k: 'foot', txt: 'Foot test every', lo: 1, hi: 24 },
]

export function ProtocolEditor({ pid, onDone }: { pid?: string; onDone?: () => void }) {
  const role = useStore((s) => s.role)
  const vers = useStore((s) => s.vers)
  const ovr = useStore((s) => s.ovr)
  const hint = useStore((s) => s.edHint)
  const saveVer = useStore((s) => s.saveVer)
  const setOvr = useStore((s) => s.setOvr)
  const pts = useStore((s) => s.pts)
  const ctx = useCtxState()
  const cur = lastCfg(vers)
  const [cfg, setCfg] = useState<Cfg>(cur)
  const [why, setWhy] = useState('')
  const [mine, setMine] = useState(pid ? (ovr[pid] ?? cur.panel) : 0)
  const doc = role === 'doc'

  useEffect(() => {
    if (hint) { setCfg({ ...cur, ...hint.cfg }); setWhy(hint.reason) }
  }, [hint]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = FIELDS.filter((f) => cfg[f.k] !== cur[f.k])
  // who moves on or off the call list if this were saved
  const moves = useMemo(() => {
    const key = (i: { pid: string; key: string }) => `${i.pid}:${i.key}`
    const now = new Set(allItems(ctx).filter((i) => i.pending).map(key))
    const next = allItems({ ...ctx, cfg })
    const after = new Set(next.filter((i) => i.pending).map(key))
    return next.filter((i) => after.has(key(i)) !== now.has(key(i))).map((i) => ({ ...i, toDue: after.has(key(i)) }))
  }, [ctx, cfg])
  const on = moves.filter((m) => m.toDue)
  const off = moves.filter((m) => !m.toDue)
  const count = (l: typeof moves) => new Set(l.map((m) => m.pid)).size
  const s = (n: number) => (n === 1 ? '' : 's')
  const sum = changed.map((f) => `${f.txt}: ${cur[f.k]} → ${cfg[f.k]} months`).join('; ')
  const who = pid ? pts.find((p) => p.id === pid)!.short : ''

  return (
    <Human className="proto">
      <div className="ed">
        <div className="fields">
          {FIELDS.map((f) => (
            <label key={f.k}>
              <span>{f.txt}</span>
              <input type="number" min={f.lo} max={f.hi} value={cfg[f.k]} disabled={!doc} title={doc ? undefined : 'Doctor only'}
                onChange={(e) => setCfg({ ...cfg, [f.k]: Math.max(f.lo, Math.min(f.hi, Number(e.target.value) || f.lo)) })} />
              <small>months</small>
            </label>
          ))}
        </div>
        <div className="pv" aria-live="polite">
          <h4 className="lab">WHAT WILL CHANGE</h4>
          {!changed.length && <p>Nothing changed yet.</p>}
          {!!changed.length && !moves.length && <p>If you save: {sum}. No one's call date changes today.</p>}
          {!!moves.length && (
            <>
              <p>
                If you save: {sum}
                {on.length > 0 && <>. {count(on)} patient{s(count(on))} will go on the call list</>}
                {off.length > 0 && <>. {count(off)} patient{s(count(off))} will leave the call list</>}.
              </p>
              <ul>
                {moves.map((m) => (
                  <li key={`${m.pid}${m.key}`}>{pts.find((p) => p.id === m.pid)!.short} · {SHORT[m.key]} → {m.toDue ? 'due' : 'on file'}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        {pid && (
          <label className="ovr">
            <span>Change for {who}: kidney test every</span>
            <input type="number" min={1} max={24} value={mine} disabled={!doc} onChange={(e) => setMine(Number(e.target.value) || 1)} />
            <small>months</small>
          </label>
        )}
        <label className="reason">
          <span>Reason (you must write one)</span>
          <input type="text" value={why} disabled={!doc} onChange={(e) => setWhy(e.target.value)} placeholder="Why are you changing this?" />
        </label>
        <div className="btns">
          <button className="btn solid" disabled={!doc || !changed.length || !why.trim()} title={doc ? undefined : 'Doctor only'}
            onClick={() => { saveVer(cfg, why.trim()); setWhy(''); onDone?.() }}>
            Save as version {vers.length + 1}
          </button>
          {pid && (
            <button className="btn" disabled={!doc || !why.trim() || mine === (ovr[pid] ?? cur.panel)} title={doc ? undefined : 'Doctor only'}
              onClick={() => { setOvr(pid, mine, why.trim()); setWhy(''); onDone?.() }}>
              Change for this patient only
            </button>
          )}
          {!doc && <small className="muted">Only the doctor can change this. Press Doctor at the top.</small>}
        </div>
      </div>
    </Human>
  )
}
