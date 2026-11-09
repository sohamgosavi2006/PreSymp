import { useMemo, useState } from 'react'
import { Status } from '../components/ui'
import { go, useAllItems } from '../hooks'
import { fmtMonth } from '../logic/dates'
import { SHORT } from '../logic/due'
import { useStore } from '../store/store'
import { MarkDone } from './Today/MarkDone'
import './Today/Today.css'

type Filter = 'all' | 'new' | 'call' | 'check' | 'none'
type Sort = 'token' | 'wait'

export function Day() {
  const pts = useStore((s) => s.pts)
  const docs = useStore((s) => s.docs)
  const obs = useStore((s) => s.obs)
  const queue = useStore((s) => s.queue)
  const openIntake = useStore((s) => s.openIntake)
  const openDoc = useStore((s) => s.openDoc)
  const setSelDue = useStore((s) => s.setSelDue)
  const items = useAllItems()
  const [f, setF] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('token')
  const [marking, setMarking] = useState<string | null>(null)

  const rows = useMemo(() => {
    const open = queue.filter((q) => q.state === 'open')
    return pts.map((p) => {
      const todo = items.filter((i) => i.pid === p.id && i.pending).sort((a, b) => b.days - a.days)
      const dates = [...new Set(obs.filter((o) => o.pid === p.id && o.kind === 'uacr').map((o) => o.d))].sort()
      const mine = docs.filter((d) => d.pid === p.id).sort((a, b) => b.d.localeCompare(a.d))
      return {
        p, top: todo[0], n: dates.length, from: dates[0], to: dates[dates.length - 1], latest: mine[0],
        isNew: mine.some((d) => d.isNew),
        // tied to an open To check item, by the patient it names or by any of its candidates
        check: open.some((q) => q.pid === p.id || q.cands?.some((c) => c.pid === p.id)),
      }
    })
  }, [pts, items, docs, obs, queue])

  // token order is what the front desk sees at the door. a new report is marked, not moved up
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sort === 'wait' ? (b.top?.days ?? -1) - (a.top?.days ?? -1) : 0) || a.p.token - b.p.token),
    [rows, sort],
  )
  const count = {
    new: rows.filter((r) => r.isNew).length,
    call: rows.filter((r) => r.top).length,
    check: rows.filter((r) => r.check).length,
    none: rows.filter((r) => !r.top).length,
  }
  const open = queue.filter((q) => q.state === 'open').length
  const shown = sorted.filter((r) => f === 'all' || (f === 'new' ? r.isNew : f === 'call' ? r.top : f === 'check' ? r.check : !r.top))
  const toCall = items.filter((i) => i.pending).length
  const chip = (k: Filter, text: string, n?: number) => (
    <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(f === k ? 'all' : k)}>{text}{n !== undefined ? ` (${n})` : ''}</button>
  )
  const markPt = marking ? pts.find((p) => p.id === marking) : undefined

  return (
    <div className="page">
      <h1>Today</h1>
      <p className="lead">
        Thursday 18 Dec 2025 · <b>{pts.length}</b> patients · <b>{toCall}</b> to call · <b>{count.new}</b> new report{count.new === 1 ? '' : 's'} · <b>{open}</b> to check
      </p>
      <div className="btns" style={{ marginTop: 0 }}>
        <button className="btn" onClick={openIntake} data-testid="add-report">Try adding a report</button>
      </div>
      <div className="chips tday-bar">
        <div className="chips-in" role="group" aria-label="Show">
          {chip('all', 'All', rows.length)}
          {chip('new', 'New report', count.new)}
          {chip('call', 'To call', count.call)}
          {chip('check', 'To check', count.check)}
          {chip('none', 'Nothing due', count.none)}
        </div>
        <div className="tday-sort">
          <span className="lab">Sort</span>
          <div className="seg" role="group" aria-label="Sort by">
            <button aria-pressed={sort === 'token'} onClick={() => setSort('token')}>Token order</button>
            <button aria-pressed={sort === 'wait'} onClick={() => setSort('wait')}>Longest waiting</button>
          </div>
        </div>
      </div>
      <div className="daylist tday" data-tour="daylist" role="table" aria-label="Patients today">
        <div className="drow head trow" role="row">
          <span role="columnheader">Token</span>
          <span role="columnheader">Patient</span>
          <span role="columnheader">New</span>
          <span role="columnheader">To do</span>
          <span role="columnheader">Tests done</span>
          <span role="columnheader">Actions</span>
        </div>
        {shown.length === 0 && <div className="tday-empty" role="row"><span className="muted" role="cell">No patients in this group.</span></div>}
        {shown.map(({ p, isNew, top, n, from, to, latest }) => (
          <div
            key={p.id} className="drow trow" role="row" data-pid={p.id}
            onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) go(`#/patient/${p.id}`) }}
          >
            <span role="cell" className="tk"><b>{p.token}</b></span>
            <span role="cell" className="who">
              <a href={`#/patient/${p.id}`}><b>{p.short}</b></a>
              <small>{p.id} · {p.age} {p.sex}</small>
              <small>{p.phone}</small>
            </span>
            <span role="cell">{isNew ? <Status kind="sq">New report</Status> : <span className="muted">—</span>}</span>
            <span role="cell">
              {top ? (
                <>
                  <b>{SHORT[top.key]}</b>
                  <Status kind={top.mark === 'pill' ? 'pill' : 'dot'}>waiting since {top.since}</Status>
                </>
              ) : (
                <span className="nothing">Nothing to do.</span>
              )}
            </span>
            <span role="cell" className="muted tests">
              {n} kidney test{n === 1 ? '' : 's'}
              {n > 0 && <small>{fmtMonth(from)} to {fmtMonth(to)}</small>}
            </span>
            <span role="cell" className="acts">
              <button
                className="btn sm" disabled={!latest} title={latest ? undefined : 'No report on file'}
                aria-label={`Review report for ${p.short}`} onClick={() => latest && openDoc(latest)}
              >Review report</button>
              <button className="btn sm" aria-label={`Mark done for ${p.short}`} onClick={() => setMarking(p.id)}>Mark done</button>
              <button
                className="btn sm" disabled={!top} title={top ? undefined : 'Nothing due'}
                aria-label={`Prepare reminder for ${p.short}`}
                onClick={() => { if (top) { setSelDue(`${p.id}:${top.key}`); go('#/due') } }}
              >Prepare reminder</button>
            </span>
          </div>
        ))}
      </div>
      {markPt && <MarkDone pt={markPt} onClose={() => setMarking(null)} />}
    </div>
  )
}
