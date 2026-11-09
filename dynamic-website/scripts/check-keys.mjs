// One tiny call to each service to check the keys in .env work. Prints no key. Run: npm run check:keys
// This is a developer check; the app's opt-in voice gateway uses its own requests.
import Anthropic from '@anthropic-ai/sdk'

try { process.loadEnvFile('.env') } catch { console.error('No .env file. Copy .env.example to .env and fill it in.'); process.exit(1) }
const mask = (k) => (k ? `set (${k.length} chars)` : 'missing')
console.log('ANTHROPIC_API_KEY', mask(process.env.ANTHROPIC_API_KEY))
console.log('SARVAM_API_KEY   ', mask(process.env.SARVAM_API_KEY))
let ok = true

// Claude: the cheap model from .env, one short reply
if (process.env.ANTHROPIC_API_KEY) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'
  try {
    const client = new Anthropic()
    const r = await client.messages.create({
      model, max_tokens: 1024, output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with exactly one word: ok' }],
    })
    const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    console.log(`Claude  ok · ${r.model} · stop ${r.stop_reason} · reply "${text}" · ${r.usage.input_tokens}+${r.usage.output_tokens} tokens`)
  } catch (e) {
    ok = false
    if (e instanceof Anthropic.AuthenticationError) console.log('Claude  failed · the key was not accepted (401)')
    else if (e instanceof Anthropic.NotFoundError) console.log(`Claude  failed · model "${model}" not found for this key (404)`)
    else if (e instanceof Anthropic.RateLimitError) console.log('Claude  failed · rate limited or out of credit (429)')
    else if (e instanceof Anthropic.APIError) console.log(`Claude  failed · API error ${e.status}: ${e.message}`)
    else console.log(`Claude  failed · ${e.message}`)
  }
} else ok = false

// Sarvam: translate one short line to Bengali
if (process.env.SARVAM_API_KEY) {
  try {
    const res = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'Your eye check is due.', source_language_code: 'en-IN', target_language_code: 'bn-IN', model: 'mayura:v1' }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) console.log(`Sarvam  ok · "${body.translated_text}"`)
    else { ok = false; console.log(`Sarvam  failed · HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (key not accepted)' : ''}: ${JSON.stringify(body).slice(0, 200)}`) }
  } catch (e) { ok = false; console.log(`Sarvam  failed · ${e.message}`) }
} else ok = false

process.exit(ok ? 0 : 1)
