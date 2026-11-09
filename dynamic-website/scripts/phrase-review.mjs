// Writes PHRASE-REVIEW.md: every Hindi and Bengali phrase the app prints, with a machine translation back
// to English from Sarvam, so a native speaker can check them quickly. Developer tool only.
// The back-translation is a hint for the reviewer, not a sign-off. Run: npm run phrases:review
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

try { process.loadEnvFile('.env') } catch { console.error('No .env file. Copy .env.example to .env and add SARVAM_API_KEY.'); process.exit(1) }
const key = process.env.SARVAM_API_KEY
if (!key) { console.error('SARVAM_API_KEY is missing in .env'); process.exit(1) }

const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const ph = await vite.ssrLoadModule('/src/logic/phrases.ts')
await vite.close()

// every phrase in the bank: [group, key, {en, hi, bn}]
const rows = [
  ...Object.entries(ph.CHECK).map(([k, v]) => ['Check name', k, v]),
  ['Reminder', 'template', ph.REMINDER],
  ...Object.entries(ph.CARD).map(([k, v]) => ['Card label', k, v]),
]
if (ph.MONTHS) rows.push(['Months', 'all 12', Object.fromEntries(['en', 'hi', 'bn'].map((l) => [l, ph.MONTHS[l].join(', ')]))])

async function back(text, lang) {
  const res = await fetch('https://api.sarvam.ai/translate', {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ input: text, source_language_code: `${lang}-IN`, target_language_code: 'en-IN', model: 'mayura:v1' }),
  })
  if (!res.ok) return `(no back-translation: HTTP ${res.status})`
  return (await res.json()).translated_text ?? ''
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const lines = [
  '# Hindi and Bengali phrases: native-speaker review',
  '',
  'Every Hindi and Bengali phrase the app prints comes from the fixed phrase bank in `src/logic/phrases.ts`.',
  'The "Back to English" column is a machine translation by Sarvam (mayura:v1), made once on a developer computer.',
  'It only helps the reviewer spot a wrong meaning; it is not a check. Mark each row OK or write the correction.',
  '',
  '| Where | Key | Lang | Phrase in the app | Back to English (machine) | English the app uses | Reviewer: OK / fix |',
  '|---|---|---|---|---|---|---|',
]
let n = 0
for (const [group, k, v] of rows) {
  for (const lang of ['hi', 'bn']) {
    const b = await back(v[lang], lang)
    n++
    lines.push(`| ${group} | ${k} | ${lang.toUpperCase()} | ${esc(v[lang])} | ${esc(b)} | ${esc(v.en)} | |`)
    await new Promise((r) => setTimeout(r, 150)) // be gentle with the API
  }
}
lines.push('', `Reviewer name: ____________   Date: ____________`, '')
writeFileSync('PHRASE-REVIEW.md', lines.join('\n'))
console.log(`wrote PHRASE-REVIEW.md (${n} phrases)`)
