import type { Doc, Obs, Pt } from '../store/types'

// the made-up report text behind the seeded patients. same doc id always gives the same filler lines
export type RLine = { id: string; test: string; res: string; unit: string; ref: string }
export type Sec = { title: string; lines: RLine[] }
export type PageSec = { page: number; heading: string; lines: RLine[] }

// small seeded random so a report never changes between opens
function rng(seed: string) {
  let t = 2166136261
  for (const c of seed) t = Math.imul(t ^ c.charCodeAt(0), 16777619)
  return () => {
    t = Math.imul(t ^ (t >>> 15), 2246822507)
    t = Math.imul(t ^ (t >>> 13), 3266489909)
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296
  }
}

type Spec = [string, string, number, number, number, string, string] // id, test, mid, spread, digits, unit, ref
const fill = (r: () => number, [id, test, mid, spread, digits, unit, ref]: Spec): RLine => ({
  id, test, res: (mid + (r() - 0.5) * spread).toFixed(digits), unit, ref,
})
const fixed = (id: string, test: string, res: string, unit: string, ref: string): RLine => ({ id, test, res, unit, ref })

// the three numbers on a report: from the saved results if they exist, else what is printed on it
function numbers(d: Doc, obs: Obs[]) {
  const f = (k: string) => obs.find((o) => o.source.docId === d.id && o.kind === k)
  const e = f('egfr'), u = f('uacr'), c = f('creat')
  if (e && u && c) return { egfr: String(e.v), egfrU: e.u, uacr: u.v, uacrU: 'mg/g', creat: c.v }
  const pre = d.pre ?? { egfr: '90 mL/min/1.73 m²', uacr: 10, creat: 0.9 }
  const [a, ...rest] = pre.egfr.split(' ')
  return { egfr: a, egfrU: rest.join(' '), uacr: pre.uacr, uacrU: pre.uacrUnit ?? 'mg/g', creat: pre.creat }
}

export const accession = (d: Doc) => `${d.lab}-${Math.floor(rng(d.id + 'acc')() * 9e5 + 1e5)}`

