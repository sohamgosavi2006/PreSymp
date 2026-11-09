import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const MM = 96 / 25.4 // css px per mm

test('card in Bengali: results, approval, print layout, PNG and history', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++ } })
  await page.goto('/#/card/P-0417')

  // the card opens in the patient's language, and the switch rewrites it from the phrase bank
  await expect(page.getByRole('heading', { name: 'ফলো-আপ কার্ড' })).toBeVisible()
  await page.getByRole('button', { name: 'हिं', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'फॉलो-अप कार्ड' })).toBeVisible()
  await page.getByRole('button', { name: 'বাং', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ফলো-আপ কার্ড' })).toBeVisible()

  // results are doctor only and start off
  const results = page.getByLabel('Show last results')
  await expect(results).toBeDisabled()
  await page.getByRole('button', { name: 'Doctor', exact: true }).click()
  await expect(results).not.toBeChecked()
  await expect(page.locator('.fcard')).not.toContainText('190 mg/g')
  await results.check()
  await expect(page.locator('.fcard')).toContainText('190 mg/g')
  await expect(page.locator('.fcard')).toContainText('mL/min/1.73 m²')

  // appointment and a doctor's note, shown as typed (Hindi text on a Bengali card is not translated)
  await page.getByLabel('Next appointment').fill('2026-01-15')
  await expect(page.locator('.fcard')).toContainText('15 জানুয়ারি 2026')
  const note = 'कल सुबह खाली पेट आइए।\nBring old reports. '.repeat(3)
  await page.getByLabel("Doctor's note (printed as typed)").fill(note)
  await expect(page.locator('.fcard .note')).toHaveText(note.trim())

  // nothing prints or saves before Approve, and any change takes the approval away
  await expect(page.getByTestId('print')).toBeDisabled()
  await expect(page.getByTestId('save-image')).toBeDisabled()
  await page.getByTestId('approve').click()
  await expect(page.getByTestId('print')).toBeEnabled()
  await expect(page.getByTestId('save-image')).toBeEnabled()
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByTestId('print')).toBeDisabled()
  await page.getByTestId('approve').click()
  await page.getByLabel("Doctor's note (printed as typed)").fill(note + ' more')
  await expect(page.getByTestId('print')).toBeDisabled()
  await page.getByLabel("Doctor's note (printed as typed)").fill(note)
  await page.getByRole('button', { name: 'বাং', exact: true }).click()
  await expect(page.getByTestId('print')).toBeDisabled()
  await page.getByTestId('approve').click()
  await expect(page.getByTestId('print')).toBeEnabled()

  // print: only the card is shown, and it fits the area inside a 10 mm margin on an A5 page
  await page.getByTestId('print').click()
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)
  await page.emulateMedia({ media: 'print' })
  for (const sel of ['.banner', '.topbar', '.statusbar', '.cardside']) await expect(page.locator(sel)).toBeHidden()
  await expect(page.locator('.fcard')).toBeVisible()
  const box = (await page.locator('.fcard').boundingBox())!
  expect(box.width).toBeLessThanOrEqual(128 * MM + 2)
  expect(box.height).toBeLessThanOrEqual(190 * MM + 2)
  expect(box.height / box.width).toBeLessThan(210 / 148 + 0.05) // not taller than the A5 proportion
  expect(box.x).toBeLessThan(4)
  await page.emulateMedia({ media: 'screen' })

  // save as image: a real PNG, named for the patient and language
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-image').click()])
  expect(dl.suggestedFilename()).toBe('follow-up-P-0417-bn.png')
  const path = await dl.path()
  const bytes = readFileSync(path)
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  expect(bytes.length).toBeGreaterThan(20_000)

  // history has the approval, the print and the image, by the doctor
  await page.goto('/#/audit')
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toContainText('Follow-up card approved')
  await expect(rows.first()).toContainText('saved as image')
  const all = await rows.allInnerTexts()
  expect(all.filter((r) => r.includes('Follow-up card approved')).length).toBe(5)
  expect(all.some((r) => r.includes('sent to print'))).toBe(true)
  expect(all.some((r) => r.includes('approved') && r.includes('Doctor'))).toBe(true)
  expect(errors).toEqual([])
})

test('card empty states and front desk', async ({ page }) => {
  await page.goto('/#/card/P-0417')
  // front desk: results cannot be turned on, and the reason is on the page
  await expect(page.getByLabel('Show last results')).toBeDisabled()
  await expect(page.getByText('Doctor only. Press Doctor at the top.')).toBeVisible()
  await expect(page.locator('.fcard')).not.toContainText('mg/g')
  // a note that is long still wraps inside the card
  await page.getByLabel("Doctor's note (printed as typed)").fill('x'.repeat(240))
  const b = (await page.locator('.fcard').boundingBox())!
  const n = (await page.locator('.fcard .note').boundingBox())!
  expect(n.x + n.width).toBeLessThanOrEqual(b.x + b.width)
})
