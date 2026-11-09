import { describe, expect, it } from 'vitest'
import { chooseOrientation, estimateSkew, estimateTurn, otsu, percentileLevels, rowVariance, trialFit, turnedSize } from './geometry'

// dots on straight text lines: 14 lines, 60 px apart, each a row of dots every 6 px
function page(): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  for (let line = 0; line < 14; line++)
    for (let x = -300; x <= 300; x += 6) {
      if ((x + line * 7 + 1000) % 30 > 20) continue // gaps between words
      xs.push(x)
      ys.push(-400 + line * 60)
    }
  return { xs, ys }
}
// the same dots after the picture was turned by `deg` (canvas convention)
function turned({ xs, ys }: { xs: number[]; ys: number[] }, deg: number) {
  const t = (deg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return { xs: xs.map((x, i) => x * c - ys[i] * s), ys: xs.map((x, i) => x * s + ys[i] * c) }
}

describe('skew', () => {
  it('a straight page needs no turn', () => {
    const p = page()
    expect(Math.abs(estimateSkew(p.xs, p.ys).angle)).toBeLessThanOrEqual(0.2)
  })
  it('finds the angle that straightens a page tilted by 3 degrees', () => {
    const p = turned(page(), 3)
    expect(estimateSkew(p.xs, p.ys).angle).toBeCloseTo(-3, 0)
  })
  it('works for a tilt the other way and for a larger one', () => {
    const a = turned(page(), -2.5)
    expect(estimateSkew(a.xs, a.ys).angle).toBeCloseTo(2.5, 0)
    const b = turned(page(), 9)
    expect(estimateSkew(b.xs, b.ys).angle).toBeCloseTo(-9, 0)
  })
  it('fits a straight page higher than a tilted one', () => {
    const p = page()
    expect(rowVariance(p.xs, p.ys, 0)).toBeGreaterThan(rowVariance(p.xs, p.ys, 3) * 2)
  })
})

describe('which way the text runs', () => {
  it('rows for an upright page', () => {
    const p = turned(page(), 2)
    const { turn } = estimateTurn(p.xs, p.ys)
    expect(turn.quarter).toBe(0)
    expect(turn.angle).toBeCloseTo(-2, 0)
  })
  it('columns for a page on its side', () => {
    const p = turned(page(), 90)
    const { turn } = estimateTurn(p.xs, p.ys)
    expect(turn.quarter).toBe(1)
  })
})

describe('orientation by confidence', () => {
  it('keeps the trial with the best mean confidence', () => {
    const best = chooseOrientation([
      { deg: 0, words: 40, conf: 35 },
      { deg: 90, words: 12, conf: 20 },
      { deg: 180, words: 160, conf: 88 },
      { deg: 270, words: 30, conf: 41 },
    ])
    expect(best.deg).toBe(180)
  })
  it('keeps the first trial on a tie, so an upright page stays', () => {
    expect(chooseOrientation([{ deg: 0, words: 100, conf: 80 }, { deg: 180, words: 100, conf: 80 }]).deg).toBe(0)
  })
  it('does not let a few confident words beat a full page', () => {
    expect(trialFit({ deg: 0, words: 3, conf: 95 })).toBeLessThan(trialFit({ deg: 0, words: 120, conf: 75 }))
    expect(chooseOrientation([{ deg: 0, words: 120, conf: 75 }, { deg: 90, words: 3, conf: 95 }]).deg).toBe(0)
  })
})

describe('levels and sizes', () => {
  it('finds the 1st and 99th percentile grey levels', () => {
    const h = new Array(256).fill(0)
    for (let i = 50; i <= 200; i++) h[i] = 10
    const [lo, hi] = percentileLevels(h)
    expect(lo).toBeGreaterThanOrEqual(50)
    expect(lo).toBeLessThan(60)
    expect(hi).toBeLessThanOrEqual(200)
    expect(hi).toBeGreaterThan(190)
  })
  it('splits dark desk from bright page', () => {
    const h = new Array(256).fill(0)
    h[60] = 500
    h[230] = 1500
    const t = otsu(h)
    expect(t).toBeGreaterThanOrEqual(60)
    expect(t).toBeLessThan(230)
  })
  it('gives a canvas big enough for a turned picture', () => {
    const s = turnedSize(1000, 1400, 3)
    expect(s.w).toBeGreaterThan(1000)
    expect(s.h).toBeGreaterThan(1400)
    expect(turnedSize(1000, 1400, 90)).toEqual({ w: 1400, h: 1000 })
  })
})
