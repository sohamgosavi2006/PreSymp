import { describe, expect, it } from 'vitest'
import { addMonths, sinceText } from './dates'
import { itemsFor } from './due'
import { aStage, gStage, mapPos } from './kdigo'
import { BASE_CFG, seed } from '../store/seed'

const s = seed()
const ctx = { pts: s.pts, obs: s.obs, docs: s.docs, cfg: BASE_CFG, ovr: s.ovr, forced: [] as string[] }
const item = (pid: string, key: string) => itemsFor(ctx, pid).find((i) => i.key === key)!

describe('dates', () => {
  it('clamps the day to the month end', () => expect(addMonths('2025-08-31', 6)).toBe('2026-02-28'))
  it('says days, weeks, then months', () => {
    expect(sinceText('2025-12-15')).toBe('3 days')
    expect(sinceText('2025-11-28')).toBe('3 weeks')
    expect(sinceText('2025-07-18')).toBe('5 months')
  })
})

describe('kdigo grid', () => {
  it('stage boundaries', () => {
    expect([90, 89, 60, 59, 45, 44, 30, 29, 15, 14].map(gStage)).toEqual(['G1', 'G2', 'G2', 'G3a', 'G3a', 'G3b', 'G3b', 'G4', 'G4', 'G5'])
    expect([29.9, 30, 300, 301].map(aStage)).toEqual(['A1', 'A2', 'A2', 'A3'])
  })
  it('keeps a point inside its cell', () => {
    const p = mapPos(54, 190, 150, 70)
    expect(p.x).toBeGreaterThan(150)
    expect(p.x).toBeLessThan(300)
    expect(p.y).toBeGreaterThan(140)
    expect(p.y).toBeLessThan(210)
  })
})

// SPEC.md 4.4, with today = 18 Dec 2025
describe('due items on the seed', () => {
  it('Devi', () => {
    expect(item('P-0417', 'panel').text).toBe('next test Mar 2026')
    expect(item('P-0417', 'rpt').text).toBe('done, Sep 2025')
    expect(item('P-0417', 'fundus').since).toBe('2 months')
    expect(item('P-0417', 'foot').text).toBe('due Jan 2026')
  })
  it('Das, Khan, Roy', () => {
    expect(item('P-0288', 'rpt').since).toBe('3 weeks')
    expect(item('P-0932', 'panel').since).toBe('5 months')
    expect(item('P-0061', 'egfr2').since).toBe('1 week')
  })
  it('Banerjee has nothing due, and exactly four items are due in all', () => {
    expect(itemsFor(ctx, 'P-0533').some((i) => i.pending)).toBe(false)
    const due = s.pts.flatMap((p) => itemsFor(ctx, p.id)).filter((i) => i.pending)
    expect(due.map((i) => `${i.pid}:${i.key}`).sort()).toEqual(['P-0061:egfr2', 'P-0288:rpt', 'P-0417:fundus', 'P-0932:panel'])
  })
  it('late is a pill, waiting is a dot, far off is a ring', () => {
    expect(item('P-0932', 'panel').mark).toBe('pill')
    expect(item('P-0288', 'rpt').mark).toBe('dot')
    expect(item('P-0533', 'panel').mark).toBe('hollow')
  })
})
