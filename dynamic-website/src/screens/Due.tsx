import { useEffect, useRef, useState } from 'react'
import { Human, Status } from '../components/ui'
import { rowKeys, useDueItems } from '../hooks'
import { PHRASE_KEY, SHORT, type Item } from '../logic/due'
import { LANGS, LANG_NAME, LANG_TAB, reminder, type Lang } from '../logic/phrases'
import { speak, useVoice } from '../logic/speak'
import { useStore } from '../store/store'
import type { Pt } from '../store/types'

const REASONS = ['Patient attended', 'Called by phone', 'Not needed']
type Mode = 'edit' | 'skip' | null

function Table({ rows, sel, onSel, onAct }: { rows: Item[]; sel: string; onSel: (k: string) => void; onAct: (k: string, m: Mode) => void }) {
  const pts = useStore((s) => s.pts)
  const rem = useStore((s) => s.rem)
  const aud = useStore((s) => s.aud)
  const remText = useStore((s) => s.remText)
  const role = useStore((s) => s.role)
  const approve = useStore((s) => s.approve)
  const undo = useStore((s) => s.undo)
  const by = role === 'doc' ? 'Dr. M.' : 'K.'
  return (
    <table className="tbl due" data-tour="duetable">
      <thead><tr><th>Patient</th><th>Test due</th><th>Waiting since</th><th>Phone</th><th>Language</th><th>What to do</th></tr></thead>
      <tbody>
        {rows.map((it) => {
          const k = `${it.pid}:${it.key}`
          const p = pts.find((x) => x.id === it.pid)!
          const r = rem[k]
          const un = aud.find((a) => a.undo?.t === 'rem' && a.undo.key === k && !a.undone)
          return (
            <tr key={k} className={sel === k ? 'sel' : ''} onClick={() => onSel(k)} tabIndex={0} onKeyDown={(e) => rowKeys(e, () => onSel(k))}>
              <td>{p.short}</td>
              <td>{SHORT[it.key]}</td>
              <td>{it.pending ? <Status kind={it.mark === 'pill' ? 'pill' : 'dot'}>{it.since}</Status> : <span className="muted">added by staff</span>}</td>
              <td className="muted">{p.phone}</td>
              <td>{LANG_NAME[p.lang]}</td>
              <td onClick={(e) => e.stopPropagation()}>
                {r ? (
                  <span className="done">
                    <Status kind="hollow">{r.st === 'sent' ? `Sent · via ${r.via} · ${r.time}` : `Skipped · ${r.reason}`}</Status>
                    {un && <button className="link" onClick={() => undo(un.id)}>Undo</button>}
                  </span>
                ) : (
                  <Human className="small">
                    <button className="btn" onClick={() => approve(k, remText[k] ?? reminder(p.lang, p.name, PHRASE_KEY[it.key]), by)}>Send</button>
                    <button className="btn" onClick={() => onAct(k, 'edit')}>Edit</button>
                    <button className="btn" onClick={() => onAct(k, 'skip')}>Skip</button>
                  </Human>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Preview({ it, pt, mode, setMode }: { it: Item; pt: Pt; mode: Mode; setMode: (m: Mode) => void }) {
  const k = `${it.pid}:${it.key}`
  const r = useStore((s) => s.rem[k])
  const saved = useStore((s) => s.remText[k])
  const role = useStore((s) => s.role)
  const approve = useStore((s) => s.approve)
  const skip = useStore((s) => s.skip)
  const setText = useStore((s) => s.setRemText)
  const setHeard = useStore((s) => s.setHeard)
  const heard = useStore((s) => s.heard[k])
  const [lang, setLang] = useState<Lang>(pt.lang)
  const [draft, setDraft] = useState('')
  const [talking, setTalking] = useState(false)
  const stop = useRef<(() => void) | null>(null)
  const voice = useVoice(lang)
  const by = role === 'doc' ? 'Dr. M.' : 'K.'
  const text = saved && lang === pt.lang ? saved : reminder(lang, pt.name, PHRASE_KEY[it.key])
  useEffect(() => { if (mode === 'edit') setDraft(text) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  // a new language or edited words mean the message has to be heard again
  useEffect(() => { stop.current?.(); setTalking(false); setHeard(k, 'read') }, [lang, mode, k, setHeard])
  useEffect(() => () => stop.current?.(), [])
  const listen = () => {
    if (!voice) return
    if (talking) { stop.current?.(); setTalking(false); return }
    setTalking(true)
    stop.current = speak(text, lang, voice, { end: () => { setTalking(false); setHeard(k, 'listened') }, fail: () => setTalking(false) })
  }
  return (
    <section className="panel preview" aria-labelledby="rp-h" data-tour="preview">
      <div className="ph">
        <h3 id="rp-h" className="lab">MESSAGE · {pt.name}, {LANG_NAME[lang]}</h3>
        <div className="seg" role="group" aria-label="Message language">
          {LANGS.map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_TAB[l]}</button>)}
        </div>
      </div>
      <p className="muted">{SHORT[it.key]} · {pt.phone}</p>
      {mode === 'edit' ? (
        <textarea className="bubble edit" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit message" />
      ) : (
        <p className="bubble" lang={lang}>{text}</p>
      )}
      <div className="listen">
        <button className="btn" data-tour="listen" data-testid="listen" disabled={!voice || mode === 'edit'} onClick={listen}>{talking ? 'Stop' : 'Listen'}</button>
        {voice
          ? <span className="cap" data-testid="listen-note">{heard === 'listened' ? 'You listened to this message.' : 'Listen, then press Send.'}</span>
          : <span className="cap" data-testid="no-voice" role="status">No {LANG_NAME[lang]} voice on this computer. Read the text before sending.</span>}
      </div>
      <p className="cap">Patient agreed to messages ✓</p>
      {r ? (
        <p className="sent-note">
          {r.st === 'sent' ? `Sent via ${r.via} · ${r.time}` : `Skipped · ${r.reason}`}
          <span className="muted"> · Demo: no real message sent.</span>
        </p>
      ) : mode === 'skip' ? (
        <Human>
          <span className="muted">Reason for skipping:</span>
          {REASONS.map((x) => <button key={x} className="btn" onClick={() => { skip(k, x, by); setMode(null) }}>{x}</button>)}
          <button className="btn quiet" onClick={() => setMode(null)}>Cancel</button>
        </Human>
      ) : mode === 'edit' ? (
        <Human>
          <button className="btn solid" onClick={() => { setText(k, draft, text, by); setMode(null); setLang(pt.lang) }}>Save</button>
          <button className="btn quiet" onClick={() => setMode(null)}>Cancel</button>
        </Human>
      ) : (
        <Human>
          <button className="btn solid" data-tour="approve" onClick={() => approve(k, text, by)}>Send message</button>
          <button className="btn" onClick={() => { setLang(pt.lang); setMode('edit') }}>Edit</button>
          <button className="btn" onClick={() => setMode('skip')}>Skip</button>
          <span className="cap inl">Demo: no real message is sent.</span>
        </Human>
      )}
    </section>
  )
}

export function Due() {
  const rows = useDueItems()
  const rem = useStore((s) => s.rem)
  const pts = useStore((s) => s.pts)
  const sel = useStore((s) => s.selDue)
  const setSel = useStore((s) => s.setSelDue)
  const [mode, setMode] = useState<Mode>(null)
  const left = rows.filter((r) => !rem[`${r.pid}:${r.key}`]).length
  const sent = 3 + Object.values(rem).filter((r) => r.st === 'sent').length
  const cur = rows.find((r) => `${r.pid}:${r.key}` === sel) ?? rows[0]
  return (
    <div className="page">
      <h1>Call list · Thursday</h1>
      <p className="lead"><b>{left}</b> to call · <b>{sent}</b> sent today</p>
      {rows.length === 0 ? (
        <p className="calm">No calls today.</p>
      ) : (
        <>
          <Table rows={rows} sel={cur ? `${cur.pid}:${cur.key}` : ''} onSel={(k) => { setSel(k); setMode(null) }} onAct={(k, m) => { setSel(k); setMode(m) }} />
          {cur && <Preview key={`${cur.pid}:${cur.key}`} it={cur} pt={pts.find((p) => p.id === cur.pid)!} mode={mode} setMode={setMode} />}
        </>
      )}
    </div>
  )
}
