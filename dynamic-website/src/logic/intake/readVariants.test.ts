import { describe, expect, it } from 'vitest'
import { dateIn, equationIn, groupLines, labelOf, labelsIn, readAll, readHeader, readLine, readReport, type Bit } from './readPdf'

const b = (str: string, x: number, y: number, w = str.length * 5): Bit => ({ str, x, y, w, h: 10 })
const row = (...bits: Bit[]) => groupLines(bits, 1, 600, 800)[0]

describe('label variants', () => {
  it('eGFR in every spelling', () => {
    for (const t of ['eGFR  95', 'Estimated GFR  95', 'GFR, estimated  95', 'GFR (estimated)  95', 'GFR  95', 'e GFR  95', 'Estimated glomerular filtration rate  95'])
      expect(labelOf(t)?.kind, t).toBe('egfr')
  })
  it('UACR in every spelling', () => {
    for (const t of ['Albumin/Creatinine ratio  9', 'Albumin / Creatinine Ratio  9', 'UACR  9', 'ACR  9', 'Microalbumin/Creatinine ratio  9', 'Urine albumin/creatinine ratio  9', 'U ACR  9'])
      expect(labelOf(t)?.kind, t).toBe('uacr')
  })
  it('blood creatinine in every spelling', () => {
    for (const t of ['Creatinine, serum  0.8', 'Creatinine (blood)  0.8', 'S. Creatinine  0.8', 'Serum creatinine  0.8', 'Creatinine  0.8', 'Creatinine (serum)  0.8'])
      expect(labelOf(t)?.kind, t).toBe('creat')
  })
  it('never takes urine creatinine, creatinine clearance or the ratio for blood creatinine', () => {
    for (const t of ['Urine creatinine  78', 'Urine Creatinine, spot  78', 'U. Creatinine  78', 'Creatinine clearance  90', 'Albumin/Creatinine ratio  9'])
      expect(labelsIn(t).some((l) => l.kind === 'creat'), t).toBe(false)
  })
  it('finds two names in one line, each with its own number', () => {
    const hits = readAll(row(b('Creatinine', 20, 100), b('0.8', 100, 100), b('mg/dL', 140, 100), b('eGFR', 300, 100), b('95', 350, 100), b('mL/min/1.73 m²', 390, 100)))
    expect(hits.map((h) => [h.kind, h.v, h.printedUnit])).toEqual([['creat', 0.8, 'mg/dL'], ['egfr', 95, 'mL/min/1.73 m²']])
  })
})

describe('value and unit', () => {
  it('joins a unit that is split over several pieces', () => {
    expect(readLine(row(b('eGFR', 20, 100), b('95', 150, 100), b('mL/min', 190, 100), b('/', 235, 100, 5), b('1.73', 242, 100), b('m2', 270, 100)))!.printedUnit).toBe('mL/min/1.73 m2')
    expect(readLine(row(b('eGFR', 20, 100), b('95', 150, 100), b('mL/min/1.73', 190, 100), b('m²', 260, 100)))!.printedUnit).toBe('mL/min/1.73 m²')
  })
  it('skips a flag between the value and the unit', () => {
    expect(readLine(row(b('Creatinine', 20, 100), b('1.4', 150, 100), b('H', 180, 100), b('mg/dL', 200, 100)))).toMatchObject({ v: 1.4, printedUnit: 'mg/dL' })
  })
  it('reads the unit that follows a printed reference range', () => {
    expect(readLine(row(b('Creatinine', 20, 100), b('0.75', 150, 100), b('0.60–1.10', 190, 100), b('mg/dL', 260, 100)))).toMatchObject({ v: 0.75, printedUnit: 'mg/dL' })
  })
  it('reads a unit printed in brackets after the name', () => {
    expect(readLine(row(b('Albumin/Creatinine ratio (mg/g)', 20, 100), b('9.0', 250, 100)))).toMatchObject({ v: 9, printedUnit: 'mg/g' })
  })
  it('keeps the unit empty when none is printed', () => {
    expect(readLine(row(b('eGFR', 20, 100), b('95', 150, 100), b('[>90]', 200, 100)))).toMatchObject({ v: 95, printedUnit: '' })
  })
  it('never guesses from a limit or a range', () => {
    expect(readLine(row(b('UACR', 20, 100), b('<5', 150, 100), b('mg/g', 190, 100)))).toBeUndefined()
    expect(readLine(row(b('eGFR', 20, 100), b('60–90', 150, 100), b('mL/min/1.73 m²', 200, 100)))).toBeUndefined()
  })
  it('reads a decimal comma-free number with a unit in the same item', () => {
    expect(readLine(row(b('Serum creatinine', 20, 100), b('1.05 mg/dL', 200, 100)))).toMatchObject({ v: 1.05, printedUnit: 'mg/dL' })
  })
})

