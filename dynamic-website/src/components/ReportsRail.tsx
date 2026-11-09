import { Fragment, useMemo, useRef, useState } from 'react'
import { fmtShort } from '../logic/dates'
import { findInReports, matchedTerms } from '../logic/search'
import { useStore } from '../store/store'
import type { Doc } from '../store/types'
import { Status } from './ui'

export const docName = (d: Doc) =>
  d.kind === 'fundus' ? 'Eye report' : d.kind === 'foot' ? 'Foot test report' : `Kidney test, Lab ${d.lab}${d.scan ? ' (scanned)' : ''}${d.file ? (d.views ? ' (added photo)' : ' (added PDF)') : ''}`

// mark the words that matched (the query words and their synonyms) with the soft teal tint
function marked(text: string, q: string) {
  const terms = matchedTerms(q, text)
  if (!terms.length) return text
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)
  const re = new RegExp(`(${terms.map(esc).join('|')})`, 'ig')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))
}

type Type = 'all' | 'kidney' | 'fundus' | 'foot'
const TYPES: { k: Type; text: string }[] = [
  { k: 'all', text: 'All' }, { k: 'kidney', text: 'Kidney' }, { k: 'fundus', text: 'Eye' }, { k: 'foot', text: 'Foot' },
]

export function ReportsRail({ pid }: { pid: string }) {
  const docs = useStore((s) => s.docs)
  const obs = useStore((s) => s.obs)
  const pts = useStore((s) => s.pts)
  const q = useStore((s) => s.findQ)
  const setQ = useStore((s) => s.setFindQ)
  const openDoc = useStore((s) => s.openDoc)
  const openAt = useStore((s) => s.openAt)
  const openIntake = useStore((s) => s.openIntake)
  const ingest = useStore((s) => s.ingestFile)
  const pick = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<Type>('all')
  const [over, setOver] = useState(false)
  const mine = docs.filter((d) => d.pid === pid).sort((a, b) => b.d.localeCompare(a.d))
  const shown = type === 'all' ? mine : mine.filter((d) => d.kind === type)
  const count = (k: Type) => (k === 'all' ? mine.length : mine.filter((d) => d.kind === k).length)
  const found = useMemo(() => findInReports(q, pid, docs, obs, pts), [q, pid, docs, obs, pts])
  return (
    <aside className="panel rail" aria-labelledby="doc-h">
      <h3 id="doc-h" className="lab">REPORTS</h3>
      <div className="find" role="search" data-tour="find">
        <input type="search" aria-label="Find in reports" placeholder="Find in reports" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && found[0]) openAt({ docId: found[0].docId, pg: found[0].page, ln: found[0].ln, box: found[0].box }) }} />
      </div>
      {q.trim() && (
        <>
          <ul className="found" aria-label="Search results" data-testid="found">
            {found.length === 0 && <li><span className="muted" style={{ padding: 10, display: 'block' }}>No line in this patient's reports mentions '{q.trim()}'.</span></li>}
            {found.slice(0, 40).map((f, i) => (
              <li key={i}>
                <button onClick={() => openAt({ docId: f.docId, pg: f.page, ln: f.ln, box: f.box })}>
                  <small>{f.docLabel} · {f.lab} · {fmtShort(f.d)} · page {f.page}</small>
                  {marked(f.text, q)}
                </button>
              </li>
            ))}
          </ul>
          {found.length > 40 && <p className="cap">Showing the first 40 of {found.length} lines.</p>}
        </>
      )}
      <div className="chips small" role="group" aria-label="Report type">
        {TYPES.map((t) => <button key={t.k} className="chip" aria-pressed={type === t.k} onClick={() => setType(t.k)}>{t.text} ({count(t.k)})</button>)}
      </div>
      <ul>
        {shown.length === 0 && <li><span className="muted">No {type === 'fundus' ? 'eye' : type} reports on file.</span></li>}
        {shown.map((d) => (
          <li key={d.id}>
            <button onClick={() => openDoc(d)}>
              <span className="muted">{fmtShort(d.d)}</span> · {docName(d)}
              {d.isNew && <Status kind="sq">new</Status>}
            </button>
          </li>
        ))}
      </ul>
      <button
        className={`drop ${over ? 'over' : ''}`} data-testid="rail-drop"
        onClick={() => pick.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) ingest(f) }}
      >
        Drop a PDF or a photo of a report here, or choose a file.
      </button>
      <input ref={pick} type="file" accept="application/pdf,.pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ingest(f) }} />
      <p className="cap">The file is read in this page. It is not uploaded. <button className="link" onClick={openIntake}>Use a sample</button></p>
    </aside>
  )
}
