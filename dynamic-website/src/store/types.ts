import type { Kind } from '../logic/units'

export type Pt = {
  id: string; name: string; short: string; age: number; sex: 'F' | 'M'; lang: 'en' | 'hi' | 'bn'; phone: string
  token: number // clinic token number for the day, 1 = first
}

// x, y, width, height, each a share of the page (0 to 1)
export type Box = [number, number, number, number]

export type TextLine = { text: string; bbox: Box }
export type PageText = { page: number; lines: TextLine[] }

export type Doc = {
  id: string; pid: string; kind: 'kidney' | 'fundus' | 'foot'; lab: 'A' | 'B'; d: string
  who: string; ageSex?: string; pages: number; scan?: boolean; isNew?: boolean
  // numbers printed on a seeded report that is not filed yet
  pre?: { egfr: string; uacr: number; creat: number; uacrUnit?: string }
  // a file the user added. it lives in memory only
  name?: string
  mime?: string
  file?: Blob
  views?: Blob[] // OCR files: the straightened page images the boxes refer to (one per page)
  text?: PageText[] // every line read from the file, for the viewer and for Find in reports
  printedId?: string
}

// where a number came from. bbox is on page `page`; seeded reports find the line by `ln` instead
export type Source = {
  docId: string; page: number; bbox: Box
  via: 'text' | 'ocr' | 'seed'
  ln?: string
  conf?: number // 0 to 1, for OCR
  asPrinted?: { v: number; u: string } // set when a unit was converted
  equation?: string // "CKD-EPI 2021", "MDRD"
}

export type Obs = { id: string; pid: string; kind: Kind; v: number; u: string; d: string; source: Source }

export type Cfg = { panel: number; rptMin: number; rptMax: number; egfr2: number; fundus: number; foot: number }
export type Ver = { n: number; cfg: Cfg; by: string; at: string; reason: string }
export type Role = 'front' | 'doc'

export type Rem = { st: 'sent'; via: string; time: string; text: string; heard: boolean } | { st: 'skipped'; reason: string }

export type Undo =
  | { t: 'rem'; key: string; prev?: Rem }
  | { t: 'queue'; qid: string; obsIds: string[]; docIds: string[] }
  | { t: 'ver'; to: number }
  | { t: 'mark'; key: string; prev?: string }
export type Aud = { id: string; when: string; who: string; role: string; act: string; det: string; undo?: Undo; undone?: boolean }

export type Cand = { pid: string; conf: number; why?: string }

// one number read from a file
export type Hit = {
  kind: Kind; v: number; printedUnit: string; page: number; bbox: Box; line: string
  conf?: number // OCR: mean confidence of the value word and its unit word, 0 to 1
  equation?: string
}
export type Read = {
  hits: Partial<Record<Kind, Hit>>
  name?: string; age?: number; sex?: 'F' | 'M'; id?: string; date?: string; lab?: string
}

export type QItem = {
  id: string; kind: 'match' | 'unit' | 'unread' | 'check'; docId: string; pid?: string; ex: string
  state: 'open' | 'done'; note?: string; reason?: string; cands?: Cand[]
  read?: Read // what was read from an uploaded file, so a person can confirm it
}

export type Viewer = { docId: string; pg: number; ln?: string; obsId?: string; box?: Box }
