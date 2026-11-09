// Pure geometry for the photo reader: no DOM, no tesseract. Tested in node.
//
// Angles are in degrees and use the canvas convention: ctx.rotate(+a) turns the picture clockwise
// (y grows downward). A page that sits tilted by +3 degrees needs a rotation of -3 to stand straight.

export type Skew = { angle: number; fit: number }

// variance of the row sums after turning the points by `deg` (what a straight page maximises)
export function rowVariance(xs: ArrayLike<number>, ys: ArrayLike<number>, deg: number, bin = 1): number {
  const t = (deg * Math.PI) / 180
  const s = Math.sin(t)
  const c = Math.cos(t)
  const n = xs.length
  if (n === 0) return 0
  let lo = Infinity
  let hi = -Infinity
  const yy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const y = (xs[i] * s + ys[i] * c) / bin
    yy[i] = y
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  const size = Math.max(2, Math.ceil(hi - lo) + 1)
  const rows = new Float64Array(size)
  for (let i = 0; i < n; i++) rows[Math.floor(yy[i] - lo)]++
  const mean = n / size
  let v = 0
  for (let i = 0; i < size; i++) v += (rows[i] - mean) ** 2
  return v / size
}

// best straightening angle for the points, by a coarse then a fine search
export function estimateSkew(xs: ArrayLike<number>, ys: ArrayLike<number>, range = 15, coarse = 0.5, fine = 0.1): Skew {
  let best: Skew = { angle: 0, fit: -1 }
  for (let a = -range; a <= range + 1e-9; a += coarse) {
    const fit = rowVariance(xs, ys, a)
    if (fit > best.fit) best = { angle: a, fit }
  }
  const c = best.angle
  for (let a = c - coarse; a <= c + coarse + 1e-9; a += fine) {
    const fit = rowVariance(xs, ys, a)
    if (fit > best.fit) best = { angle: a, fit }
  }
  return { angle: Math.round(best.angle * 100) / 100, fit: best.fit }
}

export type Turn = { quarter: 0 | 1; angle: number; fit: number }

// Is the text running along the rows (quarter 0) or down the columns (quarter 1)? Returns the winner,
// the small extra angle for it, and how clearly it won (1 = no difference).
export function estimateTurn(xs: ArrayLike<number>, ys: ArrayLike<number>, range = 15): { turn: Turn; other: Turn; clarity: number } {
  const n = xs.length
  const x1 = new Float64Array(n)
  const y1 = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x1[i] = -ys[i] // a quarter turn clockwise: x' = -y, y' = x
    y1[i] = xs[i]
  }
  const a = estimateSkew(xs, ys, range)
  const b = estimateSkew(x1, y1, range)
  const ta: Turn = { quarter: 0, ...a }
  const tb: Turn = { quarter: 1, ...b }
  const lo = Math.min(a.fit, b.fit)
  return { turn: a.fit >= b.fit ? ta : tb, other: a.fit >= b.fit ? tb : ta, clarity: lo > 0 ? Math.max(a.fit, b.fit) / lo : Infinity }
}

// one trial reading of a page at some turn: how many words, and the mean confidence (0 to 100)
export type Trial = { deg: number; words: number; conf: number }

// the trial fit: a good mean over only a few words does not win over a good mean over a full page
export function trialFit(t: Trial): number {
  return t.conf * Math.min(1, t.words / 25)
}

// the turn with the best fit. the first trial wins a tie, so an upright page is kept
export function chooseOrientation(trials: Trial[]): Trial {
  let best = trials[0]
  for (const t of trials) if (trialFit(t) > trialFit(best) + 1e-9) best = t
  return best
}

// the grey levels (0 to 255) that hold `lo` and `hi` of the pixels, from a 256-bin histogram
export function percentileLevels(hist: ArrayLike<number>, lo = 0.01, hi = 0.99): [number, number] {
  let total = 0
  for (let i = 0; i < hist.length; i++) total += hist[i]
  let acc = 0
  let a = 0
  let b = hist.length - 1
  let gotLo = false
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i]
    if (!gotLo && acc >= total * lo) { a = i; gotLo = true }
    if (acc >= total * hi) { b = i; break }
  }
  if (b <= a) b = Math.min(hist.length - 1, a + 1)
  return [a, b]
}

// Otsu threshold of a 256-bin histogram: the level that best splits dark from bright
export function otsu(hist: ArrayLike<number>): number {
  let total = 0
  let sum = 0
  for (let i = 0; i < hist.length; i++) { total += hist[i]; sum += i * hist[i] }
  let wB = 0
  let sumB = 0
  let best = 0
  let level = 0
  for (let i = 0; i < hist.length; i++) {
    wB += hist[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; level = i }
  }
  return level
}

// the new size of a w x h picture turned by `deg` degrees, so no corner is cut off
export function turnedSize(w: number, h: number, deg: number): { w: number; h: number } {
  const t = (Math.abs(deg) * Math.PI) / 180
  const c = Math.abs(Math.cos(t))
  const s = Math.abs(Math.sin(t))
  return { w: Math.ceil(w * c + h * s - 1e-6), h: Math.ceil(w * s + h * c - 1e-6) }
}
