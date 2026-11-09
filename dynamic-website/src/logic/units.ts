export type Kind = 'egfr' | 'uacr' | 'creat'

export const UNIT: Record<Kind, string> = {
  egfr: 'mL/min/1.73 m²',
  uacr: 'mg/g',
  creat: 'mg/dL',
}

// plain names for messages
export const NAME: Record<Kind, string> = { egfr: 'eGFR', uacr: 'UACR', creat: 'creatinine' }

// a value outside these limits is a misread, never a result. checked on the stored unit
export const RANGE: Record<Kind, [number, number]> = { egfr: [1, 200], uacr: [0, 5000], creat: [0.1, 20] }
export const inRange = (kind: Kind, v: number) => Number.isFinite(v) && v >= RANGE[kind][0] && v <= RANGE[kind][1]

// strip spaces, braces and the superscript so "mL/min/{1.73_m2}" and "mL/min/1.73 m²" agree
const squash = (u: string) =>
  u
    .toLowerCase()
    .replace(/[\s{}_]/g, '')
    .replace(/[²]/g, '2')
    .replace(/\^2/g, '2')
    .replace(/[µμ]/g, 'u')
    .replace(/micromol/g, 'umol')
    .replace(/per/g, '/')
    .replace(/minute/g, 'min')
    .replace(/\/\/+/g, '/')

export type UnitResult =
  | { res: 'ok'; v: number; u: string; why: string }
  | { res: 'converted'; v: number; u: string; asPrinted: string; why: string }
  | { res: 'refused'; v: number; u: string; why: string }

export function checkUnit(kind: Kind, v: number, printed: string): UnitResult {
  const s = squash(printed)
  const asPrinted = `${v} ${printed.trim()}`
  if (kind === 'egfr') {
    if (s === 'ml/min/1.73m2') return { res: 'ok', v, u: UNIT.egfr, why: 'Unit is right.' }
    if (s === 'ml/min')
      return {
        res: 'refused', v, u: printed,
        why: `The report says "${v} mL/min". The unit has to be mL/min/1.73 m². We cannot compare it. Not saved.`,
      }
    return { res: 'refused', v, u: printed, why: `Unit "${printed}" is not right for this result. Not saved.` }
  }
  if (kind === 'uacr') {
    // "mg/g creat", "mg/mmol creatinine" and "mg/mmol Cr" are the same units with the base named
    const t = s.replace(/(creatinine|creat|cr)$/, '')
    if (t === 'mg/g' || t === 'mg/gm') return { res: 'ok', v, u: UNIT.uacr, why: 'Unit is right.' }
    if (t === 'mg/mmol')
      return { res: 'converted', v: round(v * 8.84, 1), u: UNIT.uacr, asPrinted, why: 'Converted from mg/mmol.' }
    return { res: 'refused', v, u: printed, why: `Unit "${printed}" is not right for this result. Not saved.` }
  }
  if (s === 'mg/dl') return { res: 'ok', v, u: UNIT.creat, why: 'Unit is right.' }
  if (s === 'umol/l')
    return { res: 'converted', v: round(v / 88.4, 2), u: UNIT.creat, asPrinted, why: 'Converted from µmol/L.' }
  return { res: 'refused', v, u: printed, why: `Unit "${printed}" is not right for this result. Not saved.` }
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
