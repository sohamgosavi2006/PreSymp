import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmt } from '../../logic/dates'
import { useStore } from '../../store/store'
import './SourceViewer.css'
import { PdfPage } from './PdfPage'
import { ReportPage } from './ReportPage'

const ZOOMS = [1, 1.5, 2] as const
const PAD = 36 // the viewer body has 18 px of padding on each side
const PAPER = 640 // widest a seeded report page is drawn at 100%

// scroll the highlight to the centre of the scroll area, across and down. no animation, so nothing jumps
function centreIn(el: HTMLElement) {
  const hit = el.querySelector<HTMLElement>('[data-hl="1"]')
  if (!hit) return false
  const a = el.getBoundingClientRect()
  const b = hit.getBoundingClientRect()
  el.scrollTop += b.top - a.top - a.height / 2 + b.height / 2
  el.scrollLeft += b.left - a.left - a.width / 2 + b.width / 2
  return true
}

export function SourceViewer() {
  const v = useStore((s) => s.viewer)
  const docs = useStore((s) => s.docs)
  const obs = useStore((s) => s.obs)
  const pts = useStore((s) => s.pts)
  const close = useStore((s) => s.closeViewer)
  const setPg = useStore((s) => s.setPg)
  const openSrc = useStore((s) => s.openSrc)
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  const [avail, setAvail] = useState(0)
  const [zoom, setZoom] = useState<number>(1)
  const dlg = useRef<HTMLElement>(null)
  const open = !!v

  useEffect(() => {
    if (!open) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [open, close])

  // focus moves into the panel when it opens and goes back to where it was when it closes
  useEffect(() => {
    if (!open) return
    const from = document.activeElement as HTMLElement | null
    dlg.current?.focus({ preventScroll: true })
    return () => { if (from?.isConnected) from.focus({ preventScroll: true }) }
  }, [open])

  useEffect(() => { if (!open) setZoom(1) }, [open])

  // how wide the page area is. a resize of the window or the panel redraws the page at the new size
  useLayoutEffect(() => {
    if (!body) return
    const read = () => setAvail(Math.max(200, body.clientWidth - PAD))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(body)
    return () => ro.disconnect()
  }, [body])

  const measured = avail > 0
  const centre = useCallback(() => { if (body) centreIn(body) }, [body])

  // a new page or a new line: put the highlight in the middle before paint. a real page does this itself once drawn
  useLayoutEffect(() => {
    if (!body || !v || !measured) return
    if (!centreIn(body)) { body.scrollTop = 0; body.scrollLeft = 0 }
  }, [body, measured, v?.docId, v?.pg, v?.ln]) // eslint-disable-line react-hooks/exhaustive-deps

  // a new zoom: the page changes size, so put the highlight back in the middle
  useLayoutEffect(() => { if (body) centreIn(body) }, [body, zoom])

  if (!v) return null
  const doc = docs.find((d) => d.id === v.docId)
  if (!doc) return null
  const o = obs.find((x) => x.id === v.obsId)
  const real = !!doc.file || !!doc.views?.length
  const title = doc.file || doc.name ? (doc.name ?? 'Uploaded report') : doc.kind === 'kidney' ? `Kidney report · Lab ${doc.lab}` : doc.kind === 'fundus' ? `Eye report · Lab ${doc.lab}` : 'Foot test report'
  const away = !!o && v.pg !== o.source.page // the value is on another page than the one shown
  const noBox = real && !!o && !away && !v.box && o.source.via !== 'seed'
  const pageW = measured ? avail : Math.max(484, window.innerWidth * 0.45 - PAD)

  let note = 'Click a number to see it here'
  let conv = ''
  let eq = ''
  if (o) {
    const how = o.source.via === 'ocr' ? `read from a photo, ${Math.round((o.source.conf ?? 0) * 100)}% sure` : 'read from the report text'
    note = `${o.v} ${o.u} · ${how}`
    if (o.source.asPrinted) conv = `as printed: ${o.source.asPrinted.v} ${o.source.asPrinted.u}`
    else if (o.kind === 'creat' && doc.lab === 'B' && !doc.file) conv = `Report says ${Math.round(o.v * 88.4)} µmol/L · saved as ${o.v.toFixed(2)} mg/dL`
    if (o.source.equation) eq = `eGFR equation: ${o.source.equation}`
  } else if (v.ln && doc.pre) note = `Report says eGFR ${doc.pre.egfr} · not saved`

  return (
    <>
      <div className="dim" onClick={close} />
      <aside className="viewer" role="dialog" aria-label="Source report" data-tour="viewer" tabIndex={-1} ref={dlg}>
        <div className="vhead">
          <div className="vrow">
            <b className="vtitle" title={title}>{title}</b>
            <button className="btn quiet" onClick={close} aria-label="Close source report">Close</button>
          </div>
          <div className="vrow">
            <span className="vmeta">Page {v.pg} of {doc.pages} · {fmt(doc.d)}</span>
            <div className="vctl">
              <div className="seg" role="group" aria-label="Zoom">
                {ZOOMS.map((z) => (
                  <button key={z} aria-pressed={zoom === z} aria-label={`Zoom ${z * 100} percent`} onClick={() => setZoom(z)}>{z * 100}%</button>
                ))}
              </div>
              <button className="btn" disabled={v.pg <= 1} onClick={() => setPg(v.pg - 1)} aria-label="Previous page">Previous</button>
              <button className="btn" disabled={v.pg >= doc.pages} onClick={() => setPg(v.pg + 1)} aria-label="Next page">Next</button>
            </div>
          </div>
        </div>
        <div className="vbody" ref={setBody} data-testid="viewer-body">
          {real ? (
            <div className="vpage" style={zoom === 1 ? { margin: '0 auto', width: pageW } : { width: pageW * zoom }}>
              <PdfPage doc={doc} pg={v.pg} box={v.box} width={pageW * zoom} onShown={centre} />
            </div>
          ) : (
            <div className="vpage" style={zoom === 1 ? { margin: '0 auto', width: Math.min(pageW, PAPER) } : { width: Math.min(pageW, PAPER), zoom }}>
              <ReportPage doc={doc} pg={v.pg} hl={v.ln} obs={obs} pts={pts} conf={o?.source.conf && Math.round(o.source.conf * 100)} />
            </div>
          )}
        </div>
        <div className="vfoot">
          <span className="vnote">{note}</span>
          {o && <span className="ok">Unit is right ✓</span>}
          {conv && <span className="conv">{conv}</span>}
          {eq && <span className="conv">{eq}</span>}
          {noBox && <span className="conv">The place of this number on the page was not saved.</span>}
          {away && o && <button className="btn quiet" onClick={() => openSrc(o)}>Back to the number, page {o.source.page}</button>}
        </div>
      </aside>
    </>
  )
}
