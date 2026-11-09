import { UNIT, type Kind } from '../logic/units'
import type { Aud, Cfg, Doc, Obs, Pt, QItem, Ver } from './types'

export const PTS: Pt[] = [
  { id: 'P-0417', name: 'Sunita Devi', short: 'S. Devi', age: 58, sex: 'F', lang: 'bn', phone: '+91 98xxx x0210', token: 3 },
  { id: 'P-0288', name: 'Ramesh Das', short: 'R. Das', age: 63, sex: 'M', lang: 'bn', phone: '+91 98xxx x0344', token: 5 },
  { id: 'P-0932', name: 'Arif Khan', short: 'A. Khan', age: 47, sex: 'M', lang: 'hi', phone: '+91 97xxx x0518', token: 2 },
  { id: 'P-0061', name: 'Mohan Roy', short: 'M. Roy', age: 71, sex: 'M', lang: 'en', phone: '+91 98xxx x0092', token: 7 },
  { id: 'P-0533', name: 'Kabita Banerjee', short: 'K. Banerjee', age: 52, sex: 'F', lang: 'bn', phone: '+91 90xxx x0776', token: 1 },
  { id: 'P-0814', name: 'Nandini Ghosh', short: 'N. Ghosh', age: 44, sex: 'F', lang: 'en', phone: '+91 98xxx x0431', token: 4 },
  { id: 'P-0299', name: 'Rina Das', short: 'Ri. Das', age: 55, sex: 'F', lang: 'bn', phone: '+91 98xxx x0655', token: 6 },
  { id: 'P-0702', name: 'Tapan Sen', short: 'T. Sen', age: 66, sex: 'M', lang: 'hi', phone: '+91 96xxx x0187', token: 8 },
]

// pid, date, eGFR, UACR, creatinine, lab
const READS: [string, string, number, number, number, 'A' | 'B'][] = [
  ['P-0417', '2021-10-12', 77, 9.6, 0.84, 'A'],
  ['P-0417', '2022-01-20', 74, 12, 0.88, 'A'],
  ['P-0417', '2023-02-14', 70, 15, 0.92, 'A'],
  ['P-0417', '2024-03-22', 68, 18, 0.95, 'B'],
  ['P-0417', '2024-10-18', 61, 140, 1.04, 'B'],
  ['P-0417', '2025-06-20', 52, 210, 1.19, 'A'],
  ['P-0417', '2025-09-18', 54, 190, 1.15, 'A'],
  ['P-0288', '2023-08-14', 78, 14, 0.98, 'A'],
  ['P-0288', '2024-08-16', 75, 22, 1.02, 'A'],
  ['P-0288', '2025-08-28', 72, 85, 1.08, 'A'],
  ['P-0932', '2022-07-18', 97, 9, 0.9, 'B'],
  ['P-0932', '2023-07-20', 94, 10, 0.93, 'B'],
  ['P-0932', '2024-07-18', 95, 12, 0.92, 'B'],
  ['P-0061', '2025-03-12', 64, 18, 1.12, 'A'],
  ['P-0061', '2025-06-19', 61, 21, 1.16, 'A'],
  ['P-0061', '2025-09-11', 57, 25, 1.22, 'A'],
  ['P-0533', '2024-06-05', 99, 8, 0.71, 'B'],
  ['P-0533', '2024-12-09', 97, 9, 0.72, 'B'],
  ['P-0533', '2025-06-03', 98, 7, 0.73, 'B'],
  ['P-0533', '2025-12-02', 96, 8, 0.74, 'B'],
  ['P-0814', '2024-12-09', 88, 11, 0.82, 'A'],
  ['P-0814', '2025-12-17', 86, 13, 0.84, 'A'],
  ['P-0299', '2024-10-03', 82, 16, 0.8, 'B'],
  ['P-0299', '2025-10-10', 80, 18, 0.83, 'B'],
  ['P-0702', '2025-05-07', 70, 24, 1.05, 'A'],
  ['P-0702', '2025-11-12', 68, 26, 1.08, 'A'],
]

const CONF: Record<Kind, number> = { egfr: 0.97, uacr: 0.96, creat: 0.94 }
export const nameOf = (id: string) => PTS.find((p) => p.id === id)!.name
export const docIdOf = (pid: string, d: string) => `D-${pid}-${d.replace(/-/g, '')}`

// the three numbers of one kidney report, as seeded observations
export function obsFor(pid: string, d: string, egfr: number, uacr: number, creat: number, doc: string, ocr = false): Obs[] {
  const mk = (kind: Kind, v: number, page: number, ln: string): Obs => ({
    id: `${pid}-${d}-${kind}`, pid, kind, v, u: UNIT[kind], d,
    // seeded reports find the line by ln, so the box is empty
    source: { docId: doc, page, bbox: [0, 0, 0, 0], via: ocr ? 'ocr' : 'seed', ln, ...(ocr ? { conf: CONF[kind] } : {}) },
  })
  return [mk('egfr', egfr, 1, 'egfr'), mk('uacr', uacr, 2, 'acr'), mk('creat', creat, 1, 'creat')]
}

