import type { Doc, Obs, Pt } from '../store/types'

// codes are drafts: check them on loinc.org before any real use
const CODE = {
  egfr: { loinc: '98979-8', name: 'eGFR CKD-EPI 2021', ucum: 'mL/min/{1.73_m2}' },
  uacr: { loinc: '9318-7', name: 'Albumin/Creatinine [Mass Ratio] in Urine', ucum: 'mg/g' },
  creat: { loinc: '2160-0', name: 'Creatinine [Mass/volume] in Serum or Plasma', ucum: 'mg/dL' },
}
const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
const labOf = (docs: Doc[], id: string) => docs.find((d) => d.id === id)?.lab ?? ''

export function toCsv(pt: Pt, obs: Obs[], docs: Doc[]) {
  const head = 'patient_id,date,code,name,value,unit,lab,source_doc,page,line'
  const rows = obs.map((o) => {
    const c = CODE[o.kind]
    return [pt.id, o.d, c.loinc, c.name, o.v, o.u, `Lab ${labOf(docs, o.source.docId)}`, o.source.docId, o.source.page, o.source.ln ?? ''].map(q).join(',')
  })
  return [head, ...rows].join('\n')
}

export function toFhir(pt: Pt, obs: Obs[], docs: Doc[]) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: obs.map((o) => {
      const c = CODE[o.kind]
      return {
        resource: {
          resourceType: 'Observation', id: o.id, status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: c.loinc, display: c.name }] },
          subject: { reference: `Patient/${pt.id}`, display: pt.name },
          effectiveDateTime: o.d,
          valueQuantity: { value: o.v, unit: o.u, system: 'http://unitsofmeasure.org', code: c.ucum },
          performer: [{ display: `Lab ${labOf(docs, o.source.docId)}` }],
          note: [{ text: `Source: ${o.source.docId}, page ${o.source.page}${o.source.ln ? `, line ${o.source.ln}` : ''}${o.source.asPrinted ? `, as printed: ${o.source.asPrinted.v} ${o.source.asPrinted.u}` : ''}` }],
        },
      }
    }),
  }
}

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
