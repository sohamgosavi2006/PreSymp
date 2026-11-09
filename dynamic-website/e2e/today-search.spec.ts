import { expect, test } from '@playwright/test'

const rows = (page: import('@playwright/test').Page) => page.locator('.daylist .trow:not(.head)')
const tokens = (page: import('@playwright/test').Page) => rows(page).locator('.tk').allInnerTexts()

test('Today chips filter the rows and the counts match', async ({ page }) => {
  await page.goto('/#/day')
  await expect(rows(page)).toHaveCount(8)
  const chip = (re: RegExp) => page.getByRole('group', { name: 'Show' }).getByRole('button', { name: re })
  await expect(chip(/^All \(8\)/)).toBeVisible()

  for (const [name, n] of [[/^New report/, 1], [/^To call/, 4], [/^To check/, 1], [/^Nothing due/, 4]] as const) {
    const c = chip(name)
    await expect(c).toContainText(`(${n})`)
    await c.click()
    await expect(c).toHaveAttribute('aria-pressed', 'true')
    await expect(rows(page)).toHaveCount(n)
    await c.click() // click again clears
    await expect(c).toHaveAttribute('aria-pressed', 'false')
    await expect(rows(page)).toHaveCount(8)
  }

  // the new report is N. Ghosh; nothing due holds the four patients with nothing to do
  await chip(/^New report/).click()
  await expect(rows(page).first()).toContainText('N. Ghosh')
  await chip(/^To check/).click()
  await expect(rows(page).first()).toContainText('T. Sen')
})

test('Token order is the default, Longest waiting sorts by the wait', async ({ page }) => {
  await page.goto('/#/day')
  await expect(page.getByRole('button', { name: 'Token order' })).toHaveAttribute('aria-pressed', 'true')
  expect(await tokens(page)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  // the new report (token 4) is marked in place, not moved to the top
  await expect(rows(page).nth(3)).toContainText('New report')

  await page.getByRole('button', { name: 'Longest waiting' }).click()
  await expect(page.getByRole('button', { name: 'Longest waiting' })).toHaveAttribute('aria-pressed', 'true')
  const t = await tokens(page)
  expect(t[0]).toBe('2') // A. Khan, 5 months
  expect(t.slice(0, 4)).toEqual(['2', '3', '5', '7'])
  expect(t.slice(4)).toEqual(['1', '4', '6', '8']) // nothing to do, in token order

  await page.getByRole('button', { name: 'Token order' }).click()
  expect(await tokens(page)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
})

test('Mark done on S. Devi eye test clears the row and writes History', async ({ page }) => {
  await page.goto('/#/day')
  const devi = page.locator('.trow[data-pid="P-0417"]')
  await expect(devi).toContainText('Eye test')
  await devi.getByRole('button', { name: /Mark done/ }).click()
  const dlg = page.getByRole('dialog', { name: /Mark done/ })
  await expect(dlg.getByRole('radio', { name: /Eye test/ })).toBeChecked()
  await expect(dlg.getByLabel('Date done')).toHaveAttribute('max', '2025-12-18')
  await dlg.getByLabel('Date done').fill('2025-12-10')
  await dlg.getByRole('button', { name: 'Confirm' }).click()
  await expect(dlg).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Marked done')
  await expect(devi).not.toContainText('Eye test')
  await expect(devi).toContainText('Nothing to do.')
  await page.goto('/#/audit')
  await expect(page.locator('tbody tr').first()).toContainText('Marked done')
  await expect(page.locator('tbody tr').first()).toContainText('S. Devi')
})

test('Mark done needs a date that is not in the future', async ({ page }) => {
  await page.goto('/#/day')
  await page.locator('.trow[data-pid="P-0417"]').getByRole('button', { name: /Mark done/ }).click()
  const dlg = page.getByRole('dialog', { name: /Mark done/ })
  await dlg.getByLabel('Date done').fill('')
  await expect(dlg.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  await dlg.getByLabel('Date done').fill('2025-12-19')
  await expect(dlg.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
})

test('Prepare reminder opens the call list with that item selected', async ({ page }) => {
  await page.goto('/#/day')
  const devi = page.locator('.trow[data-pid="P-0417"]')
  await devi.getByRole('button', { name: /Prepare reminder/ }).click()
  await expect(page).toHaveURL(/#\/due/)
  await expect(page.locator('tr.sel')).toContainText('S. Devi')
  await expect(page.locator('tr.sel')).toContainText('Eye test')
  // nothing due: the button is off, with its reason
  await page.goto('/#/day')
  const banerjee = page.locator('.trow[data-pid="P-0533"]').getByRole('button', { name: /Prepare reminder/ })
  await expect(banerjee).toBeDisabled()
  await expect(banerjee).toHaveAttribute('title', 'Nothing due')
})

test('Review report opens the newest report in the viewer, and the row actions do not open the patient', async ({ page }) => {
  await page.goto('/#/day')
  await page.locator('.trow[data-pid="P-0417"]').getByRole('button', { name: /Review report/ }).click()
  await expect(page.getByRole('dialog', { name: 'Source report' })).toBeVisible()
  await expect(page).toHaveURL(/#\/day/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Source report' })).toBeHidden()
  // the name opens the patient
  await page.locator('.trow[data-pid="P-0417"] .who a').click()
  await expect(page).toHaveURL(/#\/patient\/P-0417/)
})

test('/ focuses the search and the last four digits find the patient', async ({ page }) => {
  await page.goto('/#/day')
  await expect(page.getByLabel('Search patients')).toHaveAttribute('placeholder', 'Search name, ID or phone ( / )')
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('/')
  await expect(page.getByLabel('Search patients')).toBeFocused()
  await page.keyboard.type('0344')
  const hits = page.locator('.hits li button')
  await expect(hits).toHaveCount(1)
  await expect(hits.first()).toContainText('Ramesh Das')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/patient\/P-0288/)

  const s = page.getByLabel('Search patients')
  await s.fill('210')
  await expect(page.locator('.hits li button')).toContainText(['Sunita Devi'])
  await s.fill('P-0932')
  await expect(page.locator('.hits li button')).toContainText(['Arif Khan'])
  await s.fill('nobody')
  await expect(page.locator('.hits li.none')).toBeVisible()
})
