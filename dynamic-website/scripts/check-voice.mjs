// A real TTS -> STT round trip using a synthetic greeting, never patient data.
try { process.loadEnvFile('.env') } catch { /* Use process environment when supplied. */ }
if (!process.env.SARVAM_API_KEY) { console.error('Set SARVAM_API_KEY in .env first.'); process.exit(1) }
const { createServer } = await import('node:http')
const { createVoiceHandler } = await import('../server/voice.mjs')
const server = createServer(createVoiceHandler({ apiKey: process.env.SARVAM_API_KEY }))
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/voice`
try {
  const speech = await fetch(`${base}/speak`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'नमस्ते। आपका स्वागत है।', language_code: 'hi-IN', consent: true }) })
  const data = await speech.json()
  if (!speech.ok) throw new Error(data.error)
  const audio = Buffer.from(data.audios[0], 'base64')
  if (audio.length < 44) throw new Error('No usable audio returned.')
  console.log(`Sarvam speech: passed (${audio.length} audio bytes; no key printed)`)
  const form = new FormData()
  form.set('file', new Blob([audio], { type: 'audio/wav' }), 'synthetic-greeting.wav')
  form.set('language_code', 'hi-IN'); form.set('consent', 'true'); form.set('mode', 'transcribe')
  const res = await fetch(`${base}/transcribe`, { method: 'POST', body: form })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error)
  if (!result.transcript?.trim()) throw new Error('Empty transcript.')
  console.log(`Sarvam transcription: passed (${result.language_code}; synthetic greeting round trip)`)
} catch (e) { console.error(e.message); process.exitCode = 1 }
finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
