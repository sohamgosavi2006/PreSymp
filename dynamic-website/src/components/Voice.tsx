import { useEffect, useRef, useState } from 'react'
import { audioBlob, changeVoiceMessage, downloadVoice, listVoiceMessages, VOICE_LANGUAGES, voiceRequest, type VoiceMessage } from '../logic/voice'
import { useStore } from '../store/store'
import './Voice.css'

function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function Mic() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></svg>
}

export function SarvamListen({ text, language, filename = 'clinic-voice-note' }: { text: string; language: string; filename?: string }) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clip, setClip] = useState<Blob | null>(null)
  const url = useBlobUrl(clip)
  const abort = useRef<AbortController>()
  useEffect(() => {
    abort.current?.abort()
    setClip(null); setError(''); setBusy(false)
    return () => abort.current?.abort()
  }, [text, language])
  const generate = async () => {
    const controller = new AbortController()
    abort.current = controller
    setBusy(true); setError(''); setClip(null)
    try {
      const data = await voiceRequest('speak', { text, language_code: language, consent }, controller.signal)
      if (!controller.signal.aborted) setClip(audioBlob(data.audios[0]))
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="voice-listen">
    <label className="voice-consent"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) { abort.current?.abort(); setBusy(false) } }} /> Allow this text to be sent to Sarvam for speech.</label>
    <div className="btns">
      <button className="btn" disabled={!consent || busy || !text.trim() || text.length > 2500} onClick={generate}>{busy ? 'Making voice…' : 'Listen with Sarvam'}</button>
      {clip && <button className="btn quiet" onClick={() => downloadVoice(clip, `${filename}.wav`)}>Download spoken note</button>}
    </div>
    {url && <audio controls src={url} aria-label="Sarvam spoken note" />}
    {error && <p className="voice-error" role="status">{error}</p>}
    <p className="cap">Reads the text as written. Choose the language matching the text. Check the audio before sharing.</p>
  </div>
}

