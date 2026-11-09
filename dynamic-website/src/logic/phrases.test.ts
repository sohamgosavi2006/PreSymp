import { describe, expect, it } from 'vitest'
import { PHRASE_KEY } from './due'
import { CARD, CHECK, CLINIC, LANGS, LANG_TAB, MONTHS, REMINDER, dateIn, reminder, type Lang } from './phrases'

const banks: Record<string, Record<string, Record<Lang, string>>> = { CHECK, CARD }
// tokens that stay in Latin script on a Hindi or Bengali card
const ALLOWED = /eGFR|UACR|mg\/g|mL\/min\/1\.73 m²|\{name\}|\{clinic\}|\{item\}/g
const INDIC = /[ऀ-ॿঀ-৿]/

describe('phrase bank is complete', () => {
  for (const [bank, table] of Object.entries(banks)) {
    it(`${bank}: every key has en, hi and bn text`, () => {
      expect(Object.keys(table).length).toBeGreaterThan(0)
      for (const [k, v] of Object.entries(table))
        for (const l of LANGS) expect(v[l]?.trim(), `${bank}.${k}.${l}`).toBeTruthy()
    })
  }

  it('MONTHS has twelve names per language', () => {
    for (const l of LANGS) {
      expect(MONTHS[l]).toHaveLength(12)
      MONTHS[l].forEach((m, i) => expect(m.trim(), `${l} month ${i + 1}`).toBeTruthy())
    }
  })

  it('REMINDER exists in every language and carries all three slots', () => {
    for (const l of LANGS) {
      expect(REMINDER[l].trim()).toBeTruthy()
      for (const slot of ['{name}', '{clinic}', '{item}']) expect(REMINDER[l], `${l} ${slot}`).toContain(slot)
    }
  })

  it('every check the due logic can name has a phrase', () => {
    for (const k of Object.values(PHRASE_KEY)) expect(CHECK[k], k).toBeDefined()
  })

  it('tab labels are set for all languages', () => {
    for (const l of LANGS) expect(LANG_TAB[l].trim()).toBeTruthy()
  })

  it('hi and bn text is written in its own script, with only the allowed Latin tokens', () => {
    const all: [string, string][] = []
    for (const [bank, table] of Object.entries(banks))
      for (const [k, v] of Object.entries(table)) for (const l of ['hi', 'bn'] as const) all.push([`${bank}.${k}.${l}`, v[l]])
    for (const l of ['hi', 'bn'] as const) {
      all.push([`REMINDER.${l}`, REMINDER[l]])
      MONTHS[l].forEach((m, i) => all.push([`MONTHS.${l}.${i}`, m]))
    }
    for (const [where, text] of all) {
      expect(INDIC.test(text), `${where} has no Hindi or Bengali letters`).toBe(true)
      expect(text.replace(ALLOWED, '').match(/[A-Za-z]/), `${where} has Latin letters left: ${text}`).toBeNull()
    }
  })

  it('the Hindi card does not use Bengali letters and the Bengali card does not use Devanagari', () => {
    const hi = [...Object.values(CARD), ...Object.values(CHECK)].map((v) => v.hi).concat(REMINDER.hi, MONTHS.hi)
    const bn = [...Object.values(CARD), ...Object.values(CHECK)].map((v) => v.bn).concat(REMINDER.bn, MONTHS.bn)
    for (const t of hi) expect(/[ঀ-৿]/.test(t), t).toBe(false)
    for (const t of bn) expect(/[ऀ-ॿ]/.test(t.replace(/[।॥]/g, '')), t).toBe(false)
  })
})

describe('dateIn', () => {
  it('writes day, month name and year with Latin digits', () => {
    expect(dateIn('en', '2025-12-18')).toBe('18 Dec 2025')
    expect(dateIn('hi', '2025-12-18')).toBe('18 दिसंबर 2025')
    expect(dateIn('bn', '2025-12-18')).toBe('18 ডিসেম্বর 2025')
  })
  it('does not pad the day and covers January and September', () => {
    expect(dateIn('en', '2026-01-05')).toBe('5 Jan 2026')
    expect(dateIn('hi', '2026-01-05')).toBe('5 जनवरी 2026')
    expect(dateIn('bn', '2025-09-30')).toBe('30 সেপ্টেম্বর 2025')
  })
})

describe('reminder', () => {
  it('fills name, clinic and the check name in each language', () => {
    for (const l of LANGS) {
      const t = reminder(l, 'Sunita Devi', 'foot')
      expect(t).toContain('Sunita Devi')
      expect(t).toContain(CLINIC)
      expect(t).toContain(CHECK.foot[l])
      expect(t).not.toMatch(/[{}]/)
    }
  })
})
