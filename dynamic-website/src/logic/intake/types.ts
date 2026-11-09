import type { Cand, Doc, Obs, Pt, Read } from '../../store/types'

export const UNREAD = 'Could not read kidney results from this file'

// What happened to one file. The store turns this into saved results or a To check item.
//   clean      matched and unit checked: saved
//   ambiguous  not sure which patient: To check, candidates listed
//   check      the reading itself is not sure (low OCR confidence, no unit, out of range): To check
//   unit       unit refused (for example eGFR in mL/min): To check
//   unread     nothing could be read: To check, never guessed
//   dup        same patient, date and values already on file: nothing is added
export type IntakeResult = {
  how: 'clean' | 'ambiguous' | 'check' | 'unit' | 'unread' | 'dup'
  doc: Doc // carries the file, its text lines and (for OCR) the straightened page images
  read?: Read
  pid?: string
  cands?: Cand[]
  on: string // "ID", "full name, age and sex", ...
  conf: number // 0 to 1: how sure the match or the reading is
  hash: string
  reason?: string
  stages: string[] // the 5 stages, cut short where the file stopped
  last?: string // the person box at the end
  title: string
}

export type IntakeEnv = {
  pts: Pt[]
  known: string[] // ids of files already in the app
  obs: Obs[] // results already on file, for the duplicate guard
  onProgress?: (label: string, pct: number) => void
}

export type Ingest = (file: File, env: IntakeEnv) => Promise<IntakeResult>