type Recording = { audio: Blob; transcript: string; language: string }
export function VoiceRecorder({ language = 'unknown', onText, textAction = 'Use transcript', onKeep, personal = false, maxText = 4000 }: {
  language?: string; onText?: (text: string) => void; textAction?: string
  onKeep?: (recording: Recording) => Promise<void>; personal?: boolean; maxText?: number
}) {
  const [lang, setLang] = useState(language)
  const [mode, setMode] = useState('transcribe')
  const [consent, setConsent] = useState(false)
  const [cloud, setCloud] = useState(false)
  const [stage, setStage] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [clip, setClip] = useState<Blob | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [kept, setKept] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const active = useRef(true)
  const abort = useRef<AbortController>()
  const url = useBlobUrl(clip)
  const available = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      abort.current?.abort()
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  const stop = () => {
    if (recorder.current?.state === 'recording') { setStage('stopping'); recorder.current.stop() }
    stream.current?.getTracks().forEach((t) => t.stop())
  }
  useEffect(() => {
    if (stage !== 'recording') return
    const start = Date.now()
    const timer = setInterval(() => {
      const n = Math.floor((Date.now() - start) / 1000)
      setSeconds(Math.min(n, 25))
      if (n >= 25) stop()
    }, 250)
    return () => clearInterval(timer)
  }, [stage])
  const record = async () => {
    if (!available || !consent || stage !== 'idle') return
    setStage('starting'); setError('')
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      if (!active.current) { mic.getTracks().forEach((t) => t.stop()); return }
      stream.current = mic
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m))
      const r = new MediaRecorder(mic, mimeType ? { mimeType } : undefined)
      recorder.current = r
      const parts: Blob[] = []
      r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data) }
      r.onerror = () => { mic.getTracks().forEach((t) => t.stop()); if (active.current) { setStage('idle'); setError('The microphone stopped. Try recording again.') } }
      r.onstop = () => {
        mic.getTracks().forEach((t) => t.stop())
        if (!active.current) return
        const audio = new Blob(parts, { type: r.mimeType || 'audio/webm' })
        if (audio.size) { setClip(audio); setText(''); setKept(false) }
        else setError('No audio was captured. Please try again.')
        setStage('idle')
      }
      r.start(); setSeconds(0); setStage('recording')
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop())
      if (active.current) { setStage('idle'); setError((e as Error).name === 'NotAllowedError' ? 'Microphone permission was not granted. Allow the microphone in your browser and retry.' : 'Microphone unavailable. Use HTTPS or localhost and check the connected microphone.') }
    }
  }
  const transcribe = async () => {
    if (!clip) return
    const controller = new AbortController()
    abort.current = controller
    setBusy(true); setError('')
    const form = new FormData()
    // The provider accepts the container MIME type without MediaRecorder's codec suffix.
    const upload = new Blob([clip], { type: clip.type.split(';')[0] })
    form.set('file', upload, clip.type.includes('mp4') ? 'recording.m4a' : clip.type.includes('ogg') ? 'recording.ogg' : 'recording.webm')
    form.set('language_code', lang); form.set('mode', mode); form.set('consent', String(cloud))
    try {
      const data = await voiceRequest('transcribe', form, controller.signal)
      if (!controller.signal.aborted) { setText(data.transcript); setKept(false) }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  const keep = async () => {
    if (!clip || !onKeep) return
    setKeeping(true); setError('')
    try { await onKeep({ audio: clip, transcript: text, language: lang }); if (active.current) setKept(true) }
    catch (e) { if (active.current) setError((e as Error).message) }
    finally { if (active.current) setKeeping(false) }
  }
  const locked = stage !== 'idle' || busy || keeping
  return <div className="voice-recorder">
    <label className="voice-consent"><input type="checkbox" checked={consent} disabled={locked} onChange={(e) => setConsent(e.target.checked)} /> {personal ? 'I agree to record my voice search.' : 'The patient agreed to this recording and keeping it on this device.'}</label>
    <div className="voice-options">
      <label>Spoken language<select aria-label="Spoken language" value={lang} disabled={locked} onChange={(e) => setLang(e.target.value)}><option value="unknown">Auto-detect / Hinglish</option>{VOICE_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label>Transcript format<select aria-label="Transcript format" value={mode} disabled={locked} onChange={(e) => setMode(e.target.value)}><option value="transcribe">As spoken</option><option value="codemix">Mixed Indian + English</option><option value="translate">English translation</option></select></label>
    </div>
    <div className="btns">
      <button className="btn solid voice-mic" disabled={!available || !consent || locked} onClick={record}><Mic /> {clip ? 'Record another clip' : 'Record voice'}</button>
      {(stage === 'recording' || stage === 'stopping') && <button className="btn" onClick={stop} disabled={stage === 'stopping'}>Stop recording · {seconds}s / 25s</button>}
      {stage === 'starting' && <span role="status">Waiting for microphone…</span>}
      {clip && <button className="btn quiet" disabled={locked} onClick={() => downloadVoice(clip, `voice-${Date.now()}.${clip.type.includes('mp4') ? 'm4a' : clip.type.includes('ogg') ? 'ogg' : 'webm'}`)}>Download recording</button>}
    </div>
    {!available && <p className="cap">Recording needs a supported browser on HTTPS or localhost. Typed notes and patient search still work.</p>}
    {url && <audio controls src={url} aria-label="Recorded voice preview" />}
    {clip && <>
      <label className="voice-consent"><input type="checkbox" checked={cloud} disabled={busy} onChange={(e) => setCloud(e.target.checked)} /> Send this clip to Sarvam for transcription.</label>
      <div className="btns"><button className="btn" disabled={!cloud || locked} onClick={transcribe}>{busy ? 'Transcribing…' : 'Transcribe with Sarvam'}</button></div>
      <label className="voice-text">Review transcript<textarea aria-label="Review transcript" rows={3} value={text} disabled={locked} onChange={(e) => { setText(e.target.value); setKept(false) }} placeholder="Transcribe, or type a note about this recording." /></label>
      {text.length > maxText && <p className="cap">Shorten the text to {maxText} characters to use it here.</p>}
      <div className="btns">
        {onText && <button className="btn" disabled={locked || !text.trim() || text.length > maxText} onClick={() => onText(text.trim())}>{textAction}</button>}
        {onKeep && <button className="btn solid" disabled={locked || kept} onClick={keep}>{keeping ? 'Saving…' : kept ? 'Saved on this device' : 'Keep voice message'}</button>}
        <button className="btn quiet" disabled={locked} onClick={() => { setClip(null); setText(''); setError(''); setKept(false) }}>Discard this clip</button>
      </div>
    </>}
    {error && <p className="voice-error" role="status">{error}</p>}
    <p className="cap">25 seconds per clip. Nothing uploads until you press Transcribe. Review names, numbers and medicines against the recording.</p>
  </div>
}

function SavedVoice({ message, onDelete, onText }: { message: VoiceMessage; onDelete: (id: string) => void; onText?: (text: string) => void }) {
  const url = useBlobUrl(message.audio)
  const [remove, setRemove] = useState(false)
  return <li className="saved-voice">
    <div className="voice-heading"><b>{message.kind === 'card' ? 'Card voice note' : 'Patient voice message'}</b><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('en-IN')}</time></div>
    {url && <audio controls src={url} aria-label="Saved voice message" />}
    {message.transcript && <p className="voice-transcript">{message.transcript}</p>}
    <div className="btns"><button className="btn quiet" onClick={() => downloadVoice(message.audio, `${message.kind}-voice-${message.pid}-${message.id}.${message.audio.type.includes('mp4') ? 'm4a' : message.audio.type.includes('ogg') ? 'ogg' : 'webm'}`)}>Download</button>
      {onText && message.transcript.trim() && <button className="btn" disabled={message.transcript.length > 240} onClick={() => onText(message.transcript.trim())}>Use saved transcript as card note</button>}
      {remove ? <><span>Delete this saved recording?</span><button className="btn" onClick={() => onDelete(message.id)}>Delete recording</button><button className="btn quiet" onClick={() => setRemove(false)}>Cancel</button></> : <button className="btn quiet" onClick={() => setRemove(true)}>Delete…</button>}
    </div>
  </li>
}

export function PatientVoice({ pid, language, kind = 'patient', onText }: { pid: string; language: string; kind?: 'patient' | 'card'; onText?: (text: string) => void }) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [error, setError] = useState('')
  const log = useStore((s) => s.log)
  useEffect(() => {
    let active = true
    const load = () => listVoiceMessages(pid).then((all) => { if (active) setMessages(all.filter((m) => m.kind === kind)) }).catch((e) => { if (active) setError(e.message) })
    void load()
    window.addEventListener('presymp-voice-change', load)
    return () => { active = false; window.removeEventListener('presymp-voice-change', load) }
  }, [pid, kind])
  const keep = async (recording: Recording) => {
    await changeVoiceMessage({ ...recording, id: crypto.randomUUID(), pid, kind, createdAt: new Date().toISOString() })
    log('Voice message saved', `${pid} · ${kind} · saved on this device with recording consent`)
  }
  const remove = async (id: string) => {
    try { await changeVoiceMessage(id); log('Voice message deleted', `${pid} · ${kind} · removed from this device`) }
    catch (e) { setError((e as Error).message) }
  }
  return <section className="voice-panel panel noprint" aria-label={kind === 'card' ? 'Card voice note' : 'Patient voice messages'}>
    <div className="voice-heading"><h2 className="sub">{kind === 'card' ? 'Voice note on the card' : 'Patient voice messages'}</h2><span className="voice-tag">On this device</span></div>
    <p className="cap">{kind === 'card' ? 'Record a take-home message. Use a checked transcript as the printed note, and download the audio to share alongside the card.' : 'Keep the patient’s own words with their file. Record, listen back and save a message.'}</p>
    <VoiceRecorder language={language} onKeep={keep} onText={onText} textAction="Use as card note" maxText={kind === 'card' ? 240 : 4000} />
    {error && <p className="voice-error" role="status">{error}</p>}
    {messages.length > 0 && <><h3 className="lab">Saved recordings · {messages.length}</h3><ul className="saved-voices">{messages.map((m) => <SavedVoice key={m.id} message={m} onDelete={remove} onText={onText} />)}</ul></>}
    <p className="cap">Saved audio stays in this browser after reload. Clearing site data removes it. Download a copy for your clinic record. Start again does not erase saved recordings.</p>
  </section>
}

