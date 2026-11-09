import { useEffect, useRef, useState } from 'react'
import { go } from '../hooks'
import { lastCfg, useStore } from '../store/store'

const STEPS = [
  { title: 'Today', body: '4 patients to call. 1 new report. Banerjee has nothing to do.', sel: '[data-tour="daylist"]' },
  { title: 'Open Sunita Devi', body: 'All her kidney results on one page.', sel: '[data-tour="ribbon"]' },
  { title: 'Point at the map', body: 'Each dot is one visit.', sel: '[data-tour="map"]' },
  { title: 'Click 190', body: 'Click a number to see the lab report.', sel: '[data-hl="1"]' },
  { title: 'Add a report: text PDF', body: 'Sample 1 is read here, in this page. The unit is checked, the patient is matched, and it is saved.', sel: '[data-tour="stepper"], .modal' },
  { title: 'Click the new UACR value', body: 'The real page opens. The marker shows the exact line the number came from.', sel: '[data-testid="doc-hl"]' },
  { title: 'Add a phone photo', body: 'The photo is read by OCR on this computer. The unit is converted, and the original is kept.', sel: '[data-tour="stepper"], .modal' },
  { title: 'Wrong unit', body: 'eGFR printed as mL/min cannot be compared. It goes to To check. A person decides.', sel: '[data-tour="stepper"], .modal, [data-tour="qmatch"]' },
  { title: 'Find "eye"', body: 'Search shows the report\'s own words. It never writes an answer.', sel: '[data-tour="find"]' },
  { title: 'Follow-up card in Bengali', body: 'Made from fixed phrases. A person approves, then prints.', sel: '.fcard' },
  { title: 'Listen, then send', body: 'Listen to the message before sending. A person presses Send.', sel: '[data-tour="preview"]' },
  { title: 'Doctor changes the schedule', body: 'Every change needs a reason. You can undo it.', sel: '[data-tour="protocol"]' },
]
const LAST = STEPS.length

export function Tour() {
  const step = useStore((s) => s.tour)
  const setTour = useStore((s) => s.setTour)
  const intake = useStore((s) => s.intake)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }
  const st = () => useStore.getState()
  // a file that is still being read is let finish before the tour moves on, so a quick Next never drops it
  const settled = (then: () => void, tries = 0) => {
    if (!['read', 'run'].includes(st().intake.status) || tries > 600) return then()
    later(() => settled(then, tries + 1), 300)
  }
  const click = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click()

  useEffect(() => {
    if (!step) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    const s = st()
    s.setPeek(step === 3)
    s.setMenu(false)
    if (step !== 9) s.setFindQ('')
    if (step === 1) { s.closeViewer(); go('#/day') }
    if (step === 2 || step === 3) { s.closeViewer(); go('#/patient/P-0417') }
    if (step === 4) {
      go('#/patient/P-0417')
      later(() => { const o = st().obs.find((x) => x.id === 'P-0417-2025-09-18-uacr'); if (o) st().openSrc(o) }, 250)
    }
    if (step === 5) { s.closeViewer(); go('#/day'); later(() => void st().ingestSample('kabita-banerjee-text.pdf'), 400) }
    if (step === 6) {
      go('#/patient/P-0533')
      const open = (n: number) => {
        const o = st().obs.find((x) => x.id === 'P-0533-2025-12-18-uacr')
        if (o) { st().closeIntake(); st().openSrc(o) } else if (n < 600) later(() => open(n + 1), 300)
      }
      later(() => open(0), 300)
    }
    if (step === 7) { s.closeViewer(); settled(() => { st().closeIntake(); go('#/patient/P-0932'); later(() => void st().ingestSample('a-khan-phone-photo.jpg'), 400) }) }
    if (step === 8) { settled(() => { st().closeIntake(); go('#/queue'); later(() => void st().ingestSample('m-roy-wrong-unit.pdf'), 400) }) }
    if (step === 9) {
      settled(() => { st().closeIntake(); go('#/patient/P-0417'); later(() => st().setFindQ('eye'), 500) })
    }
    if (step === 10) { st().setFindQ(''); go('#/card/P-0533') }
    if (step === 11) {
      go('#/due'); s.setSelDue('P-0288:rpt')
      later(() => click('[data-tour="listen"]'), 900)
      later(() => { if (!st().rem['P-0288:rpt']) click('[data-tour="approve"]') }, 3200)
    }
    if (step === 12) {
      s.setRole('doc'); go('#/settings')
      later(() => st().setEdHint({ cfg: { fundus: 6 }, reason: 'Eye check every 6 months for this clinic' }), 700)
      later(() => {
        const v = st()
        if (v.vers.length < 3) v.saveVer({ ...lastCfg(v.vers), fundus: 6 }, 'Eye check every 6 months for this clinic')
        v.setEdHint(null)
        go('#/audit')
      }, 3600)
    }
    return () => timers.current.forEach(clearTimeout)
  }, [step])

  // steps 5, 7 and 8: once the file has been handled, close the dialog so the next step starts clean
  useEffect(() => {
    if (![5, 7, 8].includes(step) || !['done', 'stop', 'wait'].includes(intake.status)) return
    const h = window.setTimeout(() => st().closeIntake(), 1800)
    return () => clearTimeout(h)
  }, [step, intake.status])

  useEffect(() => {
    if (!step) { setRect(null); return }
    const h = setInterval(() => {
      const el = document.querySelector(STEPS[step - 1].sel)
      setRect(el ? el.getBoundingClientRect() : null)
    }, 250)
    return () => clearInterval(h)
  }, [step])

  if (!step) return null
  const d = STEPS[step - 1]
  const exit = () => { setTour(0); st().setPeek(false); st().setMenu(false); st().setFindQ('') }
  return (
    <>
      {rect && <div className="ring" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <aside className="tour" role="complementary" aria-label="Show me how">
        <p className="lab">STEP {step} OF {LAST}</p>
        <h3>{d.title}</h3>
        <p>{d.body}</p>
        {step === LAST && <p className="end">The lab report gives the number. This app makes sure the next test is not missed.</p>}
        <div className="btns">
          <button className="btn" disabled={step === 1} onClick={() => setTour(step - 1)}>Back</button>
          {step < LAST ? <button className="btn solid" onClick={() => setTour(step + 1)}>Next</button> : <button className="btn solid" onClick={exit}>Finish</button>}
          <button className="btn quiet" onClick={exit}>Exit</button>
        </div>
      </aside>
    </>
  )
}
