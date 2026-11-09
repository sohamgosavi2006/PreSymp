import { useEffect, useState } from 'react'
import { Charts } from '../components/Charts'
import { KidneyMap } from '../components/KidneyMap'
import { NextStrip, Schedule } from '../components/NextTests'
import { ReportsRail } from '../components/ReportsRail'
import { DownloadMenu, ResultsTable } from '../components/ResultsTable'
import { Human } from '../components/ui'
import { PatientVoice } from '../components/Voice'
import { go, useVisits } from '../hooks'
import { fmt, fmtMonth, monthsBetween, sinceText, TODAY } from '../logic/dates'
import { LANG_NAME } from '../logic/phrases'
import { useStore } from '../store/store'
import type { Pt } from '../store/types'

function Ribbon({ pt }: { pt: Pt }) {
  const vs = useVisits(pt.id)
  const docs = useStore((s) => s.docs)
  const obs = useStore((s) => s.obs)
  const openSrc = useStore((s) => s.openSrc)
  const last = vs[vs.length - 1]
  const eye = docs.filter((d) => d.pid === pt.id && d.kind === 'fundus').sort((a, b) => a.d.localeCompare(b.d)).pop()
  const src = (k: 'egfr' | 'uacr', v: number) => {
    const o = obs.find((x) => x.pid === pt.id && x.d === last.d && x.kind === k)
    return <button className="val" aria-label={`${k === 'egfr' ? 'eGFR' : 'UACR'} ${v}, open source line`} onClick={() => o && openSrc(o)}>{v}</button>
  }
  return (
    <div className="pribbon" data-tour="ribbon">
      <div className="pr-top">
        <div className="pr-name">{pt.name}<small>{pt.sex} · {pt.age} y · ID {pt.id} · {pt.phone} · {LANG_NAME[pt.lang]}</small></div>
        <div className="pr-right">
          <button className="btn" onClick={() => go(`#/card/${pt.id}`)} data-testid="open-card">Follow-up card</button>
          <a className="btn voice-entry" href="#patient-voice" onClick={(e) => { e.preventDefault(); document.getElementById('patient-voice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Voice messages</a>
          <Human className="small">The doctor decides.</Human>
        </div>
      </div>
      <div className="pr-facts">
        <span>Latest (<button className="dateb" aria-label={`${fmt(last.d)}, open source report`} onClick={() => { const o = obs.find((x) => x.pid === pt.id && x.d === last.d && x.kind === 'uacr'); if (o) openSrc(o) }}>{fmt(last.d)}</button>): eGFR <b>{src('egfr', last.egfr)}</b> · UACR <b>{src('uacr', last.uacr)}</b></span>
        <span><b>{vs.length} kidney test{vs.length === 1 ? '' : 's'}</b> saved · {fmtMonth(vs[0].d)} to {fmtMonth(last.d)}</span>
        <span>Last kidney test: <b>{sinceText(last.d)} ago</b></span>
        {eye && <span>Eye test: <b>{monthsBetween(eye.d, TODAY)} months</b> ago</span>}
      </div>
    </div>
  )
}

export function Patient({ id }: { id: string }) {
  const pt = useStore((s) => s.pts.find((p) => p.id === id))
  const vs = useVisits(id)
  const [sel, setSel] = useState('')
  useEffect(() => setSel(''), [id])
  if (!pt || !vs.length)
    return <div className="page"><h1>Patient not found</h1><p><a href="#/day">Back to today</a></p></div>
  return (
    <div className="page patient">
      <Ribbon pt={pt} />
      <NextStrip pid={id} />
      <div className="pgrid">
        <KidneyMap pid={id} sel={sel} onSel={setSel} />
        <ResultsTable pid={id} sel={sel} onSel={setSel} />
      </div>
      <div className="pgrid1"><Charts pid={id} /></div>
      <div className="pgrid low">
        <Schedule pid={id} />
        <ReportsRail pid={id} />
      </div>
      <div className="btns"><DownloadMenu pid={id} /></div>
      <div id="patient-voice" style={{ scrollMarginTop: 64 }}><PatientVoice key={id} pid={id} language={`${pt.lang}-IN`} /></div>
    </div>
  )
}
