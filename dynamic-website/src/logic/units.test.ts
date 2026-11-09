import { describe, expect, it } from 'vitest'
import { checkUnit, inRange, RANGE } from './units'

describe('unit check', () => {
  it('accepts eGFR per 1.73 m² however it is written', () => {
    for (const u of ['mL/min/1.73 m²', 'ml/min/1.73m2', 'mL/min/{1.73_m2}', 'mL/min/1.73 m^2', 'mL/min per 1.73 m²', 'mL/minute/1.73 m2', 'ML/MIN/1.73 M²'])
      expect(checkUnit('egfr', 95, u).res, u).toBe('ok')
  })
  it('refuses mL/min', () => {
    const r = checkUnit('egfr', 55, 'mL/min')
    expect(r.res).toBe('refused')
    expect(r.why).toContain('55 mL/min')
  })
  it('refuses an empty unit and any other eGFR unit', () => {
    expect(checkUnit('egfr', 55, '').res).toBe('refused')
    expect(checkUnit('egfr', 55, 'mg/dL').res).toBe('refused')
    expect(checkUnit('egfr', 55, 'mL/min/1.73').res).toBe('refused')
  })
  it('converts UACR mg/mmol to mg/g and keeps the printed text', () => {
    const r = checkUnit('uacr', 2, 'mg/mmol')
    expect(r).toMatchObject({ res: 'converted', v: 17.7, u: 'mg/g', asPrinted: '2 mg/mmol' })
  })
  it('multiplies UACR by 8.84 and rounds to one decimal', () => {
    expect(checkUnit('uacr', 1.4, 'mg/mmol')).toMatchObject({ v: 12.4, asPrinted: '1.4 mg/mmol' })
    expect(checkUnit('uacr', 3.4, 'mg/mmol').v).toBe(30.1)
    expect(checkUnit('uacr', 0.1, 'mg/mmol').v).toBe(0.9)
  })
  it('takes mg/g with the base named', () => {
    for (const u of ['mg/g', 'mg/g creat', 'mg/g creatinine', 'mg/g Cr', 'mg/gm', 'MG/G']) expect(checkUnit('uacr', 9, u), u).toMatchObject({ res: 'ok', v: 9 })
    expect(checkUnit('uacr', 1.4, 'mg/mmol creat').res).toBe('converted')
    expect(checkUnit('uacr', 1.4, 'mg/mmol Cr').res).toBe('converted')
  })
  it('refuses another UACR unit', () => {
    expect(checkUnit('uacr', 9, 'mg/L').res).toBe('refused')
    expect(checkUnit('uacr', 9, '').res).toBe('refused')
  })
  it('converts creatinine µmol/L to mg/dL and keeps the printed text', () => {
    expect(checkUnit('creat', 106, 'µmol/L')).toMatchObject({ res: 'converted', v: 1.2, u: 'mg/dL', asPrinted: '106 µmol/L' })
    expect(checkUnit('creat', 106, 'μmol/L').res).toBe('converted') // the Greek mu from a font
    expect(checkUnit('creat', 106, 'umol/L').res).toBe('converted')
    expect(checkUnit('creat', 106, 'micromol/L').res).toBe('converted')
  })
  it('rounds creatinine to two decimals', () => {
    expect(checkUnit('creat', 97, 'µmol/L').v).toBe(1.1)
    expect(checkUnit('creat', 80, 'µmol/L').v).toBe(0.9)
    expect(checkUnit('creat', 62, 'µmol/L').v).toBe(0.7)
    expect(checkUnit('creat', 70, 'µmol/L').v).toBe(0.79)
  })
  it('takes creatinine in mg/dL as it is and refuses the rest', () => {
    expect(checkUnit('creat', 0.75, 'mg/dL')).toMatchObject({ res: 'ok', v: 0.75 })
    expect(checkUnit('creat', 0.75, 'mg/L').res).toBe('refused')
  })
})

describe('sanity ranges', () => {
  it('has the limits from the brief', () => {
    expect(RANGE).toEqual({ egfr: [1, 200], uacr: [0, 5000], creat: [0.1, 20] })
  })
  it('includes both ends and nothing outside', () => {
    expect(inRange('egfr', 1)).toBe(true)
    expect(inRange('egfr', 200)).toBe(true)
    expect(inRange('egfr', 0)).toBe(false)
    expect(inRange('egfr', 201)).toBe(false)
    expect(inRange('uacr', 0)).toBe(true)
    expect(inRange('uacr', 5000)).toBe(true)
    expect(inRange('uacr', 5000.1)).toBe(false)
    expect(inRange('creat', 0.1)).toBe(true)
    expect(inRange('creat', 20)).toBe(true)
    expect(inRange('creat', 0.09)).toBe(false)
    expect(inRange('creat', 20.5)).toBe(false)
    expect(inRange('egfr', NaN)).toBe(false)
  })
})