function kidneySecs(d: Doc, n: { egfr: string; egfrU: string; uacr: number; uacrU: string; creat: number }): Sec[][] {
  const r = rng(d.id)
  const b = d.lab === 'B'
  const ucr = d.id === 'D-P-0417-20250918' ? 20 : Math.round(40 + r() * 80)
  const micro = ((n.uacr * ucr) / 100).toFixed(1)
  const all = (specs: Spec[]) => specs.map((s) => fill(r, s))
  const hae: Sec = {
    title: 'Haematology',
    lines: all([
      ['hb', 'Haemoglobin', 13.1, 2, 1, 'g/dL', '12.0–15.5'], ['tlc', 'Total leucocyte count', 7.2, 3, 1, '10³/µL', '4.0–11.0'],
      ['plt', 'Platelet count', 245, 90, 0, '10³/µL', '150–410'], ['pcv', 'Packed cell volume', 40, 6, 1, '%', '36–46'],
      ['mcv', 'Mean corpuscular volume', 88, 8, 1, 'fL', '80–100'], ['esr', 'ESR', 14, 10, 0, 'mm/h', '0–20'],
    ]),
  }
  const bio: Sec = {
    title: 'Biochemistry',
    lines: [
      fill(r, ['glu', 'Glucose, fasting', 112, 40, 0, 'mg/dL', '70–99']), fill(r, ['a1c', 'HbA1c', 7.1, 1.2, 1, '%', '4.0–5.6']),
      fill(r, ['urea', 'Urea', 28, 10, 0, 'mg/dL', '15–40']),
      fixed('creat', 'Creatinine (blood)', b ? String(Math.round(n.creat * 88.4)) : n.creat.toFixed(2), b ? 'µmol/L' : 'mg/dL', b ? '53–97' : '0.60–1.10'),
      fixed('egfr', 'Blood test (eGFR) · CKD-EPI 2021', n.egfr, n.egfrU, '≥90'),
      fill(r, ['ua', 'Uric acid', 5.2, 1.6, 1, 'mg/dL', '2.6–6.0']), fill(r, ['na', 'Sodium', 139, 4, 0, 'mmol/L', '135–145']),
      fill(r, ['k', 'Potassium', 4.3, 0.6, 1, 'mmol/L', '3.5–5.1']), fill(r, ['cl', 'Chloride', 103, 4, 0, 'mmol/L', '98–107']),
    ],
  }
  const lip: Sec = {
    title: 'Lipids',
    lines: all([
      ['tc', 'Total cholesterol', 182, 40, 0, 'mg/dL', '<200'], ['hdl', 'HDL cholesterol', 46, 12, 0, 'mg/dL', '>40'],
      ['ldl', 'LDL cholesterol', 104, 30, 0, 'mg/dL', '<100'], ['tg', 'Triglycerides', 148, 60, 0, 'mg/dL', '<150'],
      ['vldl', 'VLDL cholesterol', 29, 10, 0, 'mg/dL', '<30'],
    ]),
  }
  const liv: Sec = {
    title: 'Liver',
    lines: all([
      ['bil', 'Bilirubin, total', 0.7, 0.4, 1, 'mg/dL', '0.3–1.2'], ['ast', 'SGOT (AST)', 24, 10, 0, 'U/L', '5–40'],
      ['alt', 'SGPT (ALT)', 28, 12, 0, 'U/L', '5–45'], ['alp', 'Alkaline phosphatase', 88, 30, 0, 'U/L', '44–147'],
      ['tp', 'Total protein', 7.1, 0.8, 1, 'g/dL', '6.0–8.3'], ['alb', 'Albumin, serum', 4.2, 0.6, 1, 'g/dL', '3.5–5.2'],
    ]),
  }
  const uri: Sec = {
    title: 'Urine',
    lines: [
      fixed('col', 'Colour', 'Pale straw', '', ''),
      fill(r, ['ph', 'pH', 6, 1.2, 1, '', '5.0–8.0']), fill(r, ['sg', 'Specific gravity', 1.015, 0.012, 3, '', '1.005–1.030']),
      fixed('micro', 'Urine microalbumin', micro, 'mg/L', '<20'), fixed('uc', 'Urine creatinine', ucr.toFixed(1), 'mg/dL', '—'),
      fixed('acr', 'Albumin/Creatinine ratio', String(n.uacr), n.uacrU, '<30'),
    ],
  }
  const thy: Sec = {
    title: 'Thyroid, vitamins, minerals',
    lines: all([
      ['tsh', 'TSH', 2.4, 2, 2, 'µIU/mL', '0.40–4.50'], ['ft4', 'Free T4', 1.2, 0.4, 2, 'ng/dL', '0.80–1.80'],
      ['b12', 'Vitamin B12', 410, 200, 0, 'pg/mL', '200–900'], ['vd', '25-OH Vitamin D', 28, 14, 0, 'ng/mL', '30–100'],
      ['ca', 'Calcium', 9.4, 0.8, 1, 'mg/dL', '8.6–10.2'], ['ph2', 'Phosphorus', 3.6, 0.8, 1, 'mg/dL', '2.5–4.5'],
      ['mg', 'Magnesium', 2, 0.4, 1, 'mg/dL', '1.7–2.2'],
    ]),
  }
  return b ? [[bio, hae], [uri, lip, liv], [thy]] : [[hae, bio], [lip, liv, uri], [thy]]
}

export const noteLines = (d: Doc): RLine[] => [
  fixed('n1', 'Document', d.kind === 'fundus' ? 'Eye test (fundus examination, retina)' : 'Foot test report (monofilament, pedal pulses)', '', ''),
  fixed('n2', 'Examined on', d.d, '', ''),
  fixed('n3', 'Findings', "See the examiner's own note", '', ''),
  fixed('n4', 'Numbers read', 'None', '', ''),
]

// pages of sections for one seeded report
export function pagesOf(d: Doc, obs: Obs[]): Sec[][] {
  return kidneySecs(d, numbers(d, obs))
}

// one page with the blood and urine sections side by side, for the photo and scan samples
export const combinedPage = (d: Doc): Sec[] => {
  const p = pagesOf(d, [])
  return [p[0].find((s) => s.title === 'Biochemistry')!, p.flat().find((s) => s.title === 'Urine')!]
}

export function reportSections(d: Doc, obs: Obs[], _pts: Pt[]): PageSec[] {
  if (d.kind !== 'kidney') return [{ page: 1, heading: d.kind === 'fundus' ? 'Eye test' : 'Foot test', lines: noteLines(d) }]
  return pagesOf(d, obs).flatMap((secs, i) => secs.map((s) => ({ page: i + 1, heading: s.title, lines: s.lines })))
}
