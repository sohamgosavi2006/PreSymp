import { useEffect, useMemo, useRef, useState } from 'react'
import { useVisits } from '../hooks'
import { fmt, fmtShort, yr2 } from '../logic/dates'
import { A_COLS, G_ROWS, mapPos, spread } from '../logic/kdigo'
import { useStore } from '../store/store'

// grid geometry: left margin, top margin, cell width and height
const PX = 112, PY = 40, CW = 150, RH = 70
const GW = CW * 3, GH = RH * 6
const W = PX + GW + 14, H = PY + GH + 56

type Lab = { x: number; y: number; t: string; end: boolean }

// put a label next to a dot without sitting on another dot or label
function place(dots: { x: number; y: number }[], want: { i: number; t: string }[]): Lab[] {
  const tries: [number, number, number][] = [[9, -9, 0], [9, 17, 0], [-9, -9, 1], [-9, 17, 1], [0, -16, 2], [0, 24, 2]]
  const taken = dots.map((d) => [d.x - 8, d.y - 8, d.x + 8, d.y + 8])
  const hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
  const out: Lab[] = []
  for (const w of want) {
    const d = dots[w.i]
    const len = w.t.length * 8.4
    let got: Lab | null = null
    for (const [dx, dy, al] of tries) {
      const x = d.x + dx
      const left = al === 1 ? x - len : al === 2 ? x - len / 2 : x
      const box = [left, d.y + dy - 11, left + len, d.y + dy + 3]
      if (box[0] > -PX + 8 && box[2] < GW + 8 && box[1] > -PY + 14 && box[3] < GH + 8 && !taken.some((t) => hit(box, t))) {
        got = { x, y: d.y + dy, t: w.t, end: al === 1 }
        taken.push(box)
        break
      }
    }
    out.push(got ?? { x: d.x + 9, y: d.y - 9, t: w.t, end: false })
  }
  return out
}

export function KidneyMap({ pid, sel, onSel }: { pid: string; sel: string; onSel: (d: string) => void }) {
  const vs = useVisits(pid)
  const obs = useStore((s) => s.obs)
  const docs = useStore((s) => s.docs)
  const popped = useRef(new Set<string>())
  const openSrc = useStore((s) => s.openSrc)
  const peek = useStore((s) => s.mapPeek)
  const [hov, setHov] = useState<number | null>(null)
  const n = vs.length
  const latest = vs[n - 1]?.d
  const dots = useMemo(() => spread(vs.map((v) => mapPos(v.egfr, v.uacr, CW, RH)), CW, RH), [vs])
  const labels = useMemo(() => {
    if (!n) return []
    const idx = n >= 3 ? [0, Math.round((n - 1) * 0.67), n - 1] : n === 2 ? [0, 1] : [0]
    return place(dots, [...new Set(idx)].map((i) => ({ i, t: i === n - 1 ? `${fmtShort(vs[i].d)}${vs[i].d === latest ? ' (latest)' : ''}` : yr2(vs[i].d) })))
  }, [vs, dots, n, latest])
  // remember what has been shown, after the screen is drawn
  useEffect(() => { vs.forEach((v) => popped.current.add(v.doc)) }, [vs])
  const show = hov ?? (peek && n ? n - 1 : null)

  const pick = (i: number) => {
    onSel(vs[i].d)
    const o = obs.find((x) => x.pid === pid && x.d === vs[i].d && x.kind === 'uacr')
    if (o) openSrc(o)
  }
  return (
    <section className="panel map" aria-labelledby="map-h" data-tour="map">
      <h3 id="map-h" className="lab">KIDNEY MAP · every dot is one visit</h3>
      <div className="map-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kidney Map. Each dot is one visit.">
          {A_COLS.map((c, i) => <text key={c.a} className="ax" x={PX + CW * i + CW / 2} y={PY - 14} textAnchor="middle">{c.a} {c.txt}</text>)}
          {G_ROWS.map((r, i) => <text key={r.g} className="ax" x={PX - 8} y={PY + RH * i + RH / 2 + 4} textAnchor="end">{r.g} {r.txt}</text>)}
          <rect x={PX} y={PY} width={GW} height={GH} className="gridbox" />
          {[1, 2].map((i) => <line key={i} x1={PX + CW * i} y1={PY} x2={PX + CW * i} y2={PY + GH} className="gl" />)}
          {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={PX} y1={PY + RH * i} x2={PX + GW} y2={PY + RH * i} className="gl" />)}
          <text className="axt" x={PX + GW / 2} y={PY + GH + 30} textAnchor="middle">Urine (UACR, mg/g)</text>
          <text className="axt" transform={`translate(14 ${PY + GH / 2}) rotate(-90)`} textAnchor="middle">Blood (eGFR)</text>
          <g transform={`translate(${PX} ${PY})`}>
            {dots.slice(1).map((p, i) => (
              <line key={i} x1={dots[i].x} y1={dots[i].y} x2={p.x} y2={p.y} stroke="var(--ink)" strokeWidth="1.2" strokeOpacity={0.22 + 0.7 * ((i + 1) / Math.max(n - 1, 1))} />
            ))}
            {labels.map((l) => <text key={l.t} className="plab" x={l.x} y={l.y} textAnchor={l.end ? 'end' : 'start'}>{l.t}</text>)}
            {dots.map((p, i) => {
              const last = i === n - 1
              const v = vs[i]
              // a report that just came in pops in once; it is remembered so it does not repeat
              const fresh = docs.find((x) => x.id === v.doc)?.isNew && !popped.current.has(v.doc)
              return (
                <g
                  key={v.d} className="pt" data-testid="map-dot" data-date={v.d} tabIndex={0} role="button"
                  aria-label={`${fmt(v.d)}, eGFR ${v.egfr}, UACR ${v.uacr}`}
                  onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onFocus={() => setHov(i)} onBlur={() => setHov(null)}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(i))}
                >
                  <circle cx={p.x} cy={p.y} r="13" fill="transparent" />
                  {sel === v.d && <circle cx={p.x} cy={p.y} r="10.5" fill="none" stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 2" />}
                  <circle className={fresh ? 'dotnew' : undefined} cx={p.x} cy={p.y} r={last ? 6.5 : 5} fill={last ? 'var(--ink)' : 'var(--paper)'} stroke="var(--ink)" strokeWidth="1.5" strokeOpacity={last ? 1 : 0.3 + 0.45 * (i / Math.max(n - 1, 1))} />
                </g>
              )
            })}
          </g>
        </svg>
        {show !== null && vs[show] && (
          <div className="tip" style={{ left: `${((PX + dots[show].x) / W) * 100}%`, top: `${((PY + dots[show].y) / H) * 100}%` }}>
            {fmt(vs[show].d)} · eGFR {vs[show].egfr} · UACR {vs[show].uacr} · Lab {vs[show].lab}
          </div>
        )}
      </div>
    </section>
  )
}
