// Picture clean-up before reading: decode, find the page, flatten the light, stand it straight.
// Browser only (canvas). The pure maths lives in geometry.ts.
import { otsu, percentileLevels, turnedSize } from './geometry'

export type Gray = { w: number; h: number; d: Uint8ClampedArray }

export const MAX_EDGE = 2400
const MIN_EDGE = 1600 // a small photo is scaled up to this, so the letters are big enough to read

// let the page paint between the heavy steps
export const tick = () => new Promise<void>((r) => setTimeout(r, 0))

const make = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// the file as a canvas, upright (the phone's rotation flag is honoured), long edge between 1600 and 2400
export async function decode(file: Blob): Promise<HTMLCanvasElement> {
  let src: ImageBitmap | HTMLImageElement
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      src = img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height
  const long = Math.max(w0, h0)
  const k = long > MAX_EDGE ? MAX_EDGE / long : long < MIN_EDGE ? MIN_EDGE / long : 1
  const c = make(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k)))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(src, 0, 0, c.width, c.height)
  if ('close' in src) src.close()
  return c
}

export function grayOf(c: HTMLCanvasElement): Gray {
  const { width: w, height: h } = c
  const px = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  const d = new Uint8ClampedArray(w * h)
  for (let i = 0, j = 0; j < d.length; i += 4, j++) d[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8
  return { w, h, d }
}

export function canvasOf(g: Gray): HTMLCanvasElement {
  const c = make(g.w, g.h)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(g.w, g.h)
  for (let i = 0, j = 0; j < g.d.length; i += 4, j++) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g.d[j]
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// block means: the picture made smaller by whole-number steps
function shrink(g: Gray, f: number): Gray {
  const w = Math.ceil(g.w / f)
  const h = Math.ceil(g.h / f)
  const d = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0
      let n = 0
      for (let yy = y * f; yy < Math.min(g.h, y * f + f); yy++)
        for (let xx = x * f; xx < Math.min(g.w, x * f + f); xx++) { s += g.d[yy * g.w + xx]; n++ }
      d[y * w + x] = s / n
    }
  return { w, h, d }
}

// A phone photo has a desk around the page. Keep the bright rectangle, drop the rest.
// A picture that is already just a page is left alone.
export function cropPage(g: Gray, cover = 0.15): Gray {
  const f = Math.max(1, Math.round(Math.max(g.w, g.h) / 300))
  const s = shrink(g, f)
  const hist = new Uint32Array(256)
  for (const v of s.d) hist[v]++
  const t = otsu(hist)
  let bright = 0
  const rows = new Float32Array(s.h)
  const cols = new Float32Array(s.w)
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      if (s.d[y * s.w + x] > t) { bright++; rows[y]++; cols[x]++ }
  const share = bright / (s.w * s.h)
  if (share < 0.3 || share > 0.97) return g
  const first = (a: Float32Array, len: number) => a.findIndex((v) => v / len >= cover)
  const last = (a: Float32Array, len: number) => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] / len >= cover) return i
    return -1
  }
  let y0 = first(rows, s.w)
  let y1 = last(rows, s.w)
  let x0 = first(cols, s.h)
  let x1 = last(cols, s.h)
  if (y0 < 0 || x0 < 0 || y1 <= y0 || x1 <= x0) return g
  const pad = 0.01
  x0 = Math.max(0, Math.floor((x0 - 0.5) * f - g.w * pad))
  y0 = Math.max(0, Math.floor((y0 - 0.5) * f - g.h * pad))
  x1 = Math.min(g.w, Math.ceil((x1 + 1.5) * f + g.w * pad))
  y1 = Math.min(g.h, Math.ceil((y1 + 1.5) * f + g.h * pad))
  const w = x1 - x0
  const h = y1 - y0
  if (w * h > g.w * g.h * 0.94 || w < g.w * 0.3 || h < g.h * 0.3) return g
  const d = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) d.set(g.d.subarray((y + y0) * g.w + x0, (y + y0) * g.w + x0 + w), y * w)
  return { w, h, d }
}

