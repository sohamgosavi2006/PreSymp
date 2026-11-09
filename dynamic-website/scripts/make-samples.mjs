// Makes the five fictional sample reports in public/samples. Run: npm run samples
// Text PDFs are the in-app report pages printed by Chromium, so they match Lab A and Lab B and keep a real text layer.
// The photo and the scan are made from a screenshot of the same page.
import { chromium } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const out = fileURLToPath(new URL('../public/samples/', import.meta.url))
mkdirSync(out, { recursive: true })

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
const open = async (id, scale = 1) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: scale })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:5199/#/sample/${id}`)
  await page.waitForSelector('[data-testid=sample-sheet] .paper')
  return page
}

// 1 to 3: text pdfs
for (const [id, file] of [['kabita', 'kabita-banerjee-text.pdf'], ['das', 'r-das-text.pdf'], ['roy', 'm-roy-wrong-unit.pdf']]) {
  const page = await open(id)
  await page.emulateMedia({ media: 'print' })
  writeFileSync(out + file, await page.pdf({ format: 'A4', printBackground: true, scale: 0.92, margin: { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' } }))
  console.log('wrote', file)
  await page.context().close()
}

// 4: a phone photo. the page is tilted 3 degrees on a desk, slightly soft, with sensor noise and jpeg loss
const khan = await (await open('khan', 2)).locator('.paper').screenshot()
const photo = await browser.newPage()
const jpg = await photo.evaluate(async (b64) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const pad = 90
  const c = document.createElement('canvas')
  c.width = img.width + pad * 2
  c.height = img.height + pad * 2
  const g = c.getContext('2d')
  const bg = g.createLinearGradient(0, 0, c.width, c.height)
  bg.addColorStop(0, '#6d6a64'); bg.addColorStop(1, '#4b4945')
  g.fillStyle = bg
  g.fillRect(0, 0, c.width, c.height)
  g.save()
  g.translate(c.width / 2, c.height / 2)
  g.rotate((3 * Math.PI) / 180)
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 24; g.shadowOffsetY = 8
  g.filter = 'blur(0.6px)'
  g.drawImage(img, -img.width / 2, -img.height / 2)
  g.restore()
  const d = g.getImageData(0, 0, c.width, c.height)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5)
  for (let i = 0; i < d.data.length; i += 4) {
    const n = rnd() * 22
    const x = ((i / 4) % c.width) / c.width, y = Math.floor(i / 4 / c.width) / c.height
    const v = 1 - 0.18 * ((x - 0.5) ** 2 + (y - 0.5) ** 2) * 4 // soft vignette from the phone lens
    d.data[i] = d.data[i] * v + n; d.data[i + 1] = d.data[i + 1] * v + n; d.data[i + 2] = d.data[i + 2] * v + n
  }
  g.putImageData(d, 0, 0)
  return c.toDataURL('image/jpeg', 0.78).split(',')[1]
}, khan.toString('base64'))
writeFileSync(out + 'a-khan-phone-photo.jpg', Buffer.from(jpg, 'base64'))
console.log('wrote a-khan-phone-photo.jpg')

// 5: an image-only pdf: a scan with no text layer
const ghosh = await (await open('ghosh', 2)).locator('.paper').screenshot()
const pdf = await PDFDocument.create()
const png = await pdf.embedPng(ghosh)
const pg = pdf.addPage([595, 842])
const w = 515, h = (png.height / png.width) * w
pg.drawImage(png, { x: 40, y: 842 - 40 - h, width: w, height: h })
writeFileSync(out + 'n-ghosh-scanned.pdf', await pdf.save())
console.log('wrote n-ghosh-scanned.pdf')

await browser.close()
await server.close()
