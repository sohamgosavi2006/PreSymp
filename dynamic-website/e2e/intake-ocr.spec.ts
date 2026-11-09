import { expect, test, type Page } from '@playwright/test'

// the photo and the scan are read for real in the browser: stages show while it works, the file
// ends up matched to its patient, and nothing leaves this server (the engine and its data are local)
test.setTimeout(150_000)

function watch(page: Page, origin: string) {
  const outside: string[] = []
  const errors: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url())) outside.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return { outside, errors }
}

for (const sample of ['a-khan-phone-photo.jpg', 'n-ghosh-scanned.pdf']) {
  test(`${sample} is read by OCR and matched to its patient`, async ({ page, baseURL }) => {
    const seen = watch(page, new URL(baseURL ?? 'http://localhost:4173').origin)
    await page.goto('/#/day')
    await page.getByTestId('add-report').click()
    await page.getByTestId(`sample-${sample}`).click()

    // stages and the meter are on screen while it reads
    const status = page.getByRole('status')
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(status).toContainText(/Opening|Turning|Reading|Checking/)

    await expect(page.getByTestId('open-patient')).toBeVisible({ timeout: 90_000 })
    expect(seen.outside).toEqual([])
    expect(seen.errors).toEqual([])
  })
}
