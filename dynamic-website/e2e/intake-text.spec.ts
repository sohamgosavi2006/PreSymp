import { expect, test } from '@playwright/test'

// the three printed text samples go through the real pdf.js reader in the browser, then through the store

async function open(page: import('@playwright/test').Page, sample: string, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/day')
  await page.getByTestId('add-report').click()
  await page.getByTestId(`sample-${sample}`).click()
}

test('sample 1: ID matches, the report is saved and the patient gets a fifth dot', async ({ page }) => {
  const errors: string[] = []
  await open(page, 'kabita-banerjee-text.pdf', errors)
  await expect(page.getByTestId('open-patient')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('open-patient').click()
  await expect(page).toHaveURL(/#\/patient\/P-0533/)
  await expect(page.getByTestId('map-dot')).toHaveCount(5)
  expect(errors).toEqual([])
})

test('sample 1 again: nothing is added twice', async ({ page }) => {
  const errors: string[] = []
  await open(page, 'kabita-banerjee-text.pdf', errors)
  await expect(page.getByTestId('open-patient')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Add another' }).click()
  await page.getByTestId('sample-kabita-banerjee-text.pdf').click()
  await expect(page.getByText(/already/i).first()).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')
  await page.goto('/#/patient/P-0533')
  await expect(page.getByTestId('map-dot')).toHaveCount(5)
  expect(errors).toEqual([])
})

test('sample 2: no ID and only an initial, both possible patients are listed', async ({ page }) => {
  const errors: string[] = []
  await open(page, 'r-das-text.pdf', errors)
  await expect(page.getByTestId('open-queue')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('open-queue').click()
  await expect(page.getByText('Ramesh Das').first()).toBeVisible()
  await expect(page.getByText('Rina Das').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('sample 3: eGFR in mL/min is refused and waits in To check', async ({ page }) => {
  const errors: string[] = []
  await open(page, 'm-roy-wrong-unit.pdf', errors)
  await expect(page.getByTestId('open-queue')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('open-queue').click()
  await expect(page.getByTestId('queue-reason').filter({ hasText: '55 mL/min' })).toHaveCount(1)
  expect(errors).toEqual([])
})

test('a file that is not a kidney report goes to To check and is never guessed', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/day')
  await page.getByTestId('add-report').click()
  await page.getByTestId('intake-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByTestId('intake-reason')).toContainText('not supported', { timeout: 30_000 })
  expect(errors).toEqual([])
})
