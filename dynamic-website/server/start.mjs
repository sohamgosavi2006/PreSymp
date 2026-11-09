import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVoiceHandler } from './voice.mjs'

try { process.loadEnvFile('.env') } catch { /* Environment variables also work. */ }
const root = fileURLToPath(new URL('../dist/', import.meta.url))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gz': 'application/gzip' }
const voice = createVoiceHandler({ apiKey: () => process.env.SARVAM_API_KEY })
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/voice/')) return voice(req, res)
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end() }
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
    if (path !== resolve(root) && !path.startsWith(resolve(root) + sep)) { res.writeHead(403); return res.end() }
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path
    const info = await stat(file)
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' })
    if (req.method === 'HEAD') return res.end()
    createReadStream(file).pipe(res)
  } catch { res.writeHead(404); res.end('Not found. Run npm run build first.') }
})
// This MVP contains sample data and a local API, without clinic authentication.
// Render must accept traffic on all interfaces. HOST can override the bind address.
const host = process.env.HOST || '0.0.0.0'
server.listen(Number(process.env.PORT || 4173), host, () => console.log(`PreSymp with voice: http://${host}:${server.address().port}`))
