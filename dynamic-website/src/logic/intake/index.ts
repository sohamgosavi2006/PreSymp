import type { Ingest } from './types'

export * from './types'
export { buildObs, checkRead, planFor, readingGate } from './ingest'

// the one door for every file: text PDFs are read with pdf.js, photos and scans with tesseract.js.
// both libraries load only when a file is dropped
export const ingest: Ingest = async (file, env) => {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
  const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
  if (isPdf) {
    const { ingestPdf } = await import('./ingestPdf')
    return ingestPdf(file, env)
  }
  if (isImage) {
    const { ingestOcr } = await import('../ocr')
    return ingestOcr(file, env)
  }
  const { unreadResult } = await import('./ingestPdf')
  return unreadResult(file, 'This file type is not supported. Add a PDF or a photo.')
}
