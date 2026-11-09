import type { ReactNode } from 'react'
import { fmt } from '../../logic/dates'
import { accession, noteLines, pagesOf, type Sec } from '../../logic/reportLines'
import type { Doc, Obs, Pt } from '../../store/types'

type Wrap = (text: string, id: string, part: 'test' | 'res') => ReactNode

function TableSecs({ secs, hl, w }: { secs: Sec[]; hl?: string; w: Wrap }) {
  return (
    <>
      {secs.map((s) => (
        <section className="rsec" key={s.title}>
          <h4>{s.title}</h4>
          <table>
            <thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference range</th></tr></thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id} data-ln={l.id} data-hl={l.id === hl ? '1' : undefined} className={l.id === hl ? 'hl' : ''}>
                  <td>{w(l.test, l.id, 'test')}</td>
                  <td className="r">{w(l.res, l.id, 'res')}</td>
                  <td>{l.unit}</td>
                  <td>{l.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}

// lab B: two columns, unit first, range in brackets
function BracketSecs({ secs, hl, w }: { secs: Sec[]; hl?: string; w: Wrap }) {
  return (
    <div className="two">
      {secs.map((s) => (
        <section className="rsec" key={s.title}>
          <h4>{s.title}</h4>
          {s.lines.map((l) => (
            <div key={l.id} data-ln={l.id} data-hl={l.id === hl ? '1' : undefined} className={`brow ${l.id === hl ? 'hl' : ''}`}>
              <span className="bu">{l.unit || '·'}</span>
              <span className="bt">{w(l.test, l.id, 'test')}</span>
              <span className="br">{w(l.res, l.id, 'res')}</span>
              <span className="bf">{l.ref ? `[${l.ref}]` : ''}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

// a scanned page: every word gets a thin box, only the clicked value gets the highlight
function ocrWrap(doc: Doc, hl: string | undefined, conf?: number): Wrap {
  return (text, id, part) => {
    if (!doc.scan) return text
    const hit = id === hl && part === 'res'
    const c = hit && conf ? conf : 90 + ((text.length * 7 + id.length * 3) % 10)
    return <span className={`ocr ${hit ? 'ocr-hit' : ''}`} data-tip={`Read from scan: "${text}" · ${c}% sure`}>{text}</span>
  }
}

export function ReportPage({ doc, pg, hl, obs, pts, conf, secs: only }: { doc: Doc; pg: number; hl?: string; obs: Obs[]; pts: Pt[]; conf?: number; secs?: Sec[] }) {
  const pt = pts.find((p) => p.id === doc.pid)
  const ageSex = pt ? `${pt.age} / ${pt.sex}` : (doc.ageSex ?? 'not printed')
  const lab = doc.lab === 'A' ? 'Lab A · Sample Pathology Pvt Ltd' : 'Lab B · Example Laboratory Services'
  const note = doc.kind !== 'kidney'
  const w = ocrWrap(doc, hl, conf)
  const secs = note ? [] : (only ?? pagesOf(doc, obs)[pg - 1] ?? [])
  return (
    <article className={`paper lab${doc.lab} ${doc.scan ? 'scan' : ''}`} aria-label={`${lab}, page ${pg}`}>
      <header className="rhead">
        <div>
          <div className="rtitle">{note ? (doc.kind === 'fundus' ? 'Lab B · Eye Clinic (fictional)' : 'Demo Diabetes Clinic · record') : lab}</div>
          <p>12 Sample Road, Kolkata 700000 (fictional)</p>
        </div>
        <dl>
          <dt>Accession</dt><dd>{accession(doc)}</dd>
          <dt>Collected</dt><dd>{fmt(doc.d)}</dd>
          <dt>Reported</dt><dd>{fmt(doc.d)}</dd>
        </dl>
      </header>
      <div className="rpat">
        <span>Patient: <b>{doc.who}</b></span>
        <span>Age / Sex: {ageSex}</span>
        <span>ID: {doc.pid || 'not printed'}</span>
        <span>Page {pg} of {doc.pages}</span>
      </div>
      {note ? (
        <section className="rsec">
          <h4>{doc.kind === 'fundus' ? 'Eye test' : 'Foot test'}</h4>
          {noteLines(doc).map((l) => (
            <div className="brow note" key={l.id}><span className="bt">{l.test}</span><span className="br">{l.res}</span></div>
          ))}
        </section>
      ) : (
        <>
          {doc.lab === 'A' ? <TableSecs secs={secs} hl={hl} w={w} /> : <BracketSecs secs={secs} hl={hl} w={w} />}
          {(pg === 3 || only) && (
            <footer className="rfoot">
              <p>Reference ranges are from this lab.</p>
              <p>This is a sample report.</p>
              <p>— End of report —</p>
            </footer>
          )}
        </>
      )}
      {doc.scan && (
        <svg className="grain" aria-hidden="true">
          <filter id="grn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#grn)" />
        </svg>
      )}
    </article>
  )
}