// Even out the light (shadows, vignette) by dividing by the local paper level, then stretch the
// contrast between the 1st and 99th percentile.
export function flatten(g: Gray): Gray {
  const f = 8
  const sw = Math.ceil(g.w / f)
  const sh = Math.ceil(g.h / f)
  // the paper level: the brightest pixel of each block, so thin letters do not pull it down
  let bg = new Float32Array(sw * sh)
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let m = 0
      for (let yy = y * f; yy < Math.min(g.h, y * f + f); yy++)
        for (let xx = x * f; xx < Math.min(g.w, x * f + f); xx++) { const v = g.d[yy * g.w + xx]; if (v > m) m = v }
      bg[y * sw + x] = m
    }
  const blur = (a: Float32Array, r: number) => {
    const tmp = new Float32Array(a.length)
    const out = new Float32Array(a.length)
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let s = 0
        let n = 0
        for (let k = Math.max(0, x - r); k <= Math.min(sw - 1, x + r); k++) { s += a[y * sw + k]; n++ }
        tmp[y * sw + x] = s / n
      }
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let s = 0
        let n = 0
        for (let k = Math.max(0, y - r); k <= Math.min(sh - 1, y + r); k++) { s += tmp[k * sw + x]; n++ }
        out[y * sw + x] = s / n
      }
    return out
  }
  bg = blur(blur(bg, 3), 3)
  const out = new Uint8ClampedArray(g.d.length)
  const hist = new Uint32Array(256)
  for (let y = 0; y < g.h; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / f - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const wy = fy - y0
    for (let x = 0; x < g.w; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / f - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const wx = fx - x0
      const b = (bg[y0 * sw + x0] * (1 - wx) + bg[y0 * sw + x1] * wx) * (1 - wy) + (bg[y1 * sw + x0] * (1 - wx) + bg[y1 * sw + x1] * wx) * wy
      const v = Math.min(255, (g.d[y * g.w + x] / Math.max(40, b)) * 255)
      out[y * g.w + x] = v
      hist[v | 0]++
    }
  }
  const [lo, hi] = percentileLevels(hist, 0.01, 0.99)
  const span = hi - lo || 1
  for (let i = 0; i < out.length; i++) out[i] = ((out[i] - lo) * 255) / span
  return { w: g.w, h: g.h, d: out }
}

// the dark pixels of a small copy, as points around the centre. these feed the angle search
export function darkPoints(g: Gray, edge = 700, cap = 60_000): { xs: number[]; ys: number[] } {
  const f = Math.max(1, Math.round(Math.max(g.w, g.h) / edge))
  const s = shrink(g, f)
  const all: number[] = []
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.d[y * s.w + x] < 200) all.push(x, y)
  const step = Math.max(1, Math.ceil(all.length / 2 / cap))
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < all.length; i += 2 * step) { xs.push(all[i] - s.w / 2); ys.push(all[i + 1] - s.h / 2) }
  return { xs, ys }
}

// turn the picture by `deg` (canvas convention) on a white page, large enough that no corner is lost
export function turn(g: Gray, deg: number, fill = 255): HTMLCanvasElement {
  const src = canvasOf(g)
  if (Math.abs(deg) < 1e-6) return src
  const size = turnedSize(g.w, g.h, deg)
  const out = make(size.w, size.h)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = `rgb(${fill},${fill},${fill})`
  ctx.fillRect(0, 0, size.w, size.h)
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(size.w / 2, size.h / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(src, -g.w / 2, -g.h / 2)
  return out
}

export const toPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))

// the grey of the desk: the middle value of the pixels along the four edges
export function edgeGrey(g: Gray): number {
  const v: number[] = []
  for (let x = 0; x < g.w; x += 4) { v.push(g.d[x], g.d[(g.h - 1) * g.w + x]) }
  for (let y = 0; y < g.h; y += 4) { v.push(g.d[y * g.w], g.d[y * g.w + g.w - 1]) }
  v.sort((a, b) => a - b)
  return v[v.length >> 1] ?? 255
}

// scale a picture so its long edge is `edge` pixels (for quick trial readings)
export function resize(g: Gray, edge: number): Gray {
  const k = edge / Math.max(g.w, g.h)
  if (k >= 1) return g
  const c = canvasOf(g)
  const out = make(Math.max(1, Math.round(g.w * k)), Math.max(1, Math.round(g.h * k)))
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, 0, 0, out.width, out.height)
  return grayOf(out)
}

// a close-up of one word from a page picture, enlarged and framed in white, as a PNG
export async function closeUp(page: Blob, box: [number, number, number, number]): Promise<Blob> {
  const bmp = await createImageBitmap(page)
  const [x0, y0, x1, y1] = box
  const h = y1 - y0
  const px = Math.max(3, Math.round(h * 0.3))
  const sx = Math.max(0, Math.floor(x0 - px))
  const sy = Math.max(0, Math.floor(y0 - px))
  const sw = Math.min(bmp.width - sx, Math.ceil(x1 - x0 + px * 2))
  const sh = Math.min(bmp.height - sy, Math.ceil(h + px * 2))
  const k = Math.min(4, Math.max(1, 90 / sh))
  const frame = 24
  const c = make(Math.round(sw * k) + frame * 2, Math.round(sh * k) + frame * 2)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, sx, sy, sw, sh, frame, frame, Math.round(sw * k), Math.round(sh * k))
  bmp.close()
  return toPng(c)
}

// make a small picture bigger (never smaller) so its long edge reaches `edge`: tesseract reads small
// print and thin decimal points better when the letters are large
export function enlarge(c: HTMLCanvasElement, edge: number, most = 2): HTMLCanvasElement {
  const k = Math.min(most, edge / Math.max(c.width, c.height))
  if (k <= 1.05) return c
  const out = make(Math.round(c.width * k), Math.round(c.height * k))
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, 0, 0, out.width, out.height)
  return out
}
