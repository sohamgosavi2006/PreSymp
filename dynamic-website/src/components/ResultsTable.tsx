import { useState } from 'react'
import { rowKeys, useVisits } from '../hooks'
import { fmt, fmtShort } from '../logic/dates'
import { download, toCsv, toFhir } from '../logic/exportFhir'
import { useStore } from '../store/store'
import type { Obs } from '../store/types'

const WORD = { uacr: 'UACR', egfr: 'eGFR', creat: 'Creatinine' } as const
const SHOW = 5 // newest rows shown before the "All N" toggle

export function ResultsTable({ pid, sel, onSel }: { pid: string; sel: string; onSel: (d: string) => void }) {
  const vs = useVisits(pid)
  const obs = useStore((s) => s.obs)
  const docs = useStore((s) => s.docs)
  const openSrc = useStore((s) => s.openSrc)
  const openDoc = useStore((s) => s.openDoc)
  const [all, setAll] = useState(false)
  const [cr, setCr] = useState(false)
  const rows = [...vs].reverse()
  const shown = all ? rows : rows.slice(0, SHOW)
  const find = (d: string, k: Obs['kind']) => obs.find((o) => o.pid === pid && o.d === d && o.kind === k)
  const cell = (d: string, k: Obs['kind']) => {
    const o = find(d, k)
    if (!o) return <span className="muted"> </span> // blank means not done
    return (
      <>
        <button className="val" data-testid={`val-${k}-${d}`} aria-label={`${WORD[k]} ${o.v}, open source line`} onClick={(e) => { e.stopPropagation(); onSel(d); openSrc(o) }}>{o.v}</button>
        {o.source.asPrinted && <span className="asprinted">as printed: {o.source.asPrinted.v} {o.source.asPrinted.u}</span>}
      </>
    )
  }
  const latestDoc = docs.find((d) => d.id === vs[vs.length - 1]?.doc)
  return (
    <section className="panel" aria-labelledby="rd-h" data-tour="readings">
      <h3 id="rd-h" className="lab">ALL RESULTS</h3>
      <table className="tbl reads">
        <thead>
          <tr>
            <th>Date</th><th>eGFR</th><th>UACR</th>{cr && <th>Creatinine</th>}<th>Lab</th>
            <th title="Reference range printed by the lab">Lab reference</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((v) => (
            <tr key={v.d} className={sel === v.d ? 'sel' : ''} onClick={() => onSel(v.d)} tabIndex={0} onKeyDown={(e) => rowKeys(e, () => onSel(v.d))}>
              <td title={fmt(v.d)}>
                <button className="dateb" data-testid={`date-${v.d}`} aria-label={`${fmt(v.d)}, open source report`} onClick={(e) => { e.stopPropagation(); onSel(v.d); const o = find(v.d, 'uacr'); if (o) openSrc(o) }}>{fmtShort(v.d)}</button>
                {v.via === 'ocr' && <span className="tag">scan · {Math.round((v.conf ?? 0) * 100)}%</span>}
              </td>
              <td>{cell(v.d, 'egfr')}</td>
              <td>{cell(v.d, 'uacr')}</td>
              {cr && <td>{cell(v.d, 'creat')}</td>}
              <td>Lab {v.lab}</td>
              <td className="muted">{v.lab === 'A' ? '≥90' : '>90'} / &lt;30</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="btns">
        {rows.length > SHOW && (
          <button className="btn" aria-pressed={all} onClick={() => setAll(!all)}>{all ? `Newest ${SHOW}` : `All ${rows.length}`}</button>
        )}
        <button className="btn" onClick={() => latestDoc && openDoc(latestDoc)}>Open report</button>
        <button className="btn" aria-pressed={cr} onClick={() => setCr(!cr)}>Show creatinine</button>
      </div>
      <p className="cap">Click any number to see the lab report.</p>
    </section>
  )
}

export function DownloadMenu({ pid }: { pid: string }) {
  const open = useStore((s) => s.menu)
  const setOpen = useStore((s) => s.setMenu)
  const pts = useStore((s) => s.pts)
  const obs = useStore((s) => s.obs)
  const docs = useStore((s) => s.docs)
  const log = useStore((s) => s.log)
  const say = useStore((s) => s.say)
  const go = (kind: 'csv' | 'fhir') => {
    const pt = pts.find((p) => p.id === pid)!
    const mine = obs.filter((o) => o.pid === pid)
    if (kind === 'csv') download(`kidney-map-${pid}.csv`, toCsv(pt, mine, docs), 'text/csv')
    else download(`kidney-map-${pid}-fhir.json`, JSON.stringify(toFhir(pt, mine, docs), null, 2), 'application/fhir+json')
    log('Results downloaded', `${mine.length} results for ${pt.short} · ${kind === 'csv' ? 'Excel file' : 'FHIR file'}`)
    say(`Saved ${mine.length} results for ${pt.short} on this computer.`)
    setOpen(false)
  }
  return (
    <span className="menu-wrap">
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-tour="export">Download results</button>
      {open && (
        <ul className="menu" role="menu">
          <li><button role="menuitem" onClick={() => go('fhir')}>For other software (FHIR)</button></li>
          <li><button role="menuitem" onClick={() => go('csv')}>Excel file (CSV)</button></li>
        </ul>
      )}
    </span>
  )
}
