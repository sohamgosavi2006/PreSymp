// Screenshots of every screen and dialog at 1366x768 and 1920x1080 into shots/.
// Needs `npm run build` and a preview on 4173:  npm run preview
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

mkdirSync('shots', { recursive: true })
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch()
const bad = []

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on('console', (m) => ['error', 'warning'].includes(m.type()) && bad.push(`${w}: ${m.text()}`))
  p.on('pageerror', (e) => bad.push(`${w}: ${e.message}`))
  const shot = (n, full = false) => p.screenshot({ path: `shots/${w}-${n}.png`, fullPage: full })
  const go = async (hash) => { await p.goto(`${base}/${hash}`); await p.waitForTimeout(500) }
  const sample = async (file, ready) => {
    await go('#/day')
    await p.getByTestId('add-report').click()
    await shot('intake-0-dialog')
    await p.getByTestId(`sample-${file}`).click()
    await p.waitForTimeout(700)
    await shot('intake-1-reading')
    await p.getByTestId(ready).waitFor({ timeout: 120_000 })
    await shot(`intake-2-${file.split('.')[0]}`)
  }

  await go('#/day'); await shot('01-today')
  await p.getByRole('button', { name: /To call/ }).click(); await shot('01b-today-to-call')
  for (const id of ['P-0417', 'P-0533', 'P-0932']) {
    await go(`#/patient/${id}`); await shot(`02-patient-${id}`)
    const m = await p.evaluate(() => [document.documentElement.scrollHeight, Math.round(document.querySelector('.pgrid').getBoundingClientRect().bottom), window.innerHeight - 30])
    console.log(w, id, 'page height / map+results bottom / visible bottom', m)
  }
  await go('#/patient/P-0417'); await shot('02b-patient-full', true)
  await p.getByTestId('val-uacr-2025-09-18').click(); await p.waitForTimeout(700); await shot('03-viewer-seeded')
  await p.keyboard.press('Escape')
  await p.getByLabel('Find in reports').fill('eye'); await shot('04-find-eye')
  await go('#/due'); await shot('05-call-list')
  await go('#/audit'); await shot('07-history')
  await go('#/settings'); await shot('08-settings', true)
  await go('#/scope'); await shot('09-scope')
  for (const l of ['EN', 'हिं', 'বাং']) { await go('#/card/P-0417'); await p.getByRole('button', { name: l, exact: true }).click(); await shot(`10-card-${l === 'EN' ? 'en' : l === 'हिं' ? 'hi' : 'bn'}`) }

  await sample('kabita-banerjee-text.pdf', 'open-patient')
  await p.getByTestId('open-patient').click(); await p.waitForTimeout(800)
  await p.getByTestId('val-uacr-2025-12-18').click(); await p.getByTestId('doc-hl').waitFor(); await p.waitForTimeout(1200); await shot('11-viewer-real-pdf')
  await sample('a-khan-phone-photo.jpg', 'open-patient')
  await p.getByTestId('open-patient').click(); await p.waitForTimeout(800)
  await p.getByTestId('val-uacr-2025-12-18').click(); await p.getByTestId('doc-hl').waitFor(); await p.waitForTimeout(1200); await shot('12-viewer-real-photo')
  await sample('r-das-text.pdf', 'open-queue')
  await p.getByTestId('open-queue').click(); await p.waitForTimeout(800); await shot('13-queue-two-patients', true)
  await sample('m-roy-wrong-unit.pdf', 'open-queue')
  await p.getByTestId('open-queue').click(); await p.waitForTimeout(800); await shot('14-queue-wrong-unit', true)
  await p.close()
}
console.log('console errors and warnings:', bad)
await b.close()
