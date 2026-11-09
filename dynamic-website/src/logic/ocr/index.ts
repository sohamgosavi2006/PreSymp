// Reads phone photos and image-only PDFs with tesseract.js, fully in the browser.
// The page picture is cleaned and stood straight, tesseract reads that same picture, and the words
// become the same lines pdf.js gives, so one parser (readReport) reads both. The straightened pictures
// are kept as the page views, so every box lines up with what the viewer shows.
import { planFor } from '../intake/ingest'
import { readReport } from '../intake/readPdf'
import { UNREAD, type Ingest, type IntakeEnv, type IntakeResult } from '../intake/types'
import type { PageText, Read } from '../../store/types'
import { chooseOrientation, estimateTurn, type Trial } from './geometry'
import { readImage, shutdown, type Reading } from './engine'
import { canvasOf, closeUp, cropPage, darkPoints, decode, edgeGrey, enlarge, flatten, grayOf, resize, tick, toPng, turn, type Gray } from './preprocess'
import { attachConf, checkedConf, firstNumber, linesFromWords, locate } from './words'
import type { PageLine } from '../intake/readPdf'

const LIMIT_MS = 90_000
const PSMS = ['6', '4', '11'] // single block first; the others only when the first reads no kidney results
const GOOD_CONF = 70 // a first reading under this (or with few words) tries the other way up
const MIN_WORDS = 12
const READ_EDGE = 2400 // a page picture smaller than this is enlarged (up to twice) before it is read

// one page, cleaned and straight, with its first reading
type Prep = { blob: Blob; w: number; h: number; reading: Reading; psm: string }
type Try = { deg: number; blob: Blob; w: number; h: number; reading: Reading }
type Stop = { stopped: boolean }

// local file hash, the same recipe as pdfLoad.hashOf, so a photo does not pull in pdf.js just to be named
async function hashOfFile(file: Blob) {
  let h = 2166136261
  for (const b of new Uint8Array(await file.arrayBuffer())) h = Math.imul(h ^ b, 16777619)
  return (h >>> 0).toString(16).padStart(8, '0') + String(file.size % 10000).padStart(4, '0')
}

const wait = (stop: Stop) => {
  if (stop.stopped) throw new Error('stopped')
}

// Steps for one page. `at` and `span` place this page inside the 0 to 100 meter.
async function preparePage(canvas: HTMLCanvasElement, say: (label: string, pct: number) => void, at: number, span: number, stop: Stop, what: string): Promise<Prep> {
  const mark = (f: number, label = 'Turning the page…') => say(`${label} ${Math.round(at + span * f)}%`, at + span * f)
  mark(0)
  await tick()
  wait(stop)
  const whole = grayOf(canvas)
  const raw = cropPage(whole)
  const desk = raw.w !== whole.w || raw.h !== whole.h ? edgeGrey(raw) : 255 // the corners the turn uncovers are filled like the desk
  const pts = darkPoints(flatten(raw))
  const { turn: t, other } = estimateTurn(pts.xs, pts.ys)
  const first = t.quarter * 90 + t.angle
  mark(0.2)
  await tick()

  // turn the unflattened page, trim the desk off it, then even out the light
  const straight = (g: Gray, deg: number, edge = 0) => {
    const c = canvasOf(flatten(cropPage(grayOf(turn(g, deg, desk)), 0.5)))
    return edge ? enlarge(c, edge) : c
  }
  const readAt = async (deg: number, from: number, to: number): Promise<Try> => {
    wait(stop)
    const c = straight(raw, deg, READ_EDGE)
    const blob = await toPng(c)
    await tick()
    const reading = await readImage(blob, PSMS[0], (f) => mark(from + (to - from) * f, what))
    return { deg, blob, w: c.width, h: c.height, reading }
  }
  const asTrial = (x: Try): Trial => ({ deg: x.deg, words: x.reading.words.length, conf: x.reading.conf })
  let best = await readAt(first, 0.2, 0.8)
  if (best.reading.words.length < MIN_WORDS || best.reading.conf < GOOD_CONF) {
    // maybe upside down or on its side: take a quick look at each way up on a small copy
    const small = resize(raw, 1000)
    const alt = other.quarter * 90 + other.angle
    const trials: Trial[] = [asTrial(best)]
    let n = 0
    for (const deg of [first + 180, alt, alt + 180]) {
      wait(stop)
      mark(0.8 + 0.05 * n++)
      const c = straight(small, deg)
      const reading = await readImage(await toPng(c), PSMS[0])
      trials.push({ deg, words: reading.words.length, conf: reading.conf })
    }
    const pick = chooseOrientation(trials)
    if (pick.deg !== first) {
      const again = await readAt(pick.deg, 0.9, 0.97)
      if (chooseOrientation([asTrial(best), asTrial(again)]).deg === again.deg) best = again
    }
  }
  return { blob: best.blob, w: best.w, h: best.h, reading: best.reading, psm: PSMS[0] }
}

const toLines = (preps: Prep[]): PageLine[][] => preps.map((p, i) => linesFromWords(p.reading.words, i + 1, p.w, p.h))
const found = (r: Read) => (r.hits.egfr ? 1 : 0) + (r.hits.uacr ? 1 : 0) + (r.hits.creat ? 1 : 0) + (r.date ? 1 : 0)

