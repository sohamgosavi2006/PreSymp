import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
import { groupLines, type Bit, type PageLine } from './readPdf'

// the worker is inlined, so reading works offline and in a single-file build
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

// one open document per file id. the file itself lives on the Doc, in memory only
const open = new Map<string, Promise<PDFDocumentProxy>>()

export function openPdf(id: string, file: Blob) {
  let p = open.get(id)
  if (!p) {
    // pdf.js takes ownership of the buffer it is given, so hand it a fresh one
    p = file.arrayBuffer().then((b) => pdfjs.getDocument({ data: new Uint8Array(b) }).promise)
    open.set(id, p)
  }
  return p
}

export async function extractPages(doc: PDFDocumentProxy): Promise<PageLine[][]> {
  const out: PageLine[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const bits: Bit[] = []
    for (const it of tc.items) {
      if (!('str' in it)) continue
      const t = it as TextItem
      const m = pdfjs.Util.transform(vp.transform, t.transform)
      bits.push({ str: t.str, x: m[4], y: m[5], w: t.width, h: t.height || Math.hypot(m[2], m[3]) })
    }
    out.push(groupLines(bits, n, vp.width, vp.height))
  }
  return out
}

// draw one page into a canvas at a given css width; returns the css height
export async function drawPage(doc: PDFDocumentProxy, n: number, canvas: HTMLCanvasElement, cssWidth: number, dpr = window.devicePixelRatio || 1) {
  const page = await doc.getPage(n)
  const base = page.getViewport({ scale: 1 })
  const scale = cssWidth / base.width
  const vp = page.getViewport({ scale: scale * dpr })
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${(base.height * scale).toFixed(1)}px`
  await page.render({ canvas, viewport: vp }).promise
  return base.height * scale
}

// small stable id for a file, so the same file is never saved twice
export async function hashOf(file: Blob) {
  let h = 2166136261
  for (const b of new Uint8Array(await file.arrayBuffer())) h = Math.imul(h ^ b, 16777619)
  return (h >>> 0).toString(16).padStart(8, '0') + String(file.size % 10000).padStart(4, '0')
}
