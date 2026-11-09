import { expect, test, type Page } from '@playwright/test'

const sample = async (page: Page, file: string) => {
  await page.goto('/#/day')
  await page.getByTestId('add-report').click()
  await page.getByTestId(`sample-${file}`).click()
}

test('To check: "Save to this patient" files the report to the chosen patient', async ({ page }) => {
  await sample(page, 'r-das-text.pdf')
  await page.getByTestId('open-queue').click({ timeout: 40_000 })
  const item = page.getByTestId('queue-Q-2')
  await expect(item).toContainText('Ramesh Das')
  await expect(item).toContainText('Rina Das')
  await expect(item).toContainText('Same surname') // why each one is a candidate
  await item.getByTestId('save-to-P-0288').click()
  await expect(item).toContainText('Saved to Ramesh Das')
  await page.goto('/#/patient/P-0288')
  await expect(page.getByTestId('map-dot')).toHaveCount(4)
})

test('To check: "None of these" resolves the item and saves nothing', async ({ page }) => {
  await sample(page, 'r-das-text.pdf')
  await page.getByTestId('open-queue').click({ timeout: 40_000 })
  await page.getByTestId('none-of-these').first().click()
  await expect(page.getByTestId('queue-Q-2')).toContainText('None of them is right')
  await page.goto('/#/patient/P-0288')
  await expect(page.getByTestId('map-dot')).toHaveCount(3)
})

test('wrong unit is refused and waits in To check', async ({ page }) => {
  await sample(page, 'm-roy-wrong-unit.pdf')
  await page.getByTestId('open-queue').click({ timeout: 40_000 })
  await expect(page.getByTestId('queue-reason').filter({ hasText: '55 mL/min' })).toHaveCount(1)
  await page.goto('/#/patient/P-0061')
  await expect(page.getByTestId('map-dot')).toHaveCount(3)
})

test('the same report twice is not added twice', async ({ page }) => {
  await sample(page, 'kabita-banerjee-text.pdf')
  await page.getByTestId('open-patient').click({ timeout: 40_000 })
  await expect(page.getByTestId('map-dot')).toHaveCount(5)
  await page.getByTestId('rail-drop').scrollIntoViewIfNeeded()
  await page.locator('input[type=file]').setInputFiles('public/samples/kabita-banerjee-text.pdf')
  await expect(page.getByText(/already/i).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('map-dot')).toHaveCount(5)
})

test('Listen: no voice means a plain note, then Send is logged as read', async ({ page }) => {
  await page.addInitScript(() => {
    const ss = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {}, removeEventListener() {} }
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true })
  })
  await page.goto('/#/due')
  await expect(page.getByTestId('no-voice')).toHaveText('No Bengali voice on this computer. Read the text before sending.')
  await expect(page.getByTestId('listen')).toBeDisabled()
  await page.getByTestId('listen').locator('xpath=ancestor::section').getByRole('button', { name: 'Send message' }).click()
  await page.goto('/#/audit')
  await expect(page.locator('tbody tr').first()).toContainText('read first')
})

test('Listen: with a voice the message is spoken and Send is logged as listened', async ({ page }) => {
  await page.addInitScript(() => {
    const voice = { lang: 'bn-IN', name: 'Test Bengali' }
    class U { text: string; voice: unknown; lang = ''; onend: null | (() => void) = null; onerror = null; constructor(t: string) { this.text = t } }
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = U
    ;(window as unknown as { __said: string[] }).__said = []
    const ss = {
      getVoices: () => [voice],
      speak(u: U) { (window as unknown as { __said: string[] }).__said.push(u.text); setTimeout(() => u.onend?.(), 50) },
      cancel() {}, addEventListener() {}, removeEventListener() {},
    }
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true })
  })
  await page.goto('/#/due')
  await page.getByTestId('listen').click()
  await expect(page.getByTestId('listen-note')).toContainText('You listened')
  expect(await page.evaluate(() => (window as unknown as { __said: string[] }).__said[0])).toContain('নমস্কার')
  await page.getByRole('button', { name: 'Send message' }).click()
  await page.goto('/#/audit')
  await expect(page.locator('tbody tr').first()).toContainText('listened first')
})

test('doctor changes the schedule with a reason, then goes back', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByRole('button', { name: /Save as version 3/ })).toBeDisabled() // front desk cannot
  await page.getByRole('button', { name: 'Doctor', exact: true }).click()
  await page.getByLabel('Eye test every').fill('6')
  await expect(page.getByRole('button', { name: /Save as version 3/ })).toBeDisabled() // a reason is required
  await page.getByPlaceholder('Why are you changing this?').fill('Eye check every 6 months')
  await page.getByRole('button', { name: /Save as version 3/ }).click()
  await page.getByRole('button', { name: 'Go back to this version' }).first().click() // version 2
  await page.goto('/#/audit')
  await expect(page.locator('tbody tr').nth(0)).toContainText('Schedule changed back')
  await expect(page.locator('tbody tr').nth(1)).toContainText('Schedule saved')
})

test('FHIR export carries the three LOINC codes', async ({ page }) => {
  await page.goto('/#/patient/P-0417')
  await page.getByRole('button', { name: 'Download results' }).click()
  const dl = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /FHIR/ }).click()
  const file = await (await dl).createReadStream()
  let txt = ''
  for await (const c of file!) txt += c
  for (const code of ['98979-8', '9318-7', '2160-0']) expect(txt).toContain(code)
})

test('Find "eye" puts the eye report first, and Enter opens it', async ({ page }) => {
  await page.goto('/#/patient/P-0417')
  await page.getByLabel('Find in reports').fill('eye')
  await expect(page.getByTestId('found').locator('li').first()).toContainText('Eye report')
  await page.getByLabel('Find in reports').press('Enter')
  await expect(page.getByRole('dialog', { name: 'Source report' })).toContainText('Eye report')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Source report' })).toHaveCount(0)
})

test('the scope page names the two new rows', async ({ page }) => {
  await page.goto('/#/scope')
  await expect(page.getByText('Guessing from a photo of a report')).toBeVisible()
  await expect(page.getByText('Answering questions about reports')).toBeVisible()
})
