import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('artifacts/walkthrough')
const rehearsal = process.argv.includes('--rehearse')
const manifest = JSON.parse(await readFile(resolve(root, 'narration.json'), 'utf8'))
const inputs = JSON.parse(await readFile(resolve(root, 'inputs.json'), 'utf8'))
await mkdir(resolve(root, rehearsal ? 'rehearsal' : 'raw'), { recursive: true })
await mkdir(resolve(root, 'downloads'), { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  recordVideo: rehearsal ? undefined : { dir: resolve(root, 'raw'), size: { width: 1600, height: 900 } },
  acceptDownloads: true,
})
const epoch = Date.now()
const page = await context.newPage()
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('download', (download) => download.saveAs(resolve(root, 'downloads', download.suggestedFilename())).catch(() => {}))
await page.route('**/__walkthrough-audio/*', async (route) => {
  const id = route.request().url().split('/').pop()
  const input = inputs[`input-${id}`]
  if (!input) return route.abort()
  await route.fulfill({ contentType: 'audio/wav', body: await readFile(input.path) })
})
// Only this recording browser uses a synthetic audio input. MediaRecorder and Sarvam are real.
await page.addInitScript(() => {
  window.__walkthroughInput = 'card'
  window.__walkthroughContexts = []
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext()
    await ctx.resume()
    const response = await fetch(`/__walkthrough-audio/${window.__walkthroughInput}`)
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const output = ctx.createMediaStreamDestination()
    source.connect(output)
    source.start(ctx.currentTime + 0.4)
    window.__walkthroughContexts.push(ctx)
    return output.stream
  }
})
let cursor = { x: 1500, y: 800 }
const pause = (ms = 800) => page.waitForTimeout(rehearsal ? Math.min(ms, 150) : ms)
async function move(locator) {
  await locator.scrollIntoViewIfNeeded()
  await pause(250)
  const box = await locator.boundingBox()
  if (box) {
    cursor = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(cursor.x, cursor.y, { steps: rehearsal ? 1 : 18 })
  }
}
async function click(locator) { await move(locator); await pause(350); await locator.click(); await pause(650) }
async function type(locator, text) { await move(locator); await locator.fill(''); await locator.pressSequentially(text, { delay: rehearsal ? 1 : 38 }); await pause(600) }
async function top() { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await pause(650) }
async function nav(name) { await click(page.getByRole('link', { name, exact: true })); await top() }
async function patient(id = 'P-0417') { await page.evaluate((id) => { location.hash = `#/patient/${id}` }, id); await page.locator('.pribbon').waitFor(); await top() }
async function sample(file, open = 'patient') {
  await nav('Today')
  await click(page.getByTestId('add-report'))
  await pause(800)
  await click(page.getByTestId(`sample-${file}`))
  const button = page.getByTestId(open === 'patient' ? 'open-patient' : 'open-queue')
  await button.waitFor({ timeout: 120000 })
  await pause(1300)
  await click(button)
  await top()
}
async function closeReport() { await click(page.getByRole('button', { name: 'Close source report', exact: true })) }
async function record(panel, input) {
  await page.evaluate((input) => { window.__walkthroughInput = input }, input)
  await panel.getByLabel('Spoken language', { exact: true }).selectOption('en-IN')
  await click(panel.getByRole('checkbox').first())
  await click(panel.getByRole('button', { name: 'Record voice', exact: true }))
  const stop = panel.getByRole('button', { name: /Stop recording/ })
  await stop.waitFor()
  await page.waitForTimeout((inputs[`input-${input}`].duration + 0.9) * 1000)
  await click(stop)
  await panel.getByLabel('Recorded voice preview').waitFor()
}
async function transcribe(panel) {
  await click(panel.getByRole('checkbox', { name: 'Send this clip to Sarvam for transcription.' }))
  await click(panel.getByRole('button', { name: 'Transcribe with Sarvam' }))
  await page.waitForFunction(() => [...document.querySelectorAll('textarea[aria-label="Review transcript"]')].some((e) => e.value.trim().length > 0), null, { timeout: 60000 })
  await pause(1000)
}
async function overlay(title, synthetic = false) {
  await page.evaluate(({ title, synthetic }) => {
    let badge = document.getElementById('walkthrough-chapter')
    if (!badge) {
      badge = document.createElement('div'); badge.id = 'walkthrough-chapter'
      badge.style.cssText = 'position:fixed;left:22px;bottom:43px;z-index:9999;max-width:650px;padding:10px 16px;border-radius:10px;background:#1f5560;color:white;font:600 17px Segoe UI,sans-serif;box-shadow:0 3px 16px #0002;pointer-events:none'
      document.body.appendChild(badge)
      const cursor = document.createElement('div'); cursor.id = 'walkthrough-cursor'
      cursor.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border:2px solid #1f5560;border-radius:50%;background:#e3eef080;z-index:10000;pointer-events:none;transform:translate(-50%,-50%)'
      document.body.appendChild(cursor)
      document.addEventListener('mousemove', (event) => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px` })
    }
    badge.textContent = title + (synthetic ? '  ·  Synthetic demo audio' : '')
  }, { title, synthetic })
}

const actions = {
  intro: async () => { await page.goto('http://localhost:4173/#/day'); await page.locator('.daylist').waitFor(); await page.evaluate(() => document.fonts.ready); await pause(1000) },
  today: async () => {
    const group = page.getByRole('group', { name: 'Show', exact: true })
    for (const name of [/^New report/, /^To call/, /^To check/, /^Nothing due/]) { await click(group.getByRole('button', { name })); await pause(700) }
    await click(group.getByRole('button', { name: /^All / }))
    await click(page.getByRole('button', { name: 'Longest waiting', exact: true })); await pause(1000)
    await click(page.getByRole('button', { name: 'Token order', exact: true }))
  },
  search: async () => {
    const search = page.getByRole('searchbox', { name: 'Search patients' })
    await page.keyboard.press('/')
    await type(search, '0210'); await pause(1000)
    await type(search, 'token 3'); await pause(1000)
    await type(search, 'Sunita'); await pause(900)
    await click(page.locator('.hits button').first())
  },
  map: async () => {
    await move(page.getByTestId('map-dot').first()); await pause(1800)
    await move(page.getByTestId('map-dot').last()); await pause(1800)
    await click(page.getByRole('button', { name: 'All 7', exact: true }))
    await click(page.getByRole('button', { name: 'Show creatinine', exact: true })); await pause(1500)
  },
  source: async () => {
    await click(page.getByTestId('val-uacr-2025-09-18'))
    await page.locator('.viewer [data-hl="1"]').waitFor(); await pause(1500)
    await click(page.getByRole('button', { name: 'Zoom 150 percent' })); await pause(1200)
    await click(page.getByRole('button', { name: 'Next page', exact: true })); await pause(1000)
    await click(page.getByRole('button', { name: 'Previous page', exact: true })); await pause(700)
    await closeReport()
  },
  reports: async () => {
    await move(page.locator('.vcharts')); await pause(1800)
    await move(page.locator('.pgrid.low')); await pause(1400)
    await click(page.getByRole('group', { name: 'Report type' }).getByRole('button', { name: /^Eye / })); await pause(900)
    await type(page.getByRole('searchbox', { name: 'Find in reports' }), 'eye')
    await click(page.getByTestId('found').getByRole('button').first()); await pause(1600)
    await closeReport()
  },
  pdf: async () => {
    await sample('kabita-banerjee-text.pdf')
    await click(page.getByTestId('val-uacr-2025-12-18'))
    await page.getByTestId('doc-hl').waitFor(); await pause(2000)
    await closeReport()
  },
  match: async () => {
    await nav('Today'); await click(page.getByTestId('add-report')); await click(page.getByTestId('sample-kabita-banerjee-text.pdf'))
    await page.getByRole('button', { name: 'Add another', exact: true }).waitFor()
    await pause(1600)
    await click(page.getByRole('button', { name: 'Add another', exact: true }))
    await click(page.getByTestId('sample-r-das-text.pdf'))
    await page.getByTestId('open-queue').waitFor(); await click(page.getByTestId('open-queue'))
    const item = page.locator('.qitem').filter({ hasText: 'We are not sure which patient this is' }).filter({ hasText: 'Ramesh Das' }).first()
    await move(item); await pause(1700)
    await click(item.getByTestId('save-to-P-0288')); await pause(1000)
  },
  photo: async () => {
    await sample('a-khan-phone-photo.jpg')
    await click(page.getByTestId('val-uacr-2025-12-18'))
    await page.getByTestId('doc-hl').waitFor(); await pause(1600)
    await closeReport()
  },
  scan: async () => {
    await sample('n-ghosh-scanned.pdf')
    await click(page.getByTestId('val-uacr-2025-12-18'))
    await page.getByTestId('doc-hl').waitFor(); await pause(1500)
    await closeReport()
  },
  unit: async () => {
    await sample('m-roy-wrong-unit.pdf', 'queue')
    const item = page.locator('.qitem').filter({ hasText: 'The unit on this report is wrong' }).last()
    await move(item); await pause(1500)
    await click(item.getByRole('button', { name: 'Show on report', exact: true })); await pause(1400); await closeReport()
    await click(item.getByRole('button', { name: 'Type the number', exact: true })); await pause(1800)
    await click(item.getByRole('button', { name: 'Type the number', exact: true }))
    await click(item.getByRole('button', { name: 'Ask lab for a new report', exact: true })); await pause(800)
  },
  mark: async () => {
    await nav('Today'); await click(page.getByRole('button', { name: 'Mark done for S. Devi', exact: true }))
    const modal = page.getByRole('dialog', { name: 'Mark done · S. Devi', exact: true })
    await click(modal.getByRole('radio', { name: /Eye test/ }))
    await modal.getByLabel('Date done').fill('2025-12-18'); await pause(900)
    await click(modal.getByRole('button', { name: 'Confirm', exact: true })); await pause(800)
  },
  card: async () => {
    await patient(); await click(page.getByTestId('open-card'))
    await click(page.getByRole('button', { name: 'EN', exact: true }))
    await click(page.getByRole('button', { name: 'हिं', exact: true })); await pause(900)
    await click(page.getByRole('button', { name: 'বাং', exact: true })); await pause(900)
    await click(page.getByRole('button', { name: 'EN', exact: true }))
    await click(page.getByRole('button', { name: 'Doctor', exact: true }))
    await click(page.getByLabel('Show last results'))
    await page.getByLabel('Next appointment').fill('2026-01-15')
    await type(page.getByLabel("Doctor's note (printed as typed)"), 'Please bring your previous reports to your next clinic visit.')
    await click(page.getByTestId('approve'))
    const download = page.waitForEvent('download'); await click(page.getByTestId('save-image')); await download
    await click(page.getByTestId('print'))
    await page.pdf({ path: resolve(root, 'downloads', 'follow-up-card-print.pdf'), preferCSSPageSize: true, printBackground: false })
    await page.screenshot({ path: resolve(root, 'card-preview.png'), fullPage: true })
  },
  listen: async () => {
    await click(page.getByRole('checkbox', { name: 'Allow this text to be sent to Sarvam for speech.' }))
    await click(page.getByRole('button', { name: 'Listen with Sarvam', exact: true }))
    const audio = page.getByLabel('Sarvam spoken note')
    await audio.waitFor({ timeout: 60000 }); await move(audio)
    await audio.evaluate(async (el) => { await el.play() }); await pause(2200)
    await audio.evaluate((el) => el.pause())
    const download = page.waitForEvent('download'); await click(page.getByRole('button', { name: 'Download spoken note', exact: true })); await download
  },
  cardvoice: async () => {
    const panel = page.getByRole('region', { name: 'Card voice note', exact: true })
    await move(panel); await record(panel, 'card'); await transcribe(panel)
    await click(panel.getByRole('button', { name: 'Use as card note', exact: true }))
    await click(panel.getByRole('button', { name: 'Keep voice message', exact: true }))
    await panel.getByLabel('Saved voice message').waitFor(); await pause(1300)
  },
  patientvoice: async () => {
    await patient()
    await click(page.getByRole('link', { name: 'Voice messages', exact: true }))
    const panel = page.getByRole('region', { name: 'Patient voice messages', exact: true })
    await record(panel, 'patient'); await transcribe(panel)
    await click(panel.getByRole('button', { name: 'Keep voice message', exact: true }))
    const audio = panel.getByLabel('Saved voice message'); await audio.waitFor(); await move(audio)
    await audio.evaluate(async (el) => { await el.play() }); await pause(1800); await audio.evaluate((el) => el.pause())
    const download = page.waitForEvent('download'); await click(panel.getByRole('button', { name: 'Download', exact: true })); await download
    await click(panel.getByRole('button', { name: 'Delete…', exact: true })); await pause(1000)
    await click(panel.getByRole('button', { name: 'Cancel', exact: true }))
  },
  voicesearch: async () => {
    await top(); await click(page.getByRole('button', { name: 'Voice search', exact: true }))
    const panel = page.getByRole('dialog', { name: 'Voice search', exact: true })
    await record(panel, 'search'); await transcribe(panel)
    await type(panel.getByLabel('Review transcript'), 'Sunita Devi')
    await click(panel.getByRole('button', { name: 'Search these words', exact: true })); await pause(1200)
    await click(page.locator('.hits button').first())
  },
  reminder: async () => {
    await nav('Call list')
    const language = page.getByRole('group', { name: 'Message language' })
    await click(language.getByRole('button', { name: 'EN', exact: true }))
    await click(page.getByRole('button', { name: 'Edit', exact: true }).last())
    await type(page.getByLabel('Edit message'), 'Please contact the clinic to arrange your next test. Bring your previous reports.')
    await click(page.getByRole('button', { name: 'Save', exact: true }))
    await click(language.getByRole('button', { name: 'EN', exact: true }))
    await click(page.getByRole('button', { name: 'Skip', exact: true }).last()); await pause(700)
    await click(page.getByRole('button', { name: 'Cancel', exact: true }).last())
    await click(page.getByRole('button', { name: 'Send message', exact: true })); await pause(1200)
  },
  export: async () => {
    await patient()
    await click(page.getByRole('button', { name: 'Download results', exact: true }))
    let download = page.waitForEvent('download'); await click(page.getByRole('menuitem', { name: 'Excel file (CSV)', exact: true })); await download
    await click(page.getByRole('button', { name: 'Download results', exact: true }))
    download = page.waitForEvent('download'); await click(page.getByRole('menuitem', { name: 'For other software (FHIR)', exact: true })); await download
    await click(page.getByRole('button', { name: 'Add to call list', exact: true }))
    await click(page.getByRole('button', { name: 'Change schedule', exact: true }))
    const dialog = page.getByRole('dialog', { name: 'Change schedule' })
    await dialog.getByLabel(/Change for S\. Devi: kidney test every/).fill('4')
    await type(dialog.getByPlaceholder('Why are you changing this?'), 'Example patient-specific follow-up schedule')
    await pause(1000); await click(dialog.getByRole('button', { name: 'Change for this patient only', exact: true }))
  },
  settings: async () => {
    await nav('Settings'); await pause(1000)
    await page.getByLabel('Eye test every').fill('6')
    await type(page.getByPlaceholder('Why are you changing this?'), 'Example clinic review: eye check interval set to six months')
    await click(page.getByRole('button', { name: /Save as version/ })); await pause(600)
    await click(page.getByRole('button', { name: 'Go back to this version', exact: true }).first())
    await move(page.getByRole('heading', { name: 'Units and lab reference ranges', exact: true })); await pause(1200)
    await click(page.getByRole('button', { name: 'Go back to a backup…', exact: true })); await pause(1200)
    await click(page.getByRole('dialog', { name: 'Go back to a backup' }).getByRole('button', { name: 'Cancel', exact: true }))
    await move(page.getByRole('heading', { name: 'Message words', exact: true })); await pause(1000)
    await nav('History'); await pause(1600)
  },
  finish: async () => {
    await click(page.getByRole('link', { name: 'What this app does not do', exact: true })); await top(); await pause(2500)
    await nav('Today'); await pause(1700)
  },
}

const timeline = []
try {
  if (process.argv.includes('--voices-only')) {
    await actions.intro(); await patient(); await click(page.getByTestId('open-card'))
    await click(page.getByRole('button', { name: 'EN', exact: true }))
    await click(page.getByRole('button', { name: 'Doctor', exact: true }))
  }
  const selected = process.argv.includes('--voices-only') ? manifest.slice(manifest.findIndex((s) => s.id === 'cardvoice')) : manifest
  for (const scene of selected) {
    const start = (Date.now() - epoch) / 1000
    if (scene.id !== 'intro') await overlay(scene.title, ['cardvoice', 'patientvoice', 'voicesearch'].includes(scene.id))
    console.log(`Recording chapter: ${scene.id}`)
    await actions[scene.id]()
    if (scene.id === 'intro') await overlay(scene.title)
    const elapsed = (Date.now() - epoch) / 1000 - start
    const minimum = rehearsal ? 0 : scene.duration + 1.8
    if (elapsed < minimum) await page.waitForTimeout((minimum - elapsed) * 1000)
    const end = (Date.now() - epoch) / 1000
    timeline.push({ ...scene, start, end })
    await writeFile(resolve(root, rehearsal ? 'rehearsal-timeline.json' : 'timeline.json'), JSON.stringify(timeline, null, 2))
    await page.screenshot({ path: resolve(root, rehearsal ? 'rehearsal' : 'raw', `${scene.id}.png`) })
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
  await pause(500)
  const video = page.video()
  await context.close()
  if (video) await writeFile(resolve(root, 'video-source.json'), JSON.stringify({ path: await video.path(), epoch, elapsed: (Date.now() - epoch) / 1000 }, null, 2))
  console.log(rehearsal ? 'Full walkthrough rehearsal passed.' : 'Full walkthrough recorded.')
} catch (error) {
  const recordings = page.getByRole('button', { name: 'Download recording', exact: true })
  if (await recordings.count()) {
    const saved = page.waitForEvent('download')
    await recordings.last().click().catch(() => {})
    const clip = await saved.catch(() => null)
    if (clip) await clip.saveAs(resolve(root, 'debug-recording.webm'))
  }
  await page.screenshot({ path: resolve(root, 'recording-error.png'), fullPage: true }).catch(() => {})
  console.error(error)
  await context.close()
  process.exitCode = 1
} finally { await browser.close() }
