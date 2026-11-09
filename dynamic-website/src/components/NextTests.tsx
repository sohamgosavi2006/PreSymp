import { useState } from 'react'
import { useItemsFor } from '../hooks'
import { fmt, fmtMonth } from '../logic/dates'
import { SHORT, type Item } from '../logic/due'
import { useStore } from '../store/store'
import { ProtocolEditor } from './ProtocolEditor'
import { Modal, Status } from './ui'

// late = solid pill, soon = dot, later = ring, nothing to do = plain muted text
export const mark = (i: Item) => <Status kind={i.mark}>{i.text}</Status>

// words for one check, e.g. "Done 18 Sep 2025 · next Mar 2026", "Waiting since 2 months", "Not on file"
function words(i: Item): string {
  if (i.pending) return i.days === 0 ? 'Due today' : `Waiting since ${i.since}`
  if (i.text.startsWith('done')) return `Done ${i.text.slice(6)}`
  if (i.last) return `Done ${fmt(i.last)} · next ${fmtMonth(i.due!)}`
  return `Next ${fmtMonth(i.due!)}`
}

// the one-row strip above the fold. the three standing checks always show; the repeat checks show when they apply
export function NextStrip({ pid }: { pid: string }) {
  const items = useItemsFor(pid)
  const standing = (['panel', 'fundus', 'foot'] as const).map((k) => items.find((i) => i.key === k) ?? k)
  const extra = items.filter((i) => i.key === 'rpt' || i.key === 'egfr2')
  const cells = [standing[0], ...extra, standing[1], standing[2]]
  const none = !items.some((i) => i.pending)
  return (
    <section className="strip" aria-labelledby="ns-h" data-tour="followup">
      <h3 id="ns-h" className="lab">NEXT TESTS</h3>
      <ul>
        {cells.map((c) =>
          typeof c === 'string' ? (
            <li key={c}><b>{SHORT[c]}</b><Status kind="hollow">Not on file</Status></li>
          ) : (
            <li key={c.key}><b>{SHORT[c.key]}</b><Status kind={c.mark}>{words(c)}</Status></li>
          ),
        )}
      </ul>
      {none && <span className="nothing">Nothing to do.</span>}
    </section>
  )
}

// the full schedule, with the call-list and doctor actions, below the fold
export function Schedule({ pid }: { pid: string }) {
  const items = useItemsFor(pid)
  const role = useStore((s) => s.role)
  const add = useStore((s) => s.addForced)
  const [key, setKey] = useState<Item['key']>('panel')
  const [edit, setEdit] = useState(false)
  return (
    <section className="panel" aria-labelledby="fu-h">
      <h3 id="fu-h" className="lab">SCHEDULE</h3>
      <table className="tbl">
        <thead><tr><th>Test</th><th>How often</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.key}>
              <td>{i.label}</td>
              <td>{i.every}{i.extra && i.key === 'panel' ? ` · ${i.extra}` : ''}</td>
              <td>{mark(i)}{i.extra && i.key !== 'panel' && <span className="muted"> · {i.extra}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="btns">
        <select aria-label="Test to add" value={key} onChange={(e) => setKey(e.target.value as Item['key'])}>
          {items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
        </select>
        <button className="btn" onClick={() => add(pid, key)}>Add to call list</button>
        <button className="btn" disabled={role !== 'doc'} title={role !== 'doc' ? 'Doctor only' : undefined} onClick={() => setEdit(true)}>Change schedule</button>
      </div>
      {edit && (
        <Modal title="Change schedule" onClose={() => setEdit(false)} wide>
          <ProtocolEditor pid={pid} onDone={() => setEdit(false)} />
        </Modal>
      )}
    </section>
  )
}
