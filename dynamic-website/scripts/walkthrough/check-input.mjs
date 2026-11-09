import { readFile } from 'node:fs/promises'
const path = process.argv[2] || 'artifacts/walkthrough/audio/input-card.wav'
const file = await readFile(path)
const form = new FormData()
form.set('file', new Blob([file], { type: process.argv[3] || (path.endsWith('webm') ? 'audio/webm' : 'audio/wav') }), path.split('/').pop())
form.set('consent', 'true'); form.set('language_code', 'en-IN'); form.set('mode', 'transcribe')
const res = await fetch('http://localhost:4173/api/voice/transcribe', { method: 'POST', body: form })
console.log('Synthetic input check:', res.status, await res.text())
if (!res.ok) process.exitCode = 1
