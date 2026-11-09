import { useState } from 'react'
import { Modal } from '../../components/ui'
import { useItemsFor } from '../../hooks'
import { TODAY } from '../../logic/dates'
import { SHORT } from '../../logic/due'
import type { Pt } from '../../store/types'
import { useStore } from '../../store/store'

// asks what was done and on which day. a person confirms, then it goes in the history
export function MarkDone({ pt, onClose }: { pt: Pt; onClose: () => void }) {
  const items = [...useItemsFor(pt.id)].sort((a, b) => Number(b.pending) - Number(a.pending) || b.days - a.days)
  const [key, setKey] = useState<string>(items[0]?.key ?? '')
  const [date, setDate] = useState(TODAY)
  const markDone = useStore((s) => s.markDone)
  const ok = Boolean(key) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= TODAY

  const confirm = () => {
    const it = items.find((i) => i.key === key)
    if (!it || !ok) return
    markDone(pt.id, it.key, date, it.label)
    useStore.getState().say(`Marked done: ${SHORT[it.key]} for ${pt.short}`)
    onClose()
  }

  return (
    <Modal title={`Mark done · ${pt.short}`} onClose={onClose}>
      {items.length === 0 ? (
        <>
          <p className="muted">Nothing to mark for this patient.</p>
          <div className="btns"><button className="btn" onClick={onClose}>Close</button></div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); confirm() }}>
          <fieldset className="radios md-what">
            <legend className="lab">What was done</legend>
            {items.map((i, n) => (
              <label key={i.key}>
                <input type="radio" name="md-what" value={i.key} checked={key === i.key} onChange={() => setKey(i.key)} autoFocus={n === 0} />
                <span><b>{SHORT[i.key]}</b> <span className="muted">{i.text}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="md-date">
            <span className="lab">Date done</span>
            <input type="date" value={date} max={TODAY} required onChange={(e) => setDate(e.target.value)} aria-label="Date done" />
          </label>
          <p className="cap">Use this when the test was done and there is no report to add. It goes in the history.</p>
          <div className="btns">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn solid" disabled={!ok}>Confirm</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
