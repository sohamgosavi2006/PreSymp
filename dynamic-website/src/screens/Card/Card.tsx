import '@fontsource/noto-sans-devanagari/devanagari-400.css'
import '@fontsource/noto-sans-devanagari/devanagari-700.css'
import '@fontsource/noto-sans-bengali/bengali-400.css'
import '@fontsource/noto-sans-bengali/bengali-700.css'
import './Card.css'
import { useEffect, useRef, useState } from 'react'
import { go, useItemsFor, useVisits } from '../../hooks'
import { LANGS, LANG_TAB, type Lang } from '../../logic/phrases'
import { useStore } from '../../store/store'
import { CardSheet, type CardData, type CardRow } from './CardSheet'
import { PatientVoice, SarvamListen } from '../../components/Voice'

const NOTE_MAX = 240

// png for WhatsApp: only the card node, fonts embedded so Hindi and Bengali are drawn the same as on screen
async function cardPng(node: HTMLElement) {
  const { toPng, getFontEmbedCSS } = await import('html-to-image')
  await document.fonts.ready
  const sample = node.innerText.slice(0, 400)
  await Promise.all(
    ['400', '700'].flatMap((w) => [`${w} 14px "Atkinson Hyperlegible"`, `${w} 14px "Noto Sans Devanagari"`, `${w} 14px "Noto Sans Bengali"`].map((f) => document.fonts.load(f, sample).catch(() => []))),
  )
  await document.fonts.ready
  const opts = { pixelRatio: 2, backgroundColor: '#FFFFFF' }
  const fontEmbedCSS = await getFontEmbedCSS(node, opts)
  return toPng(node, { ...opts, fontEmbedCSS })
}

// printable take-home card. every word comes from the fixed phrase bank, except the doctor's note, which prints as typed
export function Card({ id }: { id: string }) {
  const pt = useStore((s) => s.pts.find((p) => p.id === id))
  const role = useStore((s) => s.role)
  const appt = useStore((s) => s.appt[id] ?? '')
  const note = useStore((s) => s.note[id] ?? '')
  const setAppt = useStore((s) => s.setAppt)
  const setNote = useStore((s) => s.setNote)
  const approveCard = useStore((s) => s.approveCard)
  const items = useItemsFor(id)
  const vs = useVisits(id)
  const [lang, setLang] = useState<Lang>(pt?.lang ?? 'en')
  const [vals, setVals] = useState(false)
  const [okKey, setOkKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [spoken, setSpoken] = useState('')
  const sheet = useRef<HTMLElement>(null)
  const printBtn = useRef<HTMLButtonElement>(null)

  const showVals = vals && role === 'doc'
  // approval belongs to exactly what is on the card. any change to it clears the approval
  const key = JSON.stringify([id, lang, showVals, appt, note])
  const approved = okKey === key
  useEffect(() => { if (approved) printBtn.current?.focus() }, [approved])
  useEffect(() => setSpoken(sheet.current?.innerText ?? ''), [key, items])

  if (!pt) return <div className="page"><h1>Patient not found</h1><p><a href="#/day">Back to today</a></p></div>

  // done: the date of the last one on file, newest first. next: the date each one is due
  const done: CardRow[] = items.filter((i) => i.last).map((i) => ({ k: i.key, when: i.last! })).sort((a, b) => b.when.localeCompare(a.when))
  const next: CardRow[] = items.filter((i) => i.due && !i.text.startsWith('done')).map((i) => ({ k: i.key, when: i.due! })).sort((a, b) => a.when.localeCompare(b.when))
  const last = vs[vs.length - 1]
  const data: CardData = {
    lang, name: pt.name, pid: id, done, next, appt, note,
    results: !showVals ? null : last ? { d: last.d, egfr: last.egfr, uacr: last.uacr } : { none: true },
  }


  const approve = () => {
    approveCard(id, lang, showVals, 'approved')
    setOkKey(key)
  }
  const print = () => {
    if (!approved) return
    approveCard(id, lang, showVals, 'sent to print')
    window.print()
  }
  const save = async () => {
    if (!approved || busy || !sheet.current) return
    setBusy(true)
    const file = `follow-up-${id}-${lang}.png`
    try {
      const url = await cardPng(sheet.current)
      const a = document.createElement('a')
      a.href = url
      a.download = file
      document.body.appendChild(a)
      a.click()
      a.remove()
      approveCard(id, lang, showVals, 'saved as image')
      useStore.getState().say(`Saved ${file}. It can be sent on WhatsApp.`)
    } catch {
      useStore.getState().say('The image could not be saved. Use Print instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="noprint"><a href={`#/patient/${id}`}>← Back to {pt.name}</a></div>
      <h1 className="noprint">Follow-up card</h1>
      <div className="cardwrap cardpage">
        <div className="cardside noprint panel">
          <div className="row">
            <span className="lab" id="card-lang">Card language</span>
            <div className="seg" role="group" aria-labelledby="card-lang">
              {LANGS.map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_TAB[l]}</button>)}
            </div>
          </div>
          <div className="row">
            <label title={role === 'doc' ? undefined : 'Doctor only'}>
              <input type="checkbox" checked={showVals} disabled={role !== 'doc'} onChange={(e) => setVals(e.target.checked)} />
              Show last results
            </label>
            {role !== 'doc' && <span className="cap">Doctor only. Press Doctor at the top.</span>}
          </div>
          <div className="row">
            <label htmlFor="appt">Next appointment</label>
            <div className="inl">
              <input id="appt" type="date" value={appt} onChange={(e) => setAppt(id, e.target.value)} />
              {appt && <button className="btn quiet" onClick={() => setAppt(id, '')}>Clear</button>}
            </div>
          </div>
          <div className="row">
            <label htmlFor="cnote">Doctor's note (printed as typed)</label>
            <textarea id="cnote" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(id, e.target.value)} placeholder="Optional" />
            <span className="cap">{note.length} of {NOTE_MAX} letters. It is not translated.</span>
          </div>
          <div className="btns">
            <button className="btn solid" onClick={approve} disabled={approved} data-testid="approve">{approved ? 'Approved' : 'Approve'}</button>
            <button className="btn" ref={printBtn} onClick={print} disabled={!approved} data-testid="print">Print</button>
            <button className="btn" onClick={save} disabled={!approved || busy} data-testid="save-image">{busy ? 'Saving…' : 'Save as image'}</button>
          </div>
          <p className="cap" role="status" data-testid="approval">
            {approved ? 'Approved. Print or save this card now.' : 'Press Approve to turn on Print and Save as image. Any change to the card needs a new approval.'}
          </p>
          <button className="btn quiet" onClick={() => go(`#/patient/${id}`)}>Close</button>
          <p className="cap">Made from fixed phrases. Nothing is machine translated. A person approves before it prints.</p>
          <SarvamListen text={spoken} language={`${lang}-IN`} filename={`follow-up-${id}-${lang}`} />
        </div>

        <CardSheet ref={sheet} data={data} />
      </div>
      <PatientVoice key={id} pid={id} language={`${lang}-IN`} kind="card" onText={(text) => setNote(id, text)} />
    </div>
  )
}
