import { parseDate } from '../dates'
import { checkUnit, inRange, type Kind } from '../units'
import type { Box, Hit, Read } from '../../store/types'

// One parser reads text PDFs (pdf.js items) and photos (tesseract cells shaped as the same bits).
// A piece of text on a page, in page units (y grows downward, y is the baseline)
export type Bit = { str: string; x: number; y: number; w: number; h: number }
export type PageLine = { page: number; text: string; bbox: Box; bits: Bit[]; vw?: number; vh?: number }

const TOL = 3 // points; bits closer than this in y sit on the same line

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const topOf = (b: Bit) => b.y - b.h * 0.9
const botOf = (b: Bit) => b.y + b.h * 0.25

// the union of some bits, as a share of the page: x, y, width, height
function boxOf(bits: Bit[], vw: number, vh: number): Box {
  const x0 = Math.min(...bits.map((b) => b.x))
  const x1 = Math.max(...bits.map((b) => b.x + b.w))
  const top = Math.min(...bits.map(topOf))
  const bot = Math.max(...bits.map(botOf))
  return [clamp01(x0 / vw), clamp01(top / vh), clamp01((x1 - x0) / vw), clamp01((bot - top) / vh)]
}

// group bits into lines by y, then order each line by x
export function groupLines(bits: Bit[], page: number, vw: number, vh: number, tol = TOL): PageLine[] {
  const clean = bits.filter((b) => b.str.trim() !== '').sort((a, b) => a.y - b.y)
  const rows: Bit[][] = []
  for (const b of clean) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(b.y - row[0].y) <= tol) row.push(b)
    else rows.push([b])
  }
  return rows.map((row) => {
    const bits = row.sort((a, b) => a.x - b.x)
    return { page, bits, text: bits.map((b) => b.str.trim()).join('  '), bbox: boxOf(bits, vw, vh), vw, vh }
  })
}

// ---------- labels ----------

// "(CKD-EPI 2021)" or "· MDRD" printed right after the eGFR name belongs to the label, not to the result
const EQ_TAIL = String.raw`(?:\s*[·•,;:\-–]?\s*(?:CKD\s*-?\s*EPI|MDRD)(?:\s*(?:20\d\d|\([^)]*\)))?)?`
// "(mg/g)" after a name is kept: some labs print the unit there
const PAREN = String.raw`(?:\s*\((?<u>[^)]*)\))?`

const RX: Record<Kind, string> = {
  uacr:
    String.raw`(?:(?:micro\s*)?albumin\s*[/:]\s*creatinine(?:\s+ratio)?|albumin\s*-\s*creatinine\s+ratio|\bu\.?\s?acr\b|\bacr\b)` + PAREN,
  egfr:
    String.raw`(?:estimated\s+(?:glomerular\s+filtration\s+rate|gfr)|\be\s?gfr\b|\bgfr\s*,\s*estimated|\bgfr\b)` +
    PAREN + EQ_TAIL,
  creat: String.raw`creatinine(?:\s*,\s*(?:serum|blood|plasma|s)\b)?` + PAREN,
}

export type Lab = { kind: Kind; start: number; end: number; unit?: string }

