import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { scenes } from './scenes.mjs'

const root = resolve('artifacts/walkthrough')
await mkdir(resolve(root, 'audio'), { recursive: true })
function duration(wav) {
  let rate = 0, bytes = 0
  for (let pos = 12; pos + 8 <= wav.length;) {
    const id = wav.toString('ascii', pos, pos + 4), size = wav.readUInt32LE(pos + 4)
    if (id === 'fmt ') rate = wav.readUInt32LE(pos + 16)
    if (id === 'data') bytes = Math.min(size, wav.length - pos - 8)
    pos += 8 + size + (size % 2)
  }
  if (!rate || !bytes) throw new Error('Cannot read generated WAV duration')
  return bytes / rate
}
async function speech(id, text) {
  const path = resolve(root, 'audio', `${id}.wav`)
  try {
    const wav = await readFile(path)
    return { path, duration: duration(wav) }
  } catch { /* Generate missing assets. */ }
  const res = await fetch('http://localhost:4173/api/voice/speak', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language_code: 'en-IN', consent: true }), signal: AbortSignal.timeout(60000),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Speech failed: ${res.status}`)
  const wav = Buffer.from(data.audios[0], 'base64')
  await writeFile(path, wav)
  console.log(`English narration ready: ${id}`)
  return { path, duration: duration(wav) }
}
const jobs = [...scenes, { id: 'input-search', narration: 'Sunita Devi.' }, { id: 'input-card', narration: 'Please bring your previous reports to your next clinic visit.' }, { id: 'input-patient', narration: 'My name is Sunita Devi. I will bring my old reports to my next clinic visit.' }]
const outputs = new Map()
let next = 0
await Promise.all([0, 1].map(async () => {
  while (next < jobs.length) {
    const job = jobs[next++]
    outputs.set(job.id, await speech(job.id, job.narration))
  }
}))
const manifest = scenes.map((s) => ({ ...s, ...outputs.get(s.id) }))
await writeFile(resolve(root, 'narration.json'), JSON.stringify(manifest, null, 2))
await writeFile(resolve(root, 'inputs.json'), JSON.stringify(Object.fromEntries([...outputs].filter(([id]) => id.startsWith('input-'))), null, 2))
await writeFile(resolve(root, 'voiceover-script.md'), '# PreSymp complete MVP walkthrough — English narration\n\nVoice: Sarvam Bulbul v3, Shubh. All patient data and microphone examples are synthetic. Timed script and subtitles are generated after recording.\n\n' + manifest.map((s) => `## ${s.title}\n\n${s.narration}\n`).join('\n'))
console.log(`Prepared ${manifest.length} chapters, ${Math.round(manifest.reduce((n, s) => n + s.duration, 0))} seconds of narration.`)