export function VoiceSearch({ onText }: { onText: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  return <div className="voice-search">
    <button className="voice-search-button" aria-label="Voice search" aria-expanded={open} onClick={() => setOpen(!open)}><Mic /></button>
    {open && <div className="voice-search-popover" role="dialog" aria-label="Voice search">
      <div className="voice-heading"><h2 className="sub">Voice search</h2><button className="btn quiet" onClick={() => setOpen(false)} aria-label="Close voice search">Close</button></div>
      <p className="cap">Say the patient’s name, ID or phone digits. Check the words, then search.</p>
      <VoiceRecorder personal onText={(text) => { onText(text); setOpen(false); document.getElementById('pt-search')?.focus() }} textAction="Search these words" />
    </div>}
  </div>
}

export function VoiceConnection() {
  const [state, setState] = useState('Checking connection…')
  const check = async () => {
    setState('Checking connection…')
    try {
      const res = await fetch('/api/voice/status', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setState(data.configured ? 'Sarvam key is configured on the server. Voice is ready to try.' : 'Set SARVAM_API_KEY in .env on the server, then restart. Local recording and saved messages work without a key.')
    } catch { setState('Voice needs the app server. Run npm start or npm run dev. Local recording and saved messages still work.') }
  }
  useEffect(() => { void check() }, [])
  return <section className="panel"><h2 className="sub">Sarvam voice</h2><p role="status">{state}</p><button className="btn" onClick={check}>Check voice connection</button><p className="cap">Indian-language speech, card audio, voice search and saved patient recordings. Audio or text is sent to Sarvam only after consent and an explicit action. Kept recordings are stored in this browser, separately from the demo data.</p></section>
}
