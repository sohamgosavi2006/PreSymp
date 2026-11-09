import { ReportPage } from '../components/SourceViewer/ReportPage'
import { combinedPage } from '../logic/reportLines'
import { useStore } from '../store/store'
import type { Doc } from '../store/types'

// the made-up lab reports behind public/samples. scripts/make-samples.mjs prints this page to PDF and photographs it.
// only used to make samples; nothing in the app links here
type Sample = { doc: Doc; one?: boolean }
const base = { kind: 'kidney' as const, d: '2025-12-18' }

export const SAMPLE_DOCS: Record<string, Sample> = {
  kabita: { doc: { ...base, id: 'S1', pid: 'P-0533', lab: 'A', who: 'Kabita Banerjee', pages: 3, pre: { egfr: '95 mL/min/1.73 m²', uacr: 9, creat: 0.75 } } },
  das: { doc: { ...base, id: 'S2', pid: '', lab: 'A', who: 'R. Das', ageSex: 'not printed', pages: 3, pre: { egfr: '71 mL/min/1.73 m²', uacr: 78, creat: 1.1 } } },
  roy: { doc: { ...base, id: 'S3', pid: 'P-0061', lab: 'B', who: 'Mohan Roy', pages: 3, pre: { egfr: '55 mL/min', uacr: 24, creat: 1.2 } } },
  khan: { one: true, doc: { ...base, id: 'S4', pid: 'P-0932', lab: 'A', who: 'Arif Khan', pages: 1, pre: { egfr: '93 mL/min/1.73 m²', uacr: 1.4, uacrUnit: 'mg/mmol', creat: 0.92 } } },
  ghosh: { one: true, doc: { ...base, id: 'S5', pid: 'P-0814', lab: 'A', who: 'Nandini Ghosh', pages: 1, pre: { egfr: '87 mL/min/1.73 m²', uacr: 12, creat: 0.83 } } },
}

export function SampleSheet({ id }: { id: string }) {
  const pts = useStore((s) => s.pts)
  const s = SAMPLE_DOCS[id]
  if (!s) return <p>No such sample.</p>
  return (
    <div className="sheet" data-testid="sample-sheet">
      {s.one
        ? <ReportPage doc={s.doc} pg={1} obs={[]} pts={pts} secs={combinedPage(s.doc)} />
        : [1, 2, 3].map((n) => <ReportPage key={n} doc={s.doc} pg={n} obs={[]} pts={pts} />)}
    </div>
  )
}
