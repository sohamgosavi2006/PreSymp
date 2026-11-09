import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createVoiceHandler } from './voice.mjs'

async function gateway(t, options = {}) {
  const server = createServer(createVoiceHandler(options))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}/api/voice`
}
const speech = (input = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'नमस्ते', language_code: 'hi-IN', consent: true, ...input }) })
function recording(input = {}) {
  const form = new FormData()
  form.set('file', new Blob(['test audio'], { type: 'audio/webm;codecs=opus' }), 'recording.webm')
  form.set('consent', 'true'); form.set('language_code', 'hi-IN'); form.set('mode', 'codemix')
  for (const [key, value] of Object.entries(input)) form.set(key, value)
  return { method: 'POST', body: form }
}

test('status exposes only configuration; no-key recording requests fail clearly', async (t) => {
  const base = await gateway(t)
  assert.deepEqual(await (await fetch(`${base}/status`)).json(), { configured: false })
  const res = await fetch(`${base}/speak`, speech())
  assert.equal(res.status, 503)
  assert.match((await res.json()).error, /SARVAM_API_KEY/)
})

test('speech gateway keeps key server-side and uses the documented contract', async (t) => {
  const base = await gateway(t, { apiKey: 'server-secret', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.sarvam.ai/text-to-speech')
    assert.equal(options.headers['api-subscription-key'], 'server-secret')
    const input = JSON.parse(options.body)
    assert.equal(input.language_code, 'hi-IN')
    assert.equal(input.model, 'bulbul:v3')
    assert.equal(input.text, 'नमस्ते')
    return Response.json({ audios: ['audio-base64'], request_id: 'private' })
  } })
  assert.deepEqual(await (await fetch(`${base}/status`)).json(), { configured: true })
  const res = await fetch(`${base}/speak`, speech())
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await res.json(), { audios: ['audio-base64'] })
})

test('transcription forwards only audio, language and mode with server authentication', async (t) => {
  const base = await gateway(t, { apiKey: 'key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.sarvam.ai/speech-to-text')
    assert.equal(options.body.get('model'), 'saaras:v3')
    assert.equal(options.body.get('mode'), 'codemix')
    assert.equal(options.body.get('language_code'), 'hi-IN')
    assert.equal(options.body.get('consent'), null)
    assert.equal(await options.body.get('file').text(), 'test audio')
    assert.equal(options.body.get('file').type, 'audio/webm')
    return Response.json({ transcript: 'मेरा नाम Kabita है', language_code: 'hi-IN' })
  } })
  assert.deepEqual(await (await fetch(`${base}/transcribe`, recording())).json(), { transcript: 'मेरा नाम Kabita है', language_code: 'hi-IN' })
})

test('consent, length, language and method validation prevent upstream calls', async (t) => {
  let calls = 0
  const base = await gateway(t, { apiKey: 'key', fetchImpl: async () => { calls++; return Response.json({}) } })
  for (const [path, body] of [
    ['speak', speech({ consent: false })], ['speak', speech({ text: 'x'.repeat(2501) })],
    ['speak', speech({ language_code: 'unknown' })], ['speak', speech({ text: ' ' })],
    ['transcribe', recording({ consent: 'false' })], ['transcribe', recording({ mode: 'invalid' })],
    ['transcribe', recording({ language_code: 'invalid' })],
  ]) assert.equal((await fetch(`${base}/${path}`, body)).status, 400)
  assert.equal((await fetch(`${base}/speak`)).status, 405)
  assert.equal((await fetch(`${base}/speak`, { ...speech(), headers: { 'content-type': 'application/json', origin: 'https://another-site.example' } })).status, 403)
  assert.equal((await fetch(`${base}/speak`, { method: 'POST', body: 'x'.repeat(4 * 1024 * 1024 + 1) })).status, 413)
  assert.equal(calls, 0)
})

test('provider failures do not expose keys, input text or upstream responses', async (t) => {
  const base = await gateway(t, { apiKey: 'secret', fetchImpl: async () => Response.json({ error: 'secret patient text' }, { status: 403 }) })
  const res = await fetch(`${base}/speak`, speech())
  assert.equal(res.status, 502)
  assert.doesNotMatch(await res.text(), /secret|patient text/)
})

test('empty provider responses and connection failures are actionable', async (t) => {
  const base = await gateway(t, { apiKey: 'key', fetchImpl: async () => Response.json({ transcript: '' }) })
  const res = await fetch(`${base}/transcribe`, recording())
  assert.equal(res.status, 422)
  assert.match((await res.json()).error, /No speech/)
  assert.equal((await fetch(`${base}/speak`, speech())).status, 502)
  const disconnected = await gateway(t, { apiKey: 'key', fetchImpl: async () => { throw new Error('secret connection details') } })
  const fail = await fetch(`${disconnected}/speak`, speech())
  assert.equal(fail.status, 502)
  assert.doesNotMatch(await fail.text(), /secret connection/)
})
