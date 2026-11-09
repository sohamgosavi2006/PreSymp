// Copies the OCR engine into public/tesseract so it is served from this site, never from a CDN.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const dest = join(root, 'public', 'tesseract')
mkdirSync(dest, { recursive: true })

const core = dirname(require.resolve('tesseract.js-core/package.json'))
const eng = dirname(require.resolve('@tesseract.js-data/eng/package.json'))
const files = [
  [join(require.resolve('tesseract.js/package.json'), '..', 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(core, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(core, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [join(eng, '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
]
let n = 0
for (const [from, name] of files) {
  if (!existsSync(from)) { console.error('missing', from); process.exit(1) }
  if (!existsSync(join(dest, name))) { copyFileSync(from, join(dest, name)); n++ }
}
console.log(`ocr assets ready in public/tesseract (${n} copied)`)
