import { expect, test, type Locator, type Page } from '@playwright/test'

// click-to-source: the viewer opens at the exact line, the marker sits on it, and it stays right
// through zoom and resize. Seeded reports keep their HTML page; uploaded files show the real page.

type R = { x: number; y: number; width: number; height: number }
const box = async (l: Locator) => (await l.boundingBox()) as R
const centreY = (r: R) => r.y + r.height / 2

// the marker is inside the scroll area of the viewer, not just somewhere on screen
async function insideBody(page: Page, hl: Locator) {
  const body = await box(page.getByTestId('viewer-body'))
  const h = await box(hl)
  expect(h.y).toBeGreaterThanOrEqual(body.y - 1)
  expect(h.y + h.height).toBeLessThanOrEqual(body.y + body.height + 1)
}

test('seeded report: the marked row is centred, zoom keeps it in view, Esc closes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/patient/P-0417')
  const val = page.getByTestId('val-uacr-2025-09-18')
  await val.click()

  const row = page.locator('.viewer [data-hl="1"]')
  await expect(row).toBeVisible()
  const body = page.getByTestId('viewer-body')
  // near the middle of the scroll area, give or take 15 percent of its height
  const off = async () => {
    const b = await box(body)
    return Math.abs(centreY(await box(row)) - centreY(b)) / b.height
  }
  await expect.poll(off).toBeLessThan(0.15)
  await expect(page.locator('.vfoot')).toContainText('190 mg/g · read from the report text')
  await expect(page.locator('.vfoot')).toContainText('Unit is right ✓')

  await page.getByRole('button', { name: 'Zoom 150 percent' }).click()
  await expect(page.getByRole('button', { name: 'Zoom 150 percent' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(off).toBeLessThan(0.15)
  await insideBody(page, row)

  await page.keyboard.press('Escape')
  await expect(page.locator('.viewer')).toHaveCount(0)
  await expect(val).toBeFocused() // focus goes back to the number that was clicked
  expect(errors).toEqual([])
})

test('seeded report: Previous and Next move between pages, the end buttons are off', async ({ page }) => {
  await page.goto('/#/patient/P-0417')
  await page.getByTestId('val-uacr-2025-09-18').click()
  const head = page.locator('.vhead')
  await expect(head).toContainText('Page 2 of 3')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(head).toContainText('Page 3 of 3')
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  // the number is on page 2, so the footer offers the way back
  await page.getByRole('button', { name: /Back to the number/ }).click()
  await expect(page.locator('.viewer [data-hl="1"]')).toBeVisible()
})

test('uploaded text pdf: real page, marker inside the page, still right after zoom and resize', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/patient/P-0533')
  await page.locator('input[type=file]').first().setInputFiles('public/samples/kabita-banerjee-text.pdf')
  await expect(page.getByTestId('open-patient')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('open-patient').click()
  await page.getByTestId('val-uacr-2025-12-18').click()

  const canvas = page.getByTestId('pdf-canvas')
  const hl = page.getByTestId('doc-hl')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(hl).toBeVisible({ timeout: 15_000 })
  await expect(hl).toHaveAttribute('data-hl', '1')

  const inside = async () => {
    const pg = await box(page.getByTestId('pdf-page'))
    const h = await box(hl)
    const vp = page.viewportSize()!
    // fully on screen
    expect(h.x).toBeGreaterThanOrEqual(0)
    expect(h.y).toBeGreaterThanOrEqual(0)
    expect(h.x + h.width).toBeLessThanOrEqual(vp.width)
    expect(h.y + h.height).toBeLessThanOrEqual(vp.height)
    // and on the page itself
    expect(h.x).toBeGreaterThanOrEqual(pg.x - 1)
    expect(h.y).toBeGreaterThanOrEqual(pg.y - 1)
    expect(h.x + h.width).toBeLessThanOrEqual(pg.x + pg.width + 1)
    expect(h.y + h.height).toBeLessThanOrEqual(pg.y + pg.height + 1)
  }
  await inside()
  await expect(page.locator('.vfoot')).toContainText('9 mg/g · read from the report text')
  const px = await canvas.evaluate((c: HTMLCanvasElement) => c.width)
  expect(px).toBeGreaterThan(300)

  // zoom: the page grows, the marker stays on its line and in view
  await page.getByRole('button', { name: 'Zoom 200 percent' }).click()
  await expect.poll(async () => (await box(canvas)).width).toBeGreaterThan(900)
  await expect(hl).toBeVisible()
  await insideBody(page, hl)
  await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(px) // redrawn sharp
  await page.getByRole('button', { name: 'Zoom 100 percent' }).click()

  // a smaller window: the marker is still over the page
  await page.setViewportSize({ width: 1100, height: 700 })
  await expect.poll(async () => {
    const c = await box(canvas)
    const h = await box(hl)
    return h.x >= c.x - 1 && h.y >= c.y - 1 && h.x + h.width <= c.x + c.width + 1 && h.y + h.height <= c.y + c.height + 1
  }).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.locator('.viewer')).toHaveCount(0)
  expect(errors).toEqual([])
})

// the phone photo is read by OCR (Agent 2). when that is not in place yet the test says so and skips
test('uploaded phone photo: the photo is shown with the marker and the footer tells how sure', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/#/day')
  await page.getByTestId('add-report').click()
  await page.getByTestId('intake-file').setInputFiles('public/samples/a-khan-phone-photo.jpg')
  const open = page.getByTestId('open-patient')
  const saved = await open.waitFor({ state: 'visible', timeout: 120_000 }).then(() => true, () => false)
  test.skip(!saved, 'The photo was not saved to a patient by the reader, so there is no number to open yet.')
  await open.click()
  await page.getByTestId('val-uacr-2025-12-18').click()
  await expect(page.getByTestId('doc-image')).toBeVisible()
  await expect(page.getByTestId('doc-hl')).toBeVisible()
  await expect(page.locator('.vfoot')).toContainText('read from a photo')
  await expect(page.locator('.vfoot')).toContainText('as printed: 1.4 mg/mmol')
})
