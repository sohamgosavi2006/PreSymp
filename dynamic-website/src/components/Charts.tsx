import { useMemo, useState } from 'react'
import { useVisits } from '../hooks'
import { daysBetween, fmt } from '../logic/dates'
import { useStore } from '../store/store'

type P = { d: string; v: number }
const W = 360, H = 190, L = 44, R = 16, T = 16, B = 30

function span(vals: number[], log: boolean) {
  const lo = Math.min(...vals), hi = Math.max(...vals)
  if (log) return { lo: lo / 1.6, hi: hi * 1.6, log }
  const pad = (hi - lo || hi * 0.1 || 1) * 0.25
  return { lo: lo - pad, hi: hi + pad, log }
}
const pos = (s: ReturnType<typeof span>, v: number) =>
  s.log ? (Math.log10(v) - Math.log10(s.lo)) / (Math.log10(s.hi) - Math.log10(s.lo)) : (v - s.lo) / (s.hi - s.lo)

function ticks(s: ReturnType<typeof span>) {
  if (s.log) {
    const out: number[] = []
    for (let a = Math.floor(Math.log10(s.lo)); a <= Math.ceil(Math.log10(s.hi)); a++)
      for (const u of [1, 3]) { const c = u * 10 ** a; if (c > s.lo && c < s.hi) out.push(c) }
    return out.length > 3 ? out.filter((x) => String(x)[0] === '1') : out
  }
  const n = (s.hi - s.lo) / 3
  const base = 10 ** Math.floor(Math.log10(n))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * base).find((x) => x >= n) ?? n
  const out: number[] = []
  for (let v = Math.ceil(s.lo / step) * step; v < s.hi; v += step) out.push(Math.round(v * 1e3) / 1e3)
  return out
}

function One({ title, unit, kind, pts, log, pid }: { title: string; unit: string; kind: 'egfr' | 'uacr' | 'creat'; pts: P[]; log?: boolean; pid: string }) {
  const obs = useStore((s) => s.obs)
  const openSrc = useStore((s) => s.openSrc)
  const [hov, setHov] = useState<number | null>(null)
  const sc = useMemo(() => span(pts.map((p) => p.v), !!log), [pts, log])
  const total = Math.max(daysBetween(pts[0].d, pts[pts.length - 1].d), 1)
  const x = (d: string) => L + 16 + (daysBetween(pts[0].d, d) / total) * (W - L - R - 32)
  const y = (v: number) => T + (1 - pos(sc, v)) * (H - T - B)
  const f = (v: number) => (kind === 'creat' ? v.toFixed(2) : String(v))
  const last = pts.length - 1
  // alternate the label side when two dots are close in x
  const below = pts.map(() => false)
  pts.forEach((p, i) => { if (i > 0 && x(p.d) - x(pts[i - 1].d) < 30) below[i] = !below[i - 1] })
  const y0 = Number(pts[0].d.slice(0, 4)), y1 = Number(pts[last].d.slice(0, 4))
  const years = Array.from({ length: y1 - y0 }, (_, i) => `${y0 + i + 1}-01-01`).filter((d) => d > pts[0].d && d < pts[last].d)
  const open = (p: P) => { const o = obs.find((z) => z.pid === pid && z.d === p.d && z.kind === kind); if (o) openSrc(o) }
  return (
    <figure className="vchart">
      <figcaption><b>{title}</b> <span className="muted">{unit}</span></figcaption>
      <div className="vc-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} at each visit. The table lists the same values.`}>
          {ticks(sc).map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="gl" />
              <text x={L - 6} y={y(t) + 4} textAnchor="end" className="ax">{f(t)}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="gl" />
          {years.map((d) => <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="ax">{d.slice(0, 4)}</text>)}
          {pts.slice(1).map((p, i) => (
            <line key={p.d} x1={x(pts[i].d)} y1={y(pts[i].v)} x2={x(p.d)} y2={y(p.v)} stroke="var(--ink)" strokeWidth="1.3" strokeOpacity={0.3 + 0.6 * ((i + 1) / Math.max(last, 1))} />
          ))}
          {pts.map((p, i) => (
            <g key={p.d} className="pt" tabIndex={0} role="button" aria-label={`${fmt(p.d)}, ${title} ${f(p.v)}`}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onFocus={() => setHov(i)} onBlur={() => setHov(null)}
              onClick={() => open(p)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(p))}>
              <circle cx={x(p.d)} cy={y(p.v)} r="12" fill="transparent" />
              <circle cx={x(p.d)} cy={y(p.v)} r={i === last ? 5.5 : 4.5} fill={i === last ? 'var(--ink)' : 'var(--card)'} stroke="var(--ink)" strokeWidth="1.5" strokeOpacity={i === last ? 1 : 0.35 + 0.5 * (i / Math.max(last, 1))} />
              <text x={x(p.d)} y={y(p.v) + (below[i] ? 19 : -10)} textAnchor="middle" className="vlab">{f(p.v)}</text>
            </g>
          ))}
        </svg>
        {hov !== null && <div className="tip" style={{ left: `${(x(pts[hov].d) / W) * 100}%`, top: `${(y(pts[hov].v) / H) * 100}%` }}>{fmt(pts[hov].d)} · {f(pts[hov].v)} {unit}</div>}
      </div>
    </figure>
  )
}

export function Charts({ pid }: { pid: string }) {
  const vs = useVisits(pid)
  if (vs.length < 2) return null
  const cr = vs.filter((v) => v.creat !== undefined).map((v) => ({ d: v.d, v: v.creat! }))
  return (
    <section className="panel" aria-labelledby="vc-h" data-tour="visitcharts">
      <h3 id="vc-h" className="lab">RESULTS OVER TIME</h3>
      <div className="vcharts">
        <One pid={pid} kind="egfr" title="Blood test (eGFR)" unit="mL/min/1.73 m²" pts={vs.map((v) => ({ d: v.d, v: v.egfr }))} />
        <One pid={pid} kind="uacr" title="Urine test (UACR)" unit="mg/g" pts={vs.map((v) => ({ d: v.d, v: v.uacr }))} log />
        {cr.length > 1 && <One pid={pid} kind="creat" title="Creatinine" unit="mg/dL" pts={cr} />}
      </div>
      <p className="cap">Each dot is one visit. Click a dot to see the lab report.</p>
    </section>
  )
}
