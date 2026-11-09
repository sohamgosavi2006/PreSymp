import { useEffect, useRef, useState } from 'react'
import { go } from '../hooks'
import { useStore } from '../store/store'
import { Human, Modal } from './ui'

// the five made-up samples in public/samples. each goes through the same door as a file you choose
export const SAMPLES = [
  { file: 'kabita-banerjee-text.pdf', label: 'Text PDF', note: 'ID matches, so it is saved' },
  { file: 'r-das-text.pdf', label: 'Text PDF, no ID', note: 'two possible patients, so a person chooses' },
  { file: 'm-roy-wrong-unit.pdf', label: 'Text PDF, wrong unit', note: 'eGFR in mL/min is refused' },
  { file: 'a-khan-phone-photo.jpg', label: 'Phone photo', note: 'read from the picture, unit converted' },
  { file: 'n-ghosh-scanned.pdf', label: 'Scanned PDF', note: 'no text inside, read from the picture' },
]

export function Intake() {
  const it = useStore((s) => s.intake)
  const setStep = useStore((s) => s.setStep)
  const finish = useStore((s) => s.finishIntake)
  const close = useStore((s) => s.closeIntake)
  const ingest = useStore((s) => s.ingestFile)
  const sample = useStore((s) => s.ingestSample)
  const queue = useStore((s) => s.queue)
  const pts = useStore((s) => s.pts)
  const pick = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [more, setMore] = useState(false)
  const plan = it.plan
  const n = plan?.stages.length ?? 0

  // one stage every 800 ms, driven by what was really read
  useEffect(() => {
    if (!it.open || it.status !== 'run' || !plan) return
    const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const h = setTimeout(() => (it.step < n - 1 ? setStep(it.step + 1) : finish()), quick ? 60 : 800)
    return () => clearTimeout(h)
  }, [it.open, it.status, it.step, n, plan, setStep, finish])

  if (!it.open) return null
  const q = plan && queue.find((x) => x.docId === plan.doc.id)
  const ended = it.status === 'done' || it.status === 'stop' || it.status === 'wait'
  const stopped = plan?.how === 'unit' || plan?.how === 'unread'
  const take = (f?: File) => f && ingest(f)
  const who = plan?.pid ? pts.find((p) => p.id === plan.pid)?.name : undefined
  return (
    <Modal title="Add a report" onClose={close} wide>
      {it.status === 'idle' && !plan && (
        <>
          <div
            className={`upl ${over ? 'over' : ''}`} data-testid="intake-drop"
            onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]) }}
          >
            <span>Drop a PDF or a photo of a lab report here, or</span>
            <button className="btn solid" onClick={() => pick.current?.click()}>Choose file</button>
            <input ref={pick} data-testid="intake-file" type="file" accept="application/pdf,.pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; take(f) }} />
          </div>
          {it.note && <p className="reason-line">{it.note}</p>}
          <p className="muted">The file is read inside this page. It is not uploaded and it is not stored.</p>
          <p className="lab" style={{ marginTop: 16 }}>USE A SAMPLE (all made up)</p>
          <ul className="samples">
            {SAMPLES.map((s) => (
              <li key={s.file}>
                <button className="link" data-testid={`sample-${s.file}`} onClick={() => sample(s.file)}>{s.label}</button>
                <span className="muted"> · {s.note} · </span>
                <a href={`./samples/${s.file}`} download>download</a>
              </li>
            ))}
          </ul>
          <p className="safety">If we are not sure, a person checks first.</p>
        </>
      )}
      {it.status === 'read' && (
        <div role="status" aria-live="polite">
          <p className="lead">{it.busy?.label ?? 'Reading the file…'}</p>
          <div className="meter" aria-hidden="true"><i style={{ width: `${it.busy?.pct ?? 5}%` }} /></div>
        </div>
      )}
      {plan && (
        <>
          <p className="muted" data-testid="intake-title">{plan.title}</p>
          {plan.stages.length > 0 && (
            <ol className="stepper" data-tour="stepper">
              {plan.stages.map((s, i) => (
                <li key={s} className={`proc ${i <= it.step ? 'on' : ''} ${stopped && i === n - 1 ? 'stop' : ''}`}>{s}</li>
              ))}
              {plan.last && <li className={`hum ${ended ? 'on' : ''}`}><Human>{plan.last}</Human></li>}
            </ol>
          )}
          {ended && plan.reason && plan.how !== 'dup' && <p className="reason-line" data-testid="intake-reason">{plan.reason}</p>}
          {plan.how === 'check' && ended && <p className="reason-line">How sure: {Math.round(plan.conf * 100)}%</p>}
          {it.note && <p className="reason-line">{it.note}</p>}
          <p className="safety">If we are not sure, a person checks first.</p>
          <button className="link" aria-expanded={more} onClick={() => setMore(!more)}>Details {more ? '▾' : '▸'}</button>
          {more && (
            <dl className="prov">
              <dt>Report ID</dt><dd>{plan.hash}</dd>
              <dt>Matched by</dt><dd>{plan.on || 'not matched'}</dd>
              <dt>How sure</dt><dd>{plan.conf.toFixed(2)}</dd>
              <dt>Checked by</dt><dd>{plan.how === 'clean' ? 'automatic' : q?.state === 'done' ? 'staff' : 'waiting for staff'}</dd>
            </dl>
          )}
        </>
      )}
      {ended && (
        <div className="btns">
          {plan?.how === 'clean' ? (
            <button className="btn solid" data-testid="open-patient" onClick={() => { close(); go(`#/patient/${plan.pid}`) }}>Open {who ?? 'patient'}</button>
          ) : plan?.how === 'dup' ? null : (
            <button className="btn solid" data-testid="open-queue" onClick={() => { close(); go('#/queue') }}>Open check list</button>
          )}
          <button className="btn" onClick={() => useStore.setState({ intake: { open: true, step: 0, status: 'idle' } })}>Add another</button>
          <button className="btn" onClick={close}>Close</button>
        </div>
      )}
    </Modal>
  )
}
