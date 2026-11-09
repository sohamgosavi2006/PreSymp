import { TODAY } from '../dates'
import { hashOf, extractPages, openPdf } from './pdfLoad'
import { planFor } from './ingest'
import { readReport } from './readPdf'
import { UNREAD, type IntakeEnv, type IntakeResult } from './types'

export async function unreadResult(file: File, reason: string): Promise<IntakeResult> {
  const hash = await hashOf(file)
  return {
    how: 'unread', on: '', conf: 0, hash, reason, title: file.name, last: 'Staff check it',
    stages: ['Report came in', 'Report read', 'Could not read the numbers'],
    doc: {
      id: `D-UP-${hash}`, pid: '', kind: 'kidney', lab: 'A', d: TODAY, who: 'Name not printed', ageSex: 'not printed',
      pages: 1, isNew: true, name: file.name, mime: file.type, file, text: [],
    },
  }
}

// fewer characters than this is a stamp or a page number, not a report: the pages are pictures
const MIN_TEXT = 30

// a PDF with a text layer. an image-only PDF has no text, so it is handed to the photo reader
export async function ingestPdf(file: File, env: IntakeEnv): Promise<IntakeResult> {
  const hash = await hashOf(file)
  const id = `D-UP-${hash}`
  if (env.known.includes(id)) return { ...(await unreadResult(file, 'This report is already in the app.')), how: 'dup' }
  try {
    env.onProgress?.('Reading the file…', 20)
    const doc = await openPdf(id, file)
    env.onProgress?.('Reading the text…', 45)
    const pages = await extractPages(doc)
    const chars = pages.flat().reduce((n, l) => n + l.text.length, 0)
    if (chars < MIN_TEXT) {
      const { ingestOcr } = await import('../ocr')
      return ingestOcr(file, env)
    }
    env.onProgress?.('Checking the numbers…', 80)
    const text = pages.map((lines, i) => ({ page: i + 1, lines: lines.map((l) => ({ text: l.text, bbox: l.bbox })) }))
    return planFor(
      readReport(pages), { id, name: file.name, mime: 'application/pdf', file, pages: doc.numPages, hash, text },
      env.pts, env.known, env.obs,
    )
  } catch {
    return unreadResult(file, UNREAD)
  }
}
