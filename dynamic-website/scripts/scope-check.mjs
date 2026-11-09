// Fails the build if src carries a banned word or any colour that is not a design token.
// Words: SPEC.md 3.1. Colours: SPEC.md section 2 tokens only (plus white and two derived greys).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const allow = existsSync(join(root, 'scope-allow.json')) ? JSON.parse(readFileSync(join(root, 'scope-allow.json'), 'utf8')) : {}

// SPEC.md section 2, plus #FFFFFF (card), two greys derived from the tokens, and the marker-pen yellow.
// The marker (--marker) may be used only inside src/components/SourceViewer, as the highlight on a source document.
const COLOURS = new Set(['#FAFAF7', '#1A1A1A', '#3D3D3D', '#7A7A7A', '#D9D9D4', '#F0F0EB', '#1F5560', '#E3EEF0', '#FFFFFF', '#6B6B6B', '#BDBDB6', '#FFE45C'])
const NAMED = /\b(red|orange|amber|yellow|green|lime|crimson|tomato|gold|olive|teal|maroon|coral)\b/i

const WORDS = [
  /\brisk\w*/i, /\balert\w*/i, /\bwarning\w*/i, /\bcritical\b/i, /\bpredict\w*/i, /\bprognos\w*/i,
  /\bprobabilit\w*/i, /\btrend\w*/i, /\bworsen\w*/i, /\bimprov\w*/i, /\bdeclin\w*/i, /\bprogress\b/i,
  /\bdeteriorat\w*/i, /\babnormal\b/i, /\bnormal\b/i, /\bhealthy\b/i, /\bdiagnos\w*/i, /\brecommend\w*/i,
  /\bsuggest\w*/i, /\badvis\w*/i, /\bshould\b/i, /\bsmart\b/i, /\binsight\w*/i, /\bAI\b/, /\bscor(?:e|es|ed|ing)\b/i,
]

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css)$/.test(f)) out.push(p)
  }
  return out
}

const hexOf = (r, g, b) => '#' + [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()
const bad = []
const files = [...walk(join(root, 'src')), join(root, 'index.html')]

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/')
  const okWords = (allow[rel] ?? []).map((w) => w.toLowerCase())
  const isTest = /\.test\.ts$/.test(rel)
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      let h = m[0].toUpperCase()
      if (h.length === 4) h = '#' + [...h.slice(1)].map((c) => c + c).join('')
      if (h.length === 9) h = h.slice(0, 7)
      if (/^#[0-9A-F]{6}$/.test(h) && !COLOURS.has(h)) bad.push(`${at}  colour ${m[0]} is not a design token`)
    }
    for (const m of line.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/gi)) {
      const h = hexOf(m[1], m[2], m[3])
      if (!COLOURS.has(h)) bad.push(`${at}  colour ${m[0]}) is not a design token`)
    }
    if (!isTest && NAMED.test(line.replace(/'[^']*'|"[^"]*"/g, (s) => (/^['"][a-z-]+['"]$/.test(s) ? '' : s))))
      if (/(color|fill|stroke|background|border)\s*[:=]\s*['"]?\s*(red|orange|amber|yellow|green|lime|crimson|tomato|gold|olive|maroon|coral)\b/i.test(line)) bad.push(`${at}  named colour`)
    for (const m of line.matchAll(/hsla?\(\s*[\d.]+/gi)) bad.push(`${at}  hsl colour ${m[0]}) is not allowed, use a design token`)
    if (/var\(--marker\)/.test(line) && !rel.startsWith('src/components/SourceViewer/')) bad.push(`${at}  --marker may only be used inside src/components/SourceViewer`)
    if (isTest) return
    for (const re of WORDS) {
      const m = line.match(re)
      if (m && !okWords.some((w) => m[0].toLowerCase().includes(w))) bad.push(`${at}  banned word "${m[0]}"`)
    }
  })
}

if (bad.length) {
  console.error(`scope check failed (${bad.length}):\n` + bad.join('\n'))
  process.exit(1)
}
console.log(`scope check ok · ${files.length} files`)
