import { useState } from 'react'
import { Modal } from '../components/ui'
import { ProtocolEditor } from '../components/ProtocolEditor'
import { VoiceConnection } from '../components/Voice'
import { CHECK, CLINIC, REMINDER } from '../logic/phrases'
import { useStore } from '../store/store'

export function Audit() {
  const aud = useStore((s) => s.aud)
  const undo = useStore((s) => s.undo)
  return (
    <div className="page">
      <h1>History</h1>
      <p className="lead">Everything done in this app is listed here. It cannot be changed.</p>
      <table className="tbl audit" data-tour="audit">
        <thead><tr><th>Time</th><th>Who</th><th>Job</th><th>What was done</th><th>Details</th><th>Can undo?</th></tr></thead>
        <tbody>
          {aud.map((a) => (
            <tr key={a.id}>
              <td className="nowrap">{a.when}</td><td>{a.who}</td><td>{a.role}</td><td>{a.act}</td><td className="muted">{a.det}</td>
              <td>
                {a.undo && !a.undone && <button className="link" onClick={() => undo(a.id)}>Undo</button>}
                {a.undo && a.undone && <span className="muted">Undone</span>}
                {!a.undo && <span className="muted">No</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const BACKUPS = ['Today 02:00', 'Yesterday 02:00', '16 Dec 2025 02:00']

export function Settings() {
  const vers = useStore((s) => s.vers)
  const role = useStore((s) => s.role)
  const revert = useStore((s) => s.revert)
  const log = useStore((s) => s.log)
  const say = useStore((s) => s.say)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(BACKUPS[0])
  const doc = role === 'doc'
  return (
    <div className="page settings">
      <h1>Settings</h1>
      <VoiceConnection />
      <section className="panel" data-tour="protocol">
        <h2 className="sub">Test schedule</h2>
        <p className="muted">How often each test is done. Only the doctor can change this.</p>
        <ProtocolEditor />
        <h3 className="lab" style={{ marginTop: 20 }}>OLD VERSIONS</h3>
        <ul className="vers">
          {[...vers].reverse().map((v, i) => (
            <li key={v.n}>
              <b>Version {v.n}</b> · {v.at} · {v.by} · {v.reason}
              <span className="muted"> · kidney {v.cfg.panel}, repeat urine {v.cfg.rptMin}–{v.cfg.rptMax}, repeat blood {v.cfg.egfr2}, eye {v.cfg.fundus}, foot {v.cfg.foot} months</span>
              {i === 0 ? <span className="muted"> · current</span> : (
                <button className="btn" disabled={!doc} title={doc ? undefined : 'Doctor only'} onClick={() => revert(v.n)}>Go back to this version</button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2 className="sub">Units and lab reference ranges</h2>
        <p className="muted">Reference ranges come from each lab.</p>
        <table className="tbl">
          <thead><tr><th>Test</th><th>Unit</th><th>Lab reference</th></tr></thead>
          <tbody>
            <tr><td>Blood test (eGFR)</td><td>mL/min/1.73 m²</td><td>Lab A ≥90 · Lab B &gt;90</td></tr>
            <tr><td>Urine test (UACR)</td><td>mg/g</td><td>&lt;30</td></tr>
            <tr><td>Creatinine (blood)</td><td>mg/dL</td><td>Lab A 0.60–1.10 · Lab B 53–97 µmol/L</td></tr>
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2 className="sub">Backup</h2>
        <p>Backup runs every night at 2:00 am. Last backup: today ✓</p>
        <button className="btn" onClick={() => setOpen(true)}>Go back to a backup…</button>
        {open && (
          <Modal title="Go back to a backup" onClose={() => setOpen(false)}>
            <fieldset className="radios">
              {BACKUPS.map((b) => <label key={b}><input type="radio" name="bk" checked={pick === b} onChange={() => setPick(b)} /> {b}</label>)}
            </fieldset>
            <p className="cap">Demo: nothing is changed.</p>
            <div className="btns">
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn solid" onClick={() => { log('Backup used', `Backup chosen: ${pick} · demo, nothing changed`); say('Done. Demo: nothing is changed.'); setOpen(false) }}>Go back</button>
            </div>
          </Modal>
        )}
      </section>
      <section className="panel">
        <h2 className="sub">Message words</h2>
        <p className="muted">Message text. The name, clinic ({CLINIC}), and test are filled in for you. View only.</p>
        <table className="tbl">
          <thead><tr><th>Language</th><th>Message</th></tr></thead>
          <tbody>
            <tr><td>English</td><td lang="en">{REMINDER.en}</td></tr>
            <tr><td>Hindi</td><td lang="hi">{REMINDER.hi}</td></tr>
            <tr><td>Bengali</td><td lang="bn">{REMINDER.bn}</td></tr>
          </tbody>
        </table>
        <table className="tbl">
          <thead><tr><th>English</th><th>Hindi</th><th>Bengali</th></tr></thead>
          <tbody>
            {Object.entries(CHECK).map(([k, v]) => <tr key={k}><td>{v.en}</td><td lang="hi">{v.hi}</td><td lang="bn">{v.bn}</td></tr>)}
          </tbody>
        </table>
        <p className="cap">Hindi and Bengali words are drafts. A native speaker needs to read them before real use.</p>
      </section>
      <section className="panel">
        <h2 className="sub">About</h2>
        <p>Demo version 0.2</p>
        <p className="cap">All names, numbers and reports are made up. A PDF you add is read inside this page and kept in memory only.</p>
      </section>
    </div>
  )
}

// the only page where the excluded words may appear (see scope-allow.json)
const NOT = [
  ['Diagnosis', 'Shows results on a map. The doctor decides.'],
  ['Treatment advice', 'Only saves what the doctor writes.'],
  ['Choosing for the doctor', 'Shows which test is due.'],
  ['Risk scoring', 'Shows real results only. No guessing.'],
  ['Explaining results', 'Copies numbers from the lab report and checks the unit.'],
  ['Guessing from a photo of a report', 'Reads the photo, copies the number and shows where it came from. If it is not sure, a person checks.'],
  ['Answering questions about reports', 'Searching shows the words that are in the report. It never writes an answer.'],
  ['Messages on its own', 'Writes a reminder. A person must send it.'],
]
export function Scope() {
  return (
    <div className="page scope">
      <h1>What this app does not do</h1>
      <p className="lead">It does not diagnose. It does not give a score. It does not give advice.</p>
      <table className="tbl">
        <thead><tr><th>It does not do this</th><th>It does this instead</th></tr></thead>
        <tbody>{NOT.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
      <p className="cap">Click any number to see the lab report it came from.</p>
    </div>
  )
}