async function run(file: File, env: IntakeEnv, stop: Stop): Promise<IntakeResult> {
  let last = 0
  const say = (label: string, pct: number) => {
    last = Math.max(last, Math.min(99, pct))
    env.onProgress?.(label, last)
  }
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
  say(isPdf ? 'Opening the scan… 2%' : 'Opening the photo… 2%', 2)
  const pdfLoad = isPdf ? await import('../intake/pdfLoad') : null
  const hash = pdfLoad ? await pdfLoad.hashOf(file) : await hashOfFile(file)
  const id = `D-UP-${hash}`
  wait(stop)

  const mime = isPdf ? 'application/pdf' : file.type || 'image/jpeg'
  const empty = (pages: number) => ({ id, name: file.name, mime, file, pages, hash, text: [] as PageText[] })
  if (env.known.includes(id)) return planFor({ hits: {} }, empty(1), env.pts, env.known, env.obs)

  // the page pictures
  let canvases: HTMLCanvasElement[]
  let doc: Awaited<ReturnType<NonNullable<typeof pdfLoad>['openPdf']>> | undefined
  if (pdfLoad) {
    doc = await pdfLoad.openPdf(id, file)
    canvases = []
  } else {
    canvases = [await decode(file)]
  }
  const total = doc ? doc.numPages : 1
  say(isPdf ? 'Reading page 1 of ' + total + '… 5%' : 'Reading the photo… 5%', 5)

  const preps: Prep[] = []
  const lo = 5
  const hi = 94
  for (let n = 1; n <= total; n++) {
    const at = lo + ((hi - lo) * (n - 1)) / total
    const span = (hi - lo) / total
    let canvas: HTMLCanvasElement
    if (doc && pdfLoad) {
      const c = document.createElement('canvas')
      await pdfLoad.drawPage(doc, n, c, 1000, 2) // twice the size, so small print is readable
      canvas = c
    } else canvas = canvases[0]
    const what = isPdf ? `Reading page ${n} of ${total}…` : 'Reading the photo…'
    preps.push(await preparePage(canvas, say, at, span, stop, what))
  }

  let pages = toLines(preps)
  let read = readReport(pages)
  if (!read.hits.egfr || !read.hits.uacr) {
    // the first page layout guess found no kidney results: read again with the other layouts
    for (const psm of PSMS.slice(1)) {
      wait(stop)
      say(`Reading again… ${Math.round(last)}%`, last)
      const again: Prep[] = []
      for (const p of preps) again.push({ ...p, reading: await readImage(p.blob, psm), psm })
      const lines = toLines(again)
      const r = readReport(lines)
      if (found(r) > found(read)) { read = r; pages = lines }
      if (read.hits.egfr && read.hits.uacr) break
    }
  }
  const allWords = preps.reduce((n, p) => n + p.reading.words.length, 0)
  if (allWords === 0) throw new Error('no text')

  const sure = await closeChecks(attachConf(read, pages), pages, preps, say, stop)
  const text: PageText[] = pages.map((lines, i) => ({ page: i + 1, lines: lines.map((l) => ({ text: l.text, bbox: l.bbox })) }))
  const base = { ...empty(total), text, views: preps.map((p) => p.blob) }
  return planFor(sure, base, env.pts, env.known, env.obs)
}

// Read each kidney number a second time as a close-up, digits only. A number the second reading does
// not repeat (a dropped decimal point, say) loses its confidence and goes to To check.
async function closeChecks(read: Read, pages: PageLine[][], preps: Prep[], say: (l: string, p: number) => void, stop: Stop): Promise<Read> {
  const hits: Read['hits'] = {}
  let n = 0
  for (const k of Object.keys(read.hits) as (keyof Read['hits'])[]) {
    const h = read.hits[k]
    if (!h) continue
    wait(stop)
    say(`Checking the numbers… ${96 + n++}%`, 96 + n)
    const at = locate(h, pages[h.page - 1] ?? [])
    let conf = h.conf ?? 0
    if (at && preps[h.page - 1]) {
      try {
        const shot = await closeUp(preps[h.page - 1].blob, at.value.box)
        const again = await readImage(shot, '7', undefined, '0123456789.')
        conf = checkedConf(conf, h.v, firstNumber(again.words.map((w) => w.text).join('')))
      } catch {
        conf = Math.min(conf, 0.5)
      }
    }
    hits[k] = { ...h, conf }
  }
  return { ...read, hits }
}

// never an error to the screen: if anything goes wrong, or it takes too long, the file goes to To check
async function unread(file: File): Promise<IntakeResult> {
  const { unreadResult } = await import('../intake/ingestPdf')
  return unreadResult(file, UNREAD)
}

export const ingestOcr: Ingest = async (file, env) => {
  const stop: Stop = { stopped: false }
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), LIMIT_MS) })
  try {
    const out = await Promise.race([run(file, env, stop), late])
    if (out === 'late') {
      stop.stopped = true
      void shutdown() // ends the reading that is still running
      return await unread(file)
    }
    return out
  } catch {
    return await unread(file)
  } finally {
    clearTimeout(timer)
  }
}

// for checks and tests in the browser: the cleaned page and the words read, without planning a result
export async function debugRead(file: File) {
  const canvas = await decode(file)
  const stop: Stop = { stopped: false }
  const prep = await preparePage(canvas, () => {}, 0, 100, stop, 'Reading the photo…')
  return prep
}

// for checks in the browser: a whole file through the real door, with timings
export async function debugRun(file: File, env: IntakeEnv) {
  const t = performance.now()
  const res = await ingestOcr(file, env)
  return { res, ms: performance.now() - t }
}
