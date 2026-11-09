// placement of a reading inside the grid. the grid itself is the published one; nothing here judges a value
export const G_ROWS = [
  { g: 'G1', txt: '≥90' }, { g: 'G2', txt: '60–89' }, { g: 'G3a', txt: '45–59' },
  { g: 'G3b', txt: '30–44' }, { g: 'G4', txt: '15–29' }, { g: 'G5', txt: '<15' },
]
export const A_COLS = [
  { a: 'A1', txt: '<30' }, { a: 'A2', txt: '30–300' }, { a: 'A3', txt: '>300' },
]

export const gStage = (e: number) =>
  e >= 90 ? 'G1' : e >= 60 ? 'G2' : e >= 45 ? 'G3a' : e >= 30 ? 'G3b' : e >= 15 ? 'G4' : 'G5'
export const aStage = (u: number) => (u < 30 ? 'A1' : u <= 300 ? 'A2' : 'A3')

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const BAND: Record<string, [number, number]> = {
  G1: [120, 90], G2: [90, 60], G3a: [60, 45], G3b: [45, 30], G4: [30, 15], G5: [15, 0],
}
const ROWS = ['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5']

function tx(u: number) {
  const a = aStage(u)
  return Math.log10(a === 'A1' ? clamp(u, 3, 30) / 3 : a === 'A2' ? u / 30 : clamp(u, 300, 3000) / 300)
}
function ty(e: number) {
  const [hi, lo] = BAND[gStage(e)]
  return clamp((hi - e) / (hi - lo), 0, 1)
}

export function mapPos(egfr: number, uacr: number, cw: number, rh: number) {
  const col = ['A1', 'A2', 'A3'].indexOf(aStage(uacr))
  const row = ROWS.indexOf(gStage(egfr))
  return { x: col * cw + (0.08 + 0.84 * tx(uacr)) * cw, y: row * rh + (0.08 + 0.84 * ty(egfr)) * rh }
}

// nudge dots that sit on top of each other, keeping each inside its own cell
export function spread(pts: { x: number; y: number }[], cw: number, rh: number, gap = 22) {
  const out = pts.map((p) => ({ ...p }))
  const cell = pts.map((p) => ({ c: Math.floor(p.x / cw), r: Math.floor(p.y / rh) }))
  const keep = (p: { x: number; y: number }, c: { c: number; r: number }) => {
    p.x = Math.min((c.c + 1) * cw - 8, Math.max(c.c * cw + 8, p.x))
    p.y = Math.min((c.r + 1) * rh - 8, Math.max(c.r * rh + 8, p.y))
  }
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        let dx = out[j].x - out[i].x
        let dy = out[j].y - out[i].y
        let d = Math.hypot(dx, dy)
        if (d >= gap) continue
        if (d < 0.01) { dx = 1; dy = 0; d = 1 }
        const k = (gap - d) / 2 / d
        out[i].x -= dx * k; out[i].y -= dy * k
        out[j].x += dx * k; out[j].y += dy * k
        keep(out[i], cell[i]); keep(out[j], cell[j])
        moved = true
      }
    if (!moved) break
  }
  return out
}
