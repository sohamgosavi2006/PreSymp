// Same-origin gateway: credentials never enter the browser bundle.
const LANGS = new Set(['unknown', 'en-IN', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'od-IN'])
const MAX_BODY = 4 * 1024 * 1024

export function createVoiceHandler({ apiKey, fetchImpl = fetch } = {}) {
  const key = () => typeof apiKey === 'function' ? apiKey() : apiKey
  return async function voiceHandler(req, res, next = () => { res.statusCode = 404; res.end() }) {
    const path = (req.url || '').split('?')[0]
    if (!path.startsWith('/api/voice/')) return next()
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(body))
    }
    // Reject browser requests from other origins, including to a localhost server.
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Use voice from the clinic app on this server.' })
      } catch { return send(403, { error: 'Invalid request origin.' }) }
    }
    if (path === '/api/voice/status' && req.method === 'GET') return send(200, { configured: Boolean(key()) })
    if (!['/api/voice/transcribe', '/api/voice/speak'].includes(path)) return send(404, { error: 'Voice endpoint not found.' })
    if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
    if (!key()) return send(503, { error: 'Sarvam is not connected. Set SARVAM_API_KEY on the server and restart. Recording and saving on this device still work.' })
    try {
      let size = 0
      const parts = []
      for await (const part of req) {
        size += part.length
        if (size > MAX_BODY) return send(413, { error: 'Use an audio clip under 4 MB and 30 seconds.' })
        parts.push(part)
      }
      const body = Buffer.concat(parts)
      let upstream
      const headers = { 'api-subscription-key': key() }
      if (path.endsWith('/transcribe')) {
        const request = new Request('http://localhost', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body })
        let form
        try { form = await request.formData() } catch { return send(400, { error: 'An audio recording is required.' }) }
        const file = form.get('file')
        const lang = form.get('language_code') || 'unknown'
        const mode = form.get('mode') || 'transcribe'
        if (form.get('consent') !== 'true') return send(400, { error: 'Consent is required before sending audio to Sarvam.' })
        if (!(file instanceof Blob) || !file.size || file.size > MAX_BODY || !/^(audio\/|video\/webm)/.test(file.type)) return send(400, { error: 'Use a non-empty audio recording under 4 MB.' })
        if (!LANGS.has(lang) || !['transcribe', 'translate', 'codemix'].includes(mode)) return send(400, { error: 'Choose a supported language and transcript format.' })
        const outgoing = new FormData()
        outgoing.set('file', new Blob([file], { type: file.type.split(';')[0] }), file.name || 'recording.webm')
        outgoing.set('model', 'saaras:v3')
        outgoing.set('language_code', lang)
        outgoing.set('mode', mode)
        upstream = await fetchImpl('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers, body: outgoing, signal: AbortSignal.timeout(45000) })
      } else {
        let input
        try { input = JSON.parse(body.toString('utf8')) } catch { return send(400, { error: 'Invalid speech request.' }) }
        if (input.consent !== true) return send(400, { error: 'Consent is required before sending text to Sarvam.' })
        if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2500 || !LANGS.has(input.language_code) || input.language_code === 'unknown') return send(400, { error: 'Enter 1–2500 characters and choose a playback language.' })
        upstream = await fetchImpl('https://api.sarvam.ai/text-to-speech', {
          method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ text: input.text.trim(), target_language_code: input.language_code, language_code: input.language_code, model: 'bulbul:v3', speaker: 'shubh', pace: 0.9, output_audio_codec: 'wav' }),
          signal: AbortSignal.timeout(45000),
        })
      }
      // Never return provider error bodies: they can contain request text or credentials.
      if (!upstream.ok) {
        const error = upstream.status === 401 || upstream.status === 403 ? 'Sarvam did not accept the server key. Check the connection.'
          : upstream.status === 429 ? 'Sarvam is busy or out of credits. Try again shortly.'
          : 'Sarvam could not process this request. Try a shorter, clearer clip or text.'
        return send(502, { error })
      }
      const result = await upstream.json()
      if (path.endsWith('/transcribe')) {
        if (typeof result.transcript !== 'string' || !result.transcript.trim()) return send(422, { error: 'No speech was found. Try again closer to the microphone.' })
        return send(200, { transcript: result.transcript, language_code: result.language_code })
      }
      if (!Array.isArray(result.audios) || !result.audios.length || !result.audios.every((a) => typeof a === 'string' && a.length)) return send(502, { error: 'Sarvam returned no playable audio. Please retry.' })
      return send(200, { audios: result.audios })
    } catch (error) {
      return send(error?.name === 'TimeoutError' ? 504 : 502, { error: 'Voice service could not be reached. Your recording is still on this device; please retry.' })
    }
  }
}
