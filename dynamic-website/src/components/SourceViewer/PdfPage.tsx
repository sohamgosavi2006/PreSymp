import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Box, Doc } from '../../store/types'

// One real page of an uploaded file: a pdf page drawn by pdf.js, or the straightened photo of a scan.
// The marker sits over it at the saved position, in percentages of the page box, so it follows zoom and resize.
// The box keeps the page's shape before anything is drawn, so nothing moves when the page appears.

const MEMORY = 'This file is no longer in memory. Add it again to see the page.'
const FAILED = 'This page could not be opened.'
const A4 = 1.414 // height over width, used only until the real page is known

type Load =
  | { s: 'loading' }
  | { s: 'gone'; msg: string }
  | { s: 'ready'; ratio: number; img?: string; pdf?: PDFDocumentProxy; painted: boolean }

type Props = {
  doc: Doc
  pg: number
  box?: Box
  width?: number // css pixels. the viewer passes the width it wants, a thumbnail passes a small one
  crop?: boolean // show only a strip of the page around the box (for small previews)
  onShown?: () => void // the page is on screen and the marker is in place
}

export function PdfPage({ doc: d, pg, box, width = 640, crop, onShown }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [load, setLoad] = useState<Load>({ s: 'loading' })
  const painted = useRef(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const shownCb = useRef(onShown)
  shownCb.current = onShown

  // strip around the box, when asked for. the page is drawn wide and this window moves over it
  const strip = crop && box ? { w: 0.8, h: 0.16 } : null
  const fullW = strip ? width / strip.w : width

  // open the file: a straightened photo for scans, otherwise the pdf itself
  useEffect(() => {
    let dead = false
    let url: string | undefined
    painted.current = false
    setLoad({ s: 'loading' })
    const pic = d.views?.[pg - 1] ?? (d.mime?.startsWith('image/') ? d.file : undefined)
    ;(async () => {
      try {
        if (pic) {
          await Promise.resolve() // a run that is cancelled at once never makes an address
          if (dead) return
          url = URL.createObjectURL(pic)
          const im = new Image()
          im.src = url
          await im.decode()
          if (!dead) setLoad({ s: 'ready', ratio: im.naturalHeight / im.naturalWidth, img: url, painted: true })
          return
        }
        if (!d.file) {
          if (!dead) setLoad({ s: 'gone', msg: MEMORY })
          return
        }
        const lib = await import('../../logic/intake/pdfLoad')
        const pdf = await lib.openPdf(d.id, d.file)
        const page = await pdf.getPage(pg)
        const vp = page.getViewport({ scale: 1 })
        if (!dead) setLoad({ s: 'ready', ratio: vp.height / vp.width, pdf, painted: false })
      } catch {
        if (!dead) setLoad({ s: 'gone', msg: FAILED })
      }
    })()
    return () => {
      dead = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [d.id, d.file, d.views, d.mime, pg])

  // draw the pdf page at the size it is shown, again when that size changes. one draw at a time,
  // into a spare canvas, so the page never blinks while it is redrawn
  const pdf = load.s === 'ready' ? load.pdf : undefined
  useEffect(() => {
    if (!pdf) return
    let dead = false
    const t = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (dead) return
        try {
          const lib = await import('../../logic/intake/pdfLoad')
          const spare = document.createElement('canvas')
          const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3000 / fullW))
          await lib.drawPage(pdf, pg, spare, fullW, dpr)
          const c = cv.current
          if (dead || !c) return
          c.width = spare.width
          c.height = spare.height
          c.getContext('2d')?.drawImage(spare, 0, 0)
          painted.current = true
          setLoad((l) => (l.s === 'ready' && l.pdf === pdf && !l.painted ? { ...l, painted: true } : l))
        } catch {
          if (!dead && !painted.current) setLoad({ s: 'gone', msg: FAILED })
        }
      })
    }, painted.current ? 140 : 0)
    return () => {
      dead = true
      clearTimeout(t)
    }
  }, [pdf, pg, Math.round(fullW)]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = load.s === 'ready' && load.painted
  useEffect(() => {
    if (shown && !crop) shownCb.current?.()
  }, [shown, crop, pg, d.id, box?.[0], box?.[1], box?.[2], box?.[3]]) // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = load.s === 'ready' ? load.ratio : A4
  const fullH = fullW * ratio
  const live = !crop // only the page in the viewer carries the test hooks the tour and tests look for

  const page = (
    <div
      className="pdfpage"
      data-testid={live ? 'pdf-page' : undefined}
      style={{
        width: fullW, height: fullH,
        ...(strip && box ? { position: 'absolute', left: -Math.min(Math.max(box[0] + box[2] / 2 - strip.w / 2, 0), 1 - strip.w) * fullW, top: -Math.min(Math.max(box[1] + box[3] / 2 - strip.h / 2, 0), 1 - strip.h) * fullH } : {}),
      }}
    >
      {load.s === 'ready' && load.img && (
        <img className="pdfcv" src={load.img} alt={`Page ${pg} of the uploaded report`} data-testid={live ? 'doc-image' : undefined} draggable={false} />
      )}
      {load.s === 'ready' && load.pdf && (
        <canvas ref={cv} className="pdfcv" data-testid={live ? 'pdf-canvas' : undefined} role="img" aria-label={`Page ${pg} of the uploaded report`} style={{ visibility: load.painted ? 'visible' : 'hidden' }} />
      )}
      {!shown && load.s !== 'gone' && <div className="pgmsg" role="status">Opening the page…</div>}
      {load.s === 'gone' && <div className="pgmsg err" role="status">{load.msg}</div>}
      {shown && box && (
        <div
          className="pdfhl"
          data-hl={live ? '1' : undefined}
          data-testid={live ? 'doc-hl' : undefined}
          style={{
            left: `calc(${box[0] * 100}% - 3px)`, top: `calc(${box[1] * 100}% - 2px)`,
            width: `calc(${box[2] * 100}% + 6px)`, height: `calc(${box[3] * 100}% + 4px)`,
          }}
        >
          {live && <span className="pdfhl-in" data-testid="pdf-hl" />}
        </div>
      )}
    </div>
  )

  if (!strip) return page
  return <div className="pdfstrip" style={{ width, height: strip.h * fullH }}>{page}</div>
}
