import { useEffect, useMemo, useState } from 'react'
import { go, type Route } from '../hooks'
import { useStore } from '../store/store'
import { VoiceSearch } from './Voice'

export function Banner() {
  const setTour = useStore((s) => s.setTour)
  const reset = useStore((s) => s.reset)
  return (
    <div className="banner">
      <span>Sample patients · Reports stay here · Voice uses Sarvam only when you choose.</span>
      <span className="banner-links">
        <button className="link" onClick={() => { go('#/day'); setTour(1) }}>Show me how</button>
        <button className="link" onClick={() => { reset(); go('#/day') }}>Start again</button>
        <a href="#/scope">What this app does not do</a>
      </span>
    </div>
  )
}

export function TopBar({ route }: { route: Route }) {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const pts = useStore((s) => s.pts)
  const queue = useStore((s) => s.queue)
  const [q, setQ] = useState('')
  const open = queue.filter((x) => x.state === 'open').length
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    // phone digits are compared with the digits typed, so the last 4 digits (or any part) find the patient
    const dig = t.replace(/\D/g, '')
    const tok = /^(?:t|token)\s*(\d+)$/.exec(t)
    return pts.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        p.id.toLowerCase().includes(t) ||
        p.phone.replace(/\s/g, '').toLowerCase().includes(t.replace(/\s/g, '')) ||
        (dig.length >= 2 && /^[\d\s+()-]+$/.test(t) && p.phone.replace(/\D/g, '').includes(dig)) ||
        (tok !== null && p.token === Number(tok[1])),
    )
  }, [q, pts])

  // "/" jumps to the search box, as in most clinic software
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault()
        document.getElementById('pt-search')?.focus()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const link = (to: string, name: string, text: string) => (
    <a href={`#/${to}`} className={route.name === name ? 'on' : ''} aria-current={route.name === name ? 'page' : undefined}>{text}</a>
  )
  return (
    <header className="topbar" data-tour="topbar">
      <a href="#/day" className="brand">PreSymp <span>|</span> Kidney Map</a>
      <div className="search">
        <input
          id="pt-search" type="search" placeholder="Search name, ID or phone ( / )" aria-label="Search patients" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQ('')
            if (e.key === 'Enter' && hits[0]) { go(`#/patient/${hits[0].id}`); setQ('') }
          }}
        />
        {q.trim() && (
          <ul className="hits">
            {hits.length === 0 && <li className="none">No patient found</li>}
            {hits.map((p) => (
              <li key={p.id}>
                <button onClick={() => { go(`#/patient/${p.id}`); setQ('') }}>{p.name} <span>{p.id} · {p.phone}</span></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <VoiceSearch onText={setQ} />
      <nav className="nav">
        {link('day', 'day', 'Today')}
        {link('due', 'due', 'Call list')}
        {link('queue', 'queue', `To check (${open})`)}
        {link('audit', 'audit', 'History')}
        {link('settings', 'settings', 'Settings')}
      </nav>
      <div className="role" data-tour="role">
        <div className="seg" role="group" aria-label="Role">
          <button aria-pressed={role === 'front'} onClick={() => setRole('front')}>Front desk</button>
          <button aria-pressed={role === 'doc'} onClick={() => setRole('doc')}>Doctor</button>
        </div>
      </div>
    </header>
  )
}

export function StatusBar() {
  return (
    <footer className="statusbar">
      <span>Reports stay in this page · Kept voice messages stay in this browser · Sarvam needs consent</span>
      <span>Today: Thu 18 Dec 2025</span>
    </footer>
  )
}

export function Toast() {
  const t = useStore((s) => s.toast)
  const say = useStore((s) => s.say)
  useEffect(() => {
    if (!t) return
    const h = setTimeout(() => say(''), 3600)
    return () => clearTimeout(h)
  }, [t, say])
  return t ? <div className="toast" role="status">{t}</div> : null
}