// every test name in a line of text, in the order printed. the urine ratio is taken first, so its
// "creatinine" is never read as blood creatinine; urine creatinine is skipped
export function labelsIn(text: string): Lab[] {
  const out: Lab[] = []
  let masked = text
  for (const kind of ['uacr', 'egfr', 'creat'] as Kind[]) {
    for (const m of [...masked.matchAll(new RegExp(RX[kind], 'ig'))]) {
      const at = m.index ?? 0
      const end = at + m[0].length
      if (kind === 'creat') {
        const before = text.slice(Math.max(0, at - 14), at)
        const after = text.slice(end, end + 16)
        if (/(?:\burine|\balbumin|\bu\.?)\W*$/i.test(before) || /^\s*(?:ratio|clearance|clr)/i.test(after)) continue
      }
      const u = m.groups?.u?.trim()
      out.push({ kind, start: at, end, unit: u && /\//.test(u) ? u : undefined })
      masked = masked.slice(0, at) + ' '.repeat(end - at) + masked.slice(end)
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

export function labelOf(text: string): { kind: Kind; end: number } | undefined {
  const l = labelsIn(text)[0]
  return l && { kind: l.kind, end: l.end }
}

// "CKD-EPI 2021", "CKD-EPI", "MDRD" as printed
export function equationIn(text: string): string | undefined {
  const m = /\b(CKD\s*-?\s*EPI|MDRD)(?:(?:\s+(?:creatinine|equation|formula)){0,2}[\s(]*(20\d\d))?/i.exec(text)
  if (!m) return
  return /MDRD/i.test(m[1]) ? 'MDRD' : `CKD-EPI${m[2] ? ' ' + m[2] : ''}`
}

// ---------- number and unit ----------

const FLAG = /^(?:H|L|HH|LL|\*|high|low)$/i
const RANGE_TOK = /^[<>≥≤]?\s*\d[\d.]*(?:\s*[–-]\s*[\d.]+)?$/
const hasLetter = (s: string) => /[A-Za-zµμ%]/.test(s)
const unitLike = (s: string) => /\//.test(s) && hasLetter(s) && s.length <= 30

// does the next piece carry on the unit that has been read so far ("mL/min" then "/" then "1.73 m²")
function continues(prev: string, next: string) {
  if (/\/\s*$|\bper$/i.test(prev) || /^\//.test(next)) return true
  if (/^1\.73\b/.test(next) && /mL|min/i.test(prev)) return true
  return /^(?:m[²2]|m\^2|sq\.?\s*m)(?![A-Za-z0-9])/i.test(next) && /1\.73\s*$/.test(prev)
}

const cleanUnit = (u: string) =>
  u.replace(/\s*[\[{(].*$/, (m) => (/^\s*\{/.test(m) ? m : '')).replace(/\s+[<>≥≤]\s*\d.*$/, '').replace(/\s+\d+(?:\.\d+)?\s*[–-]\s*\d.*$/, '').trim()

// the unit tokens that follow a value. returns '' when there is none: a bracket starts a range
function takeUnit(parts: string[]): string {
  let skipped = false
  let i = 0
  for (; i < parts.length; i++) {
    const t = parts[i]
    if (FLAG.test(t) || RANGE_TOK.test(t)) { skipped = true; continue }
    break
  }
  const first = parts[i]
  if (!first || /^[\[(<>≥≤]/.test(first) || !hasLetter(first)) return ''
  if (skipped && !unitLike(first)) return ''
  let u = first
  for (let j = i + 1; j < parts.length && continues(u, parts[j]); j++) u += (u.endsWith('/') || parts[j].startsWith('/') ? '' : ' ') + parts[j]
  return cleanUnit(u)
}

// a number token: qualifier, number, rest of the token
const NUM = /^[\s):,]*([<>≥≤=]*)\s*(-?\d+(?:\.\d+)?)\s*(.*)$/

// every result in a line: the first number to the right of each test name, then the unit after it
export function readAll(line: PageLine): Hit[] {
  const labs = labelsIn(line.text)
  if (!labs.length) return []
  const off: { s: number; e: number; t: string }[] = []
  let pos = 0
  for (const b of line.bits) {
    const t = b.str.trim()
    off.push({ s: pos, e: pos + t.length, t })
    pos += t.length + 2 // the two-space join
  }
  const hits: Hit[] = []
  labs.forEach((lab, k) => {
    const limit = labs[k + 1]?.start ?? Infinity
    const at = off.findIndex((o) => lab.end <= o.e)
    if (at < 0) return
    const rest = off[at].t.slice(lab.end - off[at].s)
    const toks = [rest, ...off.slice(at + 1).filter((o) => o.s < limit).map((o) => o.t)]
    for (let i = 0; i < toks.length; i++) {
      const m = NUM.exec(toks[i])
      if (!m) continue
      // "<5", ">90" or a range are not a result we can store: never guess
      if (m[1] || /^[–-]\s*\d/.test(m[3])) return
      const after = [m[3], ...toks.slice(i + 1)].map((s) => s.trim()).filter(Boolean)
      let unit = takeUnit(after)
      if (!unit && lab.unit) unit = cleanUnit(lab.unit)
      // some labs print the unit first: [unit] [test] [result] [range]
      if (!unit && at > 0 && unitLike(off[at - 1].t)) unit = off[at - 1].t
      const eq = equationIn(line.text)
      hits.push({
        kind: lab.kind, v: Number(m[2]), printedUnit: unit, page: line.page, bbox: line.bbox, line: line.text,
        ...(eq && lab.kind === 'egfr' ? { equation: eq } : {}),
      })
      return
    }
  })
  return hits
}

export const readLine = (line: PageLine): Hit | undefined => readAll(line)[0]

// ---------- table rows whose cells wrap onto several lines ----------

const isNumBit = (s: string) => /^\s*[<>≥≤]?\s*-?\d+(?:\.\d+)?(?:\s*[A-Za-zµμ%/].*)?\s*$/.test(s)
// a result cell: a plain number that is not a limit or a range
const isResult = (s: string) => isNumBit(s) && !/^\s*[<>≥≤]/.test(s) && !/^\s*-?\d+(?:\.\d+)?\s*[–-]\s*\d/.test(s)

// Some labs wrap a test name over three or four lines, centre the result in the row and set the unit
// in its own wrapped cell. The three cells are found from where the result sits.
export function readCells(lines: PageLine[], want: Kind[] = ['egfr', 'uacr', 'creat']): Hit[] {
  const vw = lines[0]?.vw
  const vh = lines[0]?.vh
  if (!vw || !vh) return []
  const all = lines.flatMap((l, li) => l.bits.filter((b) => b.str.trim()).map((b) => ({ ...b, str: b.str.trim(), li })))
  type B = (typeof all)[number]
  const overlap = (a: B, b: B) => Math.min(botOf(a), botOf(b)) - Math.max(topOf(a), topOf(b)) > 0.5
  const hasNumRight = (f: B) => all.some((o) => o.li === f.li && o !== f && o.x >= f.x + f.w - 1 && isNumBit(o.str))
  const column = (x: number) => all.filter((b) => Math.abs(b.x - x) <= 2.5).sort((a, b) => a.y - b.y)
  const near = (a: B, b: B) => Math.abs(b.y - a.y) <= 1.7 * Math.max(a.h, b.h)

  const found: { hit: Hit; dist: number; key: string }[] = []
  for (const R of all) {
    if (!isResult(R.str)) continue
    const left = all.filter((b) => b !== R && b.x + b.w <= R.x + 1 && overlap(b, R) && hasLetter(b.str))
    if (!left.length) continue
    const anchor = left.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a))
    // the name: the cells in the anchor's column that touch the result, and the wrapped lines above and below
    const col = column(anchor.x)
    let lo = col.findIndex((b) => overlap(b, R))
    let hi = col.length - 1 - [...col].reverse().findIndex((b) => overlap(b, R))
    if (lo < 0) continue
    while (lo > 0 && near(col[lo - 1], col[lo]) && !hasNumRight(col[lo - 1])) lo--
    while (hi < col.length - 1 && near(col[hi], col[hi + 1]) && !hasNumRight(col[hi + 1])) hi++
    const stack = col.slice(lo, hi + 1)
    const name = stack.map((b) => b.str).join(' ')
    const lab = labelsIn(name).find((l) => want.includes(l.kind))
    if (!lab) continue
    const band: B[] = [...stack, R]
    const top = Math.min(...band.map(topOf))
    const bot = Math.max(...band.map(botOf))
    const inBand = (b: B) => b !== R && !stack.includes(b) && b.y - b.h * 0.35 >= top - 1 && b.y - b.h * 0.35 <= bot + 1

    // unit: after the result (own cell, possibly wrapped), else before the name, else in the name's brackets
    let unitBits: B[] = []
    let unit = ''
    const own = /^\s*[<>≥≤]?\s*-?\d+(?:\.\d+)?\s*(.*)$/.exec(R.str)?.[1]?.trim()
    if (own && hasLetter(own)) unit = cleanUnit(own)
    if (!unit) {
      const right = all.filter((b) => inBand(b) && b.x >= R.x + R.w - 1 && b.x - (R.x + R.w) <= vw * 0.12).sort((a, b) => a.x - b.x || a.y - b.y)
      const first = right.find((b) => !FLAG.test(b.str) && !RANGE_TOK.test(b.str))
      if (first && !/^[\[(<>≥≤]/.test(first.str) && hasLetter(first.str)) {
        const cell = right.filter((b) => Math.abs(b.x - first.x) <= 2.5).sort((a, b) => a.y - b.y)
        let t = cell.map((b) => b.str).join(' ')
        unitBits = cell
        const row = right.filter((b) => b.x > first.x + 2.5 && Math.abs(b.y - first.y) <= 3).sort((a, b) => a.x - b.x)
        for (const b of row) {
          if (!continues(t, b.str)) break
          t += (t.endsWith('/') || b.str.startsWith('/') ? '' : ' ') + b.str
          unitBits = [...unitBits, b]
        }
        if (right.indexOf(first) === 0 || unitLike(t)) unit = cleanUnit(t)
      }
    }
    if (!unit) {
      const before = all.filter((b) => inBand(b) && b.x + b.w <= stack[0].x + 1).sort((a, b) => b.x + b.w - (a.x + a.w))
      if (before[0]) {
        const cell = before.filter((b) => Math.abs(b.x - before[0].x) <= 2.5).sort((a, b) => a.y - b.y)
        const t = cell.map((b) => b.str).join(' ')
        if (unitLike(t)) { unit = t; unitBits = cell }
      }
    }
    if (!unit && lab.unit) unit = cleanUnit(lab.unit)

    const m = NUM.exec(R.str)!
    const eq = equationIn(name)
    const row = [...stack, R, ...unitBits]
    found.push({
      key: `${lab.kind}:${anchor.li}:${anchor.x}:${stack[0].y}`,
      dist: R.x - (anchor.x + anchor.w),
      hit: {
        kind: lab.kind, v: Number(m[2]), printedUnit: unit, page: lines[0].page, bbox: boxOf(row, vw, vh),
        line: [name, R.str, unit].filter(Boolean).join('  '),
        ...(eq && lab.kind === 'egfr' ? { equation: eq } : {}),
      },
    })
  }
  // one result per name: the nearest to its right; then top to bottom
  const best = new Map<string, (typeof found)[number]>()
  for (const f of found) {
    const cur = best.get(f.key)
    if (!cur || f.dist < cur.dist) best.set(f.key, f)
  }
  return [...best.values()].map((f) => f.hit).sort((a, b) => a.bbox[1] - b.bbox[1])
}

// ---------- header ----------

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONRX = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'

function iso(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCMonth() !== m - 1) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
const year = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s))

// the first date in a piece of text, in the forms Indian labs print. partial: day and month only
export function dateIn(s: string): { d?: string; partial?: boolean } {
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s)
  if (m) return { d: iso(Number(m[1]), Number(m[2]), Number(m[3])) }
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.,]*${MONRX}[\\s\\-/.,']*(\\d{4}|\\d{2})\\b`, 'i').exec(s)
  if (m) return { d: iso(year(m[3]), MON.indexOf(m[2].toLowerCase()) + 1, Number(m[1])) }
  m = new RegExp(`\\b${MONRX}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'i').exec(s)
  if (m) return { d: iso(Number(m[3]), MON.indexOf(m[1].toLowerCase()) + 1, Number(m[2])) }
  m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/.exec(s)
  if (m) return { d: iso(year(m[3]), Number(m[2]), Number(m[1])) }
  if (new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?[\\s\\-/.,]*${MONRX}\\s*$`, 'i').test(s.trim())) return { partial: true }
  const fallback = parseDate(s)
  return fallback ? { d: fallback } : {}
}

const DATE_LABEL: Record<'reported' | 'collected', RegExp> = {
  reported: /\b(?:date\s+of\s+report|date\s+reported|report(?:ed)?\s+(?:date|on)|reported|report\s+date)\b\s*[:\-]?/i,
  collected: /\b(?:date\s+of\s+collection|collection\s+date|(?:sample\s+)?collected(?:\s+on)?|sample\s+date)\b\s*[:\-]?/i,
}
const ANY_DATE_LABEL = /\b(?:collected|reported|received|registered|report\s+date|date\s+of)\b/i

const TITLE = /^(?:mr|mrs|ms|miss|mister|smt|shri|sri|dr|master|baby|kum|late)\.?\s+/i

function dateFor(lines: PageLine[], which: 'reported' | 'collected'): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const m = DATE_LABEL[which].exec(l.text)
    if (!m) continue
    let rest = l.text.slice(m.index + m[0].length)
    const cut = rest.search(ANY_DATE_LABEL)
    if (cut >= 0) rest = rest.slice(0, cut)
    const r = dateIn(rest)
    if (r.d) return r.d
    if (!r.partial) continue
    // the year wrapped onto a line below, under the same column
    const dayBit = l.bits.find((b) => /\d/.test(b.str) && l.text.indexOf(b.str.trim()) >= m.index + m[0].length - 1)
    if (!dayBit) continue
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const yb = lines[j].bits.find((b) => /^(?:19|20)\d\d$/.test(b.str.trim()) && Math.abs(b.x - dayBit.x) <= 6 && b.y - dayBit.y > 3 && b.y - dayBit.y < 40)
      if (!yb) continue
      const full = dateIn(`${rest.trim()} ${yb.str.trim()}`)
      if (full.d) return full.d
    }
  }
}

const ID_SKIP = /^(?:sample|lab|order|barcode|accession|bill|visit|report|doctor|dr|ref|invoice|case|specimen|test)$/i

function idIn(t: string): string | undefined {
  for (const m of t.matchAll(/(\b[A-Za-z]+\s+)?\b(UHID|MRN|PID|ID)\b\s*(?:No\.?|Number|#)?\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{1,18})/g)) {
    if (m[1] && ID_SKIP.test(m[1].trim())) continue
    if (!/\d/.test(m[3])) continue
    return m[3].toUpperCase()
  }
}

// header facts: lab, dates, patient name, age and sex, id
export function readHeader(lines: PageLine[]): Omit<Read, 'hits'> {
  const t = lines.map((l) => l.text).join('\n')
  const out: Omit<Read, 'hits'> = {}

  const letter = t.match(/\bLab\s+([A-Z])\b/)
  if (letter) out.lab = letter[1]
  else {
    const name = lines.slice(0, 8).find((l) => /\b(?:lab|laborator(?:y|ies)|diag\w*|pathology|clinic|hospital|healthcare|medicals?)\b/i.test(l.bits[0]?.str ?? ''))
    if (name) out.lab = norm(name.bits[0].str).slice(0, 60)
  }

  out.date = dateFor(lines, 'reported') ?? dateFor(lines, 'collected')

  const nm = t.match(/(?:^|\n|\s{2,})(?:Patient(?:'s)?\s+Name|Name\s+of\s+(?:the\s+)?Patient|Patient|Pt\.?\s*Name|Name)\s*[:\-]\s*(.+?)(?:\s{2,}|\n|$)/i)
  if (nm) {
    const n = norm(nm[1])
      .replace(TITLE, '')
      .replace(/\s*\(?\d{1,3}\s*(?:Y|Yrs?|Years?)?\s*[/,]?\s*(?:M|F|Male|Female)?\)?$/i, '')
      .trim()
    if (/[A-Za-z]{2}/.test(n) && !/^not\b/i.test(n)) out.name = n
  }

  // age and sex: "52 / F", "52Y/F", "52 Years Female", or Age and Sex on their own
  const as = t.match(/Age\s*\/\s*(?:Sex|Gender)\s*[:\-]\s*(.+?)(?:\s{2,}|\n|$)/i)?.[1]
  const ageOnly = t.match(/\bAge\s*[:\-]\s*(\d{1,3})\b/i)?.[1]
  const sexOnly = t.match(/\b(?:Sex|Gender)\s*[:\-]\s*(Male|Female|M|F)\b/i)?.[1]
  const esc = (out.name ?? '').replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
  const loose = out.name ? t.match(new RegExp(`${esc}\\s+\\(?(\\d{1,3})\\s*(?:Y|Yrs?|Years?)?\\s*[/,]?\\s*(Male|Female|M|F)\\)?\\b`, 'i')) : null
  const ageText = as ?? (loose ? `${loose[1]} ${loose[2]}` : '')
  const a = (as ?? '').match(/(\d{1,3})/)?.[1] ?? ageOnly ?? loose?.[1]
  if (a) out.age = Number(a)
  const sx =
    ageText.match(/\b(male|female)\b/i)?.[1] ?? ageText.match(/(?:\d|[\s/,])\s*(M|F)\b/)?.[1] ?? sexOnly
  if (sx) out.sex = sx[0].toUpperCase() as 'M' | 'F'
  if (!out.sex && !as) {
    const yf = t.match(/\b\d{1,3}\s*(?:Years?|Yrs?|Y)\s*\/?\s*(Male|Female)\b/i)
    if (yf) out.sex = yf[1][0].toUpperCase() as 'M' | 'F'
  }

  const id = idIn(t)
  if (id) out.id = id
  return out
}

// ---------- the whole report ----------

const goodHit = (h: Hit) => {
  if (!h.printedUnit) return false
  const r = checkUnit(h.kind, h.v, h.printedUnit)
  return r.res === 'refused' || inRange(h.kind, r.v)
}
const pick = (c: Hit[]) => c.find(goodHit) ?? c[0]

// the equation can be printed on a line next to the eGFR line
function nearEquation(h: Hit, lines: PageLine[]): string | undefined {
  const around = lines
    .filter((l) => Math.abs(l.bbox[1] - h.bbox[1]) <= 0.06 && !labelsIn(l.text).some((x) => x.kind !== 'egfr'))
    .sort((a, b) => Math.abs(a.bbox[1] - h.bbox[1]) - Math.abs(b.bbox[1] - h.bbox[1]))
  for (const l of around) {
    const e = equationIn(l.text)
    if (e) return e
  }
}

// header from page 1 (later pages fill what is missing), then the best hit for each test across the pages
export function readReport(pages: PageLine[][]): Read {
  const head: Omit<Read, 'hits'> = {}
  for (const lines of pages) {
    const h = readHeader(lines)
    for (const k of Object.keys(h) as (keyof typeof h)[]) if (head[k] === undefined && h[k] !== undefined) (head as Record<string, unknown>)[k] = h[k]
  }
  const cands: Record<Kind, Hit[]> = { egfr: [], uacr: [], creat: [] }
  for (const lines of pages) for (const l of lines) for (const h of readAll(l)) cands[h.kind].push(h)
  const want = (['egfr', 'uacr', 'creat'] as Kind[]).filter((k) => !cands[k].some(goodHit))
  if (want.length) for (const lines of pages) for (const h of readCells(lines, want)) cands[h.kind].push(h)
  const hits: Read['hits'] = {}
  for (const k of ['egfr', 'uacr', 'creat'] as Kind[]) {
    const h = pick(cands[k])
    if (!h) continue
    const lines = pages[h.page - 1] ?? []
    hits[k] = k === 'egfr' && !h.equation ? { ...h, equation: nearEquation(h, lines) } : h
    if (hits[k]!.equation === undefined) delete hits[k]!.equation
  }
  return { ...head, hits }
}