describe('equation', () => {
  it('reads each printed form', () => {
    expect(equationIn('eGFR (CKD-EPI 2021)')).toBe('CKD-EPI 2021')
    expect(equationIn('eGFR CKD-EPI')).toBe('CKD-EPI')
    expect(equationIn('eGFR by CKD- EPI 2021')).toBe('CKD-EPI 2021')
    expect(equationIn('estimated by the MDRD formula')).toBe('MDRD')
    expect(equationIn('CKD-EPI creatinine equation (2021)')).toBe('CKD-EPI 2021')
    expect(equationIn('Sodium  140')).toBeUndefined()
  })
  it('goes into the hit from the label', () => {
    expect(readLine(row(b('eGFR (CKD-EPI 2021)', 20, 100), b('95', 250, 100), b('mL/min/1.73 m²', 300, 100)))!.equation).toBe('CKD-EPI 2021')
  })
  it('is found on the line next to the eGFR line', () => {
    const lines = groupLines([b('eGFR', 20, 300), b('88', 150, 300), b('mL/min/1.73 m²', 190, 300), b('Calculated with the CKD-EPI 2021 equation', 20, 315)], 1, 600, 800)
    expect(readReport([lines]).hits.egfr?.equation).toBe('CKD-EPI 2021')
  })
  it('is left out when nothing is printed', () => {
    expect(readLine(row(b('eGFR', 20, 100), b('95', 150, 100), b('mL/min/1.73 m²', 190, 100)))!.equation).toBeUndefined()
  })
})

describe('dates', () => {
  it('reads the forms labs print', () => {
    expect(dateIn('18 Dec 2025').d).toBe('2025-12-18')
    expect(dateIn('18-Dec-2025 10:30').d).toBe('2025-12-18')
    expect(dateIn('18 December 2025').d).toBe('2025-12-18')
    expect(dateIn('18/12/2025').d).toBe('2025-12-18')
    expect(dateIn('18.12.25').d).toBe('2025-12-18')
    expect(dateIn('2025-12-18').d).toBe('2025-12-18')
    expect(dateIn('Dec 18, 2025').d).toBe('2025-12-18')
  })
  it('refuses a date that is not on the calendar', () => {
    expect(dateIn('31/02/2025').d).toBeUndefined()
    expect(dateIn('18 Dec').partial).toBe(true)
  })
})

const head = (...rows: Bit[][]) => groupLines(rows.flat(), 1, 600, 800)
describe('header variants', () => {
  it('Reported wins over Collected, whatever the order', () => {
    expect(readHeader(head([b('Reported: 18 Dec 2025', 400, 700)], [b('Collected: 16 Dec 2025', 400, 720)])).date).toBe('2025-12-18')
    expect(readHeader(head([b('Collected: 16 Dec 2025', 400, 700)], [b('Reported: 18 Dec 2025', 400, 720)])).date).toBe('2025-12-18')
  })
  it('accepts Date of report and Report date', () => {
    expect(readHeader(head([b('Date of report', 300, 700), b('18/12/2025', 400, 700)])).date).toBe('2025-12-18')
    expect(readHeader(head([b('Report date: 18-Dec-2025', 300, 700)])).date).toBe('2025-12-18')
  })
  it('both dates on one line', () => {
    expect(readHeader(head([b('Collected: 16 Dec 2025   Reported: 18 Dec 2025', 50, 700)])).date).toBe('2025-12-18')
  })
  it('joins a year that wrapped under its day and month', () => {
    const lines = head([b('Collected', 354, 198), b('18 Dec', 406, 198)], [b('2025', 406, 212)])
    expect(readHeader(lines).date).toBe('2025-12-18')
  })
  it('age and sex in each printed form', () => {
    const f = (s: string) => readHeader(head([b(`Age / Sex: ${s}`, 50, 700)]))
    expect(f('52 / F')).toMatchObject({ age: 52, sex: 'F' })
    expect(f('52Y/F')).toMatchObject({ age: 52, sex: 'F' })
    expect(f('52 Years Female')).toMatchObject({ age: 52, sex: 'F' })
    expect(f('63 yrs / Male')).toMatchObject({ age: 63, sex: 'M' })
    expect(f('47M')).toMatchObject({ age: 47, sex: 'M' })
    expect(f('not printed').age).toBeUndefined()
  })
  it('age and sex printed apart', () => {
    expect(readHeader(head([b('Age: 52 Years', 50, 700), b('Sex: Female', 250, 700)]))).toMatchObject({ age: 52, sex: 'F' })
  })
  it('age and sex after the name', () => {
    expect(readHeader(head([b('Patient Name : Mrs. Kabita Banerjee 52Y/F', 50, 700)]))).toMatchObject({ name: 'Kabita Banerjee', age: 52, sex: 'F' })
  })
  it('ID, UHID and MRN', () => {
    expect(readHeader(head([b('UHID: P-0533', 50, 700)])).id).toBe('P-0533')
    expect(readHeader(head([b('MRN 20231234', 50, 700)])).id).toBe('20231234')
    expect(readHeader(head([b('Patient ID : p-0288', 50, 700)])).id).toBe('P-0288')
  })
  it('never takes a sample or accession number for an ID', () => {
    expect(readHeader(head([b('Sample ID: S-99812', 50, 700), b('Accession A-676833', 300, 700)])).id).toBeUndefined()
    expect(readHeader(head([b('ID: not printed', 50, 700)])).id).toBeUndefined()
  })
  it('lab name when there is no letter', () => {
    expect(readHeader(head([b('Metro Diagnostics Pvt Ltd', 50, 780)])).lab).toBe('Metro Diagnostics Pvt Ltd')
    expect(readHeader(head([b('Lab B · Example Laboratory', 50, 780)])).lab).toBe('B')
  })
  it('name after Patient Name, with a title', () => {
    expect(readHeader(head([b('Patient Name:', 50, 700), b('Mr. Arif Khan', 150, 700), b('Age: 47', 300, 700)])).name).toBe('Arif Khan')
  })
})