function seedDocs() {
  const docs: Doc[] = []
  const obs: Obs[] = []
  for (const [pid, d, e, u, c, lab] of READS) {
    const id = docIdOf(pid, d)
    const scan = pid === 'P-0417' && d === '2024-10-18'
    docs.push({ id, pid, kind: 'kidney', lab, d, who: nameOf(pid), pages: 3, scan, isNew: pid === 'P-0814' && d === '2025-12-17' })
    obs.push(...obsFor(pid, d, e, u, c, id, scan))
  }
  const note = (pid: string, kind: 'fundus' | 'foot', d: string, lab: 'A' | 'B') =>
    docs.push({ id: `${docIdOf(pid, d)}-${kind}`, pid, kind, lab, d, who: nameOf(pid), pages: 1 })
  note('P-0417', 'fundus', '2024-10-18', 'B')
  note('P-0417', 'foot', '2025-01-15', 'A')
  note('P-0932', 'foot', '2025-03-10', 'B')
  note('P-0932', 'fundus', '2025-02-04', 'B')
  note('P-0061', 'fundus', '2025-01-22', 'A')
  note('P-0061', 'foot', '2025-05-30', 'A')
  note('P-0533', 'fundus', '2025-06-11', 'B')
  note('P-0533', 'foot', '2025-06-11', 'B')
  return { docs, obs }
}

// Tapan Sen's report is already waiting in the check list
export const SEN_DOC: Doc = {
  id: 'D-Q-SEN', pid: '', kind: 'kidney', lab: 'A', d: '2025-12-17', who: 'Tapan Sen', ageSex: '66 / M', pages: 3,
  pre: { egfr: '66 mL/min', uacr: 27, creat: 1.1 },
}

export const BASE_CFG: Cfg = { panel: 12, rptMin: 3, rptMax: 6, egfr2: 3, fundus: 12, foot: 12 }

const vers = (): Ver[] => [
  { n: 1, cfg: { ...BASE_CFG, egfr2: 6 }, by: 'Dr. M.', at: '6 Jan 2025', reason: 'First schedule' },
  { n: 2, cfg: { ...BASE_CFG }, by: 'Dr. M.', at: '12 Jun 2025', reason: 'Second eGFR wait set to match the 3-month repeat wait' },
]

const a = (when: string, who: string, role: string, act: string, det: string): Aud => ({ id: `S-${when}-${act}`, when, who, role, act, det })
const K = (when: string, act: string, det: string) => a(when, 'K.', 'Front desk', act, det)
const aud = (): Aud[] => [
  K('Thu 18 Dec 2025 09:31', 'Message sent', 'S. Roy · yearly kidney check · via clinic WhatsApp'),
  K('Thu 18 Dec 2025 09:20', 'Message sent', 'P. Bose · eye check · via clinic WhatsApp'),
  K('Thu 18 Dec 2025 09:12', 'Message sent', 'A. Mitra · follow-up urine test · via clinic WhatsApp'),
  K('Thu 18 Dec 2025 08:55', 'Report came in', 'Tapan Sen · Lab A · sent to check list (wrong unit)'),
  K('Wed 17 Dec 2025 17:02', 'Report saved', 'Nandini Ghosh · Lab A · matched by ID'),
  a('Wed 17 Dec 2025 11:40', 'Dr. M.', 'Doctor', 'Schedule viewed', 'Version 2 · 12 Jun 2025'),
  K('Tue 16 Dec 2025 15:18', 'Results downloaded', '5 results for R. Das · Excel file'),
  K('Mon 15 Dec 2025 10:05', 'Message skipped', 'M. Paul · foot check · reason: Patient attended'),
  K('Fri 12 Dec 2025 16:44', 'Report saved', 'Kabita Banerjee · Lab B · matched by ID'),
  a('Thu 11 Dec 2025 09:10', 'Dr. M.', 'Doctor', 'Backup checked', 'Night backup done'),
]

export function seed() {
  const { docs, obs } = seedDocs()
  const queue: QItem[] = [
    {
      id: 'Q-1', kind: 'unit', docId: SEN_DOC.id, pid: 'P-0702', ex: 'Tapan Sen · 66 · M', state: 'open',
      reason: 'The report says "66 mL/min". The unit has to be mL/min/1.73 m². We cannot compare it. Not saved.',
    },
  ]
  return { pts: PTS, docs: [...docs, SEN_DOC], obs, queue, vers: vers(), aud: aud(), ovr: { 'P-0417': 6 } as Record<string, number> }
}
