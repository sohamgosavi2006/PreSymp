// The tesseract.js worker. Loaded only when a photo or a scan is read. Everything it needs is served
// from this site (public/tesseract): the worker script, the core and the English data. No network.
import type { Worker as TessWorker } from 'tesseract.js'
import { meanConf, type OcrWord } from './words'

const IDLE_MS = 60_000

let worker: Promise<TessWorker> | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined
let onFrac: ((f: number) => void) | null = null
let queue: Promise<unknown> = Promise.resolve()

const base = () => new URL('tesseract/', document.baseURI).href

async function create(): Promise<TessWorker> {
  const mod = (await import('tesseract.js')) as unknown as {
    createWorker?: typeof import('tesseract.js').createWorker
    default?: { createWorker: typeof import('tesseract.js').createWorker }
  }
  const createWorker = mod.createWorker ?? mod.default!.createWorker
  const dir = base()
  const w = await createWorker('eng', 1, {
    workerPath: `${dir}worker.min.js`,
    corePath: dir, // a folder: the worker picks the right core file for this browser
    langPath: dir,
    gzip: true,
    cacheMethod: 'none', // nothing is stored in the browser
    logger: (m: Record<string, unknown>) => {
      // the share done (0 to 1) arrives under tesseract's own field name
      const part = Object.entries(m).find(([k]) => k.startsWith('prog'))?.[1]
      if (m.status === 'recognizing text' && typeof part === 'number') onFrac?.(part)
    },
    errorHandler: () => {},
  })
  await w.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' })
  return w
}

// one worker for every file; it is closed after a minute of nothing to do
function acquire(): Promise<TessWorker> {
  clearTimeout(idleTimer)
  if (!worker) {
    worker = create().catch((e) => {
      worker = null
      throw e
    })
  }
  return worker
}

function later() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => void shutdown(), IDLE_MS)
}

export async function shutdown(): Promise<void> {
  clearTimeout(idleTimer)
  const w = worker
  worker = null
  if (w) {
    try {
      await (await w).terminate()
    } catch {
      /* already gone */
    }
  }
}

export type Reading = { words: OcrWord[]; conf: number }

type Block = { paragraphs?: { lines?: { words?: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }

// read one page image. `frac` is called with 0 to 1 while it reads. Jobs run one at a time.
export function readImage(image: Blob, psm: string, frac?: (f: number) => void, whitelist = ''): Promise<Reading> {
  const job = queue.then(async () => {
    const w = await acquire()
    onFrac = frac ?? null
    try {
      await w.setParameters({ tessedit_pageseg_mode: psm as never, tessedit_char_whitelist: whitelist })
      const { data } = await w.recognize(image, {}, { blocks: true, text: false })
      const words: OcrWord[] = []
      for (const b of (data.blocks ?? []) as Block[])
        for (const p of b.paragraphs ?? [])
          for (const l of p.lines ?? [])
            for (const t of l.words ?? [])
              if (t.text.trim()) words.push({ text: t.text.trim(), conf: t.confidence, x0: t.bbox.x0, y0: t.bbox.y0, x1: t.bbox.x1, y1: t.bbox.y1 })
      frac?.(1)
      return { words, conf: meanConf(words) }
    } finally {
      onFrac = null
      later()
    }
  })
  queue = job.catch(() => undefined)
  return job
}
