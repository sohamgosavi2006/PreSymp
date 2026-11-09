import { useEffect, useState } from 'react'
import { PdfPage } from '../components/SourceViewer/PdfPage'
import { ReportPage } from '../components/SourceViewer/ReportPage'
import { Human } from '../components/ui'
import { fmt } from '../logic/dates'
import { UNIT } from '../logic/units'
import { useStore } from '../store/store'
import type { Doc, Hit, QItem } from '../store/types'

function useBlobUrl(b?: Blob) {
  const [u, setU] = useState('')
  useEffect(() => {
    if (!b) return setU('')
    const url = URL.createObjectURL(b)
    setU(url)
    return () => URL.revokeObjectURL(url)
  }, [b])
  return u
}

// the line of a photo that a number came from, cut out of the picture
function Crop({ doc, hit }: { doc: Doc; hit: Hit }) {
  const url = useBlobUrl(doc.views?.[hit.page - 1])
  const [nat, setNat] = useState<[number, number] | null>(null)
  if (!url) return null
  const [x, y, w, h] = hit.bbox
  // widen the cut a little so the label and the unit are in it
  const px = Math.max(0, x - 0.02), pw = Math.min(1 - px, w + 0.04)
  const py = Math.max(0, y - h * 0.4), ph = Math.min(1 - py, h * 1.8)
  const W = 420
  const H = nat ? W * (ph / pw) * (nat[1] / nat[0]) : 56
  return (
    <div className="crop" style={{ width: W, height: H }} data-testid="crop" aria-label={`The line the number was read from: ${hit.line}`} role="img">
      <img
        src={url} alt="" onLoad={(e) => setNat([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
        style={{ width: `${100 / pw}%`, marginLeft: `${(-px / pw) * 100}%`, marginTop: nat ? `${(-py / pw) * (nat[1] / nat[0]) * 100}%` : 0 }}
      />
    </div>
  )
}

const KIND = { egfr: 'eGFR', uacr: 'UACR', creat: 'Creatinine' } as const

function Item({ q }: { q: QItem }) {
  const docs = useStore((s) => s.docs)
  const obs = useStore((s) => s.obs)
  const pts = useStore((s) => s.pts)
  const confirm = useStore((s) => s.confirmMatch)
  const none = useStore((s) => s.noMatch)
  const act = useStore((s) => s.unitAct)
  const manual = useStore((s) => s.manualEntry)
  const openDoc = useStore((s) => s.openDoc)
  const doc = docs.find((d) => d.id === q.docId)!
  const [form, setForm] = useState(false)
  const [egfr, setEgfr] = useState('')
  const [unit, setUnit] = useState(UNIT.egfr)
  const [uacr, setUacr] = useState(String(doc.pre?.uacr ?? q.read?.hits.uacr?.v ?? ''))
  const [err, setErr] = useState('')
  const open = q.state === 'open'
  const cands = q.cands ?? []
  // a reading that is not sure, with the patient already known: the person confirms the numbers
  const pid = q.pid ?? (q.kind === 'check' && cands.length === 1 ? cands[0].pid : undefined)
  const who = pid ? pts.find((p) => p.id === pid) : undefined
  const showOn = () => useStore.setState({ viewer: { docId: doc.id, pg: q.read?.hits.egfr?.page ?? 1, ln: 'egfr', box: q.read?.hits.egfr?.bbox } })
  const title = q.kind === 'match' ? 'We are not sure which patient this is' : q.kind === 'unit' ? 'The unit on this report is wrong' : q.kind === 'check' ? 'We are not sure about these numbers' : 'We could not read this report'
  const hits = q.read ? (['egfr', 'uacr', 'creat'] as const).map((k) => q.read!.hits[k]).filter((h): h is Hit => !!h) : []
  const worst = hits.filter((h) => h.conf !== undefined).sort((a, b) => a.conf! - b.conf!)[0]
  const pick = (
    <>
      <ul className="cands">
        {cands.map((c) => {
          const p = pts.find((x) => x.id === c.pid)!
          return (
            <li key={c.pid}>
              <span><b>{p.name}</b> · {p.age} {p.sex} · {p.id}{c.why && <small className="why">{c.why}</small>}</span>
              <span className="muted">How sure: {Math.round(c.conf * 100)}%</span>
              <Human className="small"><button className="btn" data-testid={`save-to-${p.id}`} onClick={() => confirm(q.id, c.pid)}>Save to this patient</button></Human>
            </li>
          )
        })}
      </ul>
      <button className="btn quiet" data-testid="none-of-these" onClick={() => none(q.id)}>None of these</button>
    </>
  )
  return (
    <article className={`qitem ${open ? '' : 'resolved'}`} data-tour={q.kind === 'match' ? 'qmatch' : undefined} data-testid={`queue-${q.id}`}>
      <div className="thumb" aria-hidden="true">
        {doc.file ? <PdfPage doc={doc} pg={1} width={160} /> : (
          <div className="thumb-in"><ReportPage doc={doc} pg={1} obs={obs} pts={pts} hl={q.kind === 'unit' ? 'egfr' : undefined} /></div>
        )}
      </div>
      <div className="qbody">
        <h3>{title}</h3>
        <p className="muted">Found on report: {q.ex} · Lab {doc.lab} · {fmt(doc.d)}</p>
        {!open && <p className="calm">{q.note}</p>}
        {open && q.reason && <p data-testid="queue-reason">{q.reason}</p>}

        {open && q.kind === 'check' && (
          <>
            {worst && <p className="how" data-testid="how-sure">How sure: {Math.round(worst.conf! * 100)}%</p>}
            {worst && <Crop doc={doc} hit={worst} />}
            <ul className="reads-list">
              {hits.map((h) => (
                <li key={h.kind}><b>{KIND[h.kind]}</b> {h.v} {h.printedUnit || 'no unit'}{h.conf !== undefined && <span className="muted"> · {Math.round(h.conf * 100)}% sure</span>}</li>
              ))}
            </ul>
          </>
        )}

        {open && (q.kind === 'match' || (q.kind === 'check' && !pid) || (q.kind === 'unit' && !q.pid)) && cands.length > 0 && pick}
        {open && (q.kind === 'match' || (q.kind === 'check' && !pid)) && cands.length === 0 && (
          <>
            <p>No patient in this clinic matches the name on the report.</p>
            <button className="btn quiet" data-testid="none-of-these" onClick={() => none(q.id)}>None of these</button>
          </>
        )}

        {open && q.kind === 'unread' && (
          <div className="btns">
            <Human className="small">
              <button className="btn" onClick={() => act(q.id, 'request')}>Ask lab for a new report</button>
              <button className="btn" onClick={() => act(q.id, 'discard')}>Throw away</button>
            </Human>
          </div>
        )}

        {open && ((q.kind === 'unit' && q.pid) || (q.kind === 'check' && pid)) && (
          <>
            <div className="btns">
              <button className="btn" onClick={showOn}>Show on report</button>
              <Human className="small">
                {q.kind === 'check' && who && <button className="btn solid" data-testid={`save-to-${who.id}`} onClick={() => confirm(q.id, who.id)}>Save these numbers to {who.name}</button>}
                {q.kind === 'unit' && <button className="btn" onClick={() => act(q.id, 'request')}>Ask lab for a new report</button>}
                <button className="btn" onClick={() => setForm(!form)}>Type the number</button>
                <button className="btn" onClick={() => act(q.id, 'discard')}>Throw away</button>
              </Human>
            </div>
            {form && (
              <form className="mini" onSubmit={(e) => { e.preventDefault(); const r = manual(q.id, Number(egfr), unit, Number(uacr)); setErr(r.ok ? '' : r.why) }}>
                <label>Blood test (eGFR) <input type="number" required value={egfr} onChange={(e) => setEgfr(e.target.value)} /></label>
                <label>unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option>{UNIT.egfr}</option><option>mL/min</option></select></label>
                <label>Urine test (UACR) mg/g <input type="number" required value={uacr} onChange={(e) => setUacr(e.target.value)} /></label>
                <button className="btn solid" type="submit">Save number</button>
                {err && <p className="reason-line">{err}</p>}
              </form>
            )}
          </>
        )}
        <button className="link" onClick={() => openDoc(doc)}>Open report</button>
      </div>
    </article>
  )
}

export function Queue() {
  const queue = useStore((s) => s.queue)
  const openIntake = useStore((s) => s.openIntake)
  const open = queue.filter((q) => q.state === 'open')
  const done = queue.filter((q) => q.state === 'done')
  return (
    <div className="page">
      <h1>To check ({open.length})</h1>
      <p className="lead">These reports need a person to check them.</p>
      <div className="btns" style={{ marginTop: 0 }}><button className="btn" onClick={openIntake}>Try adding a report</button></div>
      {open.length === 0 && <p className="calm">Nothing to check.</p>}
      {open.map((q) => <Item key={q.id} q={q} />)}
      {done.length > 0 && <h2 className="sub-h">Done today</h2>}
      {done.map((q) => <Item key={q.id} q={q} />)}
    </div>
  )
}
