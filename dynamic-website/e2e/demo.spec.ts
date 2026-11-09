import { expect, test, type Page } from '@playwright/test'

// the guided demo, start to end. it uses the bundled samples, so one click runs it.
// the same run happens a second time with every request that leaves localhost blocked
async function runDemo(page: Page) {
  const bad: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bad.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`))
  await page.goto('/#/day')
  await page.getByText('Show me how').click()
  const next = () => page.getByRole('button', { name: 'Next', exact: true }).last()
  // the dialog opens, reads the file, then closes by itself
  const modalGone = async (ms: number) => {
    await expect(page.locator('.modal')).toHaveCount(1, { timeout: 15_000 })
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: ms })
  }

  for (let i = 1; i <= 4; i++) { await page.waitForTimeout(900); await next().click() } // 1..4 -> step 5
  await expect(page.getByText('STEP 5 OF 12')).toBeVisible()
  await modalGone(60_000) // sample 1 read, saved, dialog closes by itself
  await next().click()
  await expect(page.getByText('STEP 6 OF 12')).toBeVisible()
  await expect(page.getByTestId('doc-hl')).toBeVisible({ timeout: 20_000 })
  await next().click()
  await expect(page.getByText('STEP 7 OF 12')).toBeVisible()
  await modalGone(180_000) // the phone photo goes through OCR
  await next().click()
  await expect(page.getByText('STEP 8 OF 12')).toBeVisible()
  await modalGone(60_000)
  await expect(page.getByTestId('queue-reason').filter({ hasText: '55 mL/min' })).toHaveCount(1)
  await next().click()
  await expect(page.getByText('STEP 9 OF 12')).toBeVisible()
  await expect(page.getByTestId('found')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('found').locator('li').first()).toContainText('Eye report')
  await next().click()
  await expect(page.locator('.fcard')).toContainText('ফলো-আপ কার্ড', { timeout: 10_000 })
  await next().click()
  await expect(page.getByText('STEP 11 OF 12')).toBeVisible()
  await expect(page.getByText(/Sent · via clinic WhatsApp/).first()).toBeVisible({ timeout: 20_000 })
  await next().click()
  await expect(page).toHaveURL(/#\/audit/, { timeout: 15_000 })
  await expect(page.locator('tbody tr').first()).toContainText('Schedule saved', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Finish' }).click()
  expect(bad).toEqual([])
}

test('the guided demo runs end to end with no console errors', async ({ page }) => {
  test.setTimeout(420_000)
  await runDemo(page)
})

test('the guided demo also runs with the network blocked, OCR included', async ({ page, baseURL }) => {
  test.setTimeout(420_000)
  const outside: string[] = []
  await page.route('**/*', (route) => {
    const u = route.request().url()
    if (u.startsWith(baseURL!) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue()
    outside.push(u)
    return route.abort()
  })
  await runDemo(page)
  expect(outside).toEqual([])
})
