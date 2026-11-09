// all date maths uses the fixed demo day, never the real clock
export const TODAY = '2025-12-18'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MS = 864e5

export const parts = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return { y, m, d: dd }
}
const utc = (d: string) => {
  const p = parts(d)
  return Date.UTC(p.y, p.m - 1, p.d)
}
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / MS)

// clamps the day to the month end, so 31 Aug + 6 months is 28 Feb
export function addMonths(d: string, n: number) {
  const p = parts(d)
  const t = p.m - 1 + n
  const y = p.y + Math.floor(t / 12)
  const m = ((t % 12) + 12) % 12
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return iso(y, m + 1, Math.min(p.d, last))
}

export function monthsBetween(a: string, b: string) {
  const x = parts(a)
  const y = parts(b)
  let n = (y.y - x.y) * 12 + (y.m - x.m)
  if (y.d < x.d) n--
  return n
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// under 7 days: days. under 8 weeks: weeks. otherwise whole months
export function sinceText(d: string, today = TODAY) {
  const n = daysBetween(d, today)
  if (n < 7) return plural(Math.max(n, 0), 'day')
  if (n < 56) return plural(Math.round(n / 7), 'week')
  return plural(monthsBetween(d, today), 'month')
}

export const fmt = (d: string) => {
  const p = parts(d)
  return `${p.d} ${MON[p.m - 1]} ${p.y}`
}
export const fmtMonth = (d: string) => {
  const p = parts(d)
  return `${MON[p.m - 1]} ${p.y}`
}
export const fmtShort = (d: string) => {
  const p = parts(d)
  return `${MON[p.m - 1]} '${String(p.y).slice(2)}`
}
export const yr2 = (d: string) => `'${d.slice(2, 4)}`
export const fmtDay = (d: string) => `${DAY[new Date(utc(d)).getUTCDay()]} ${fmt(d)}`

// "18 Dec 2025" -> "2025-12-18"; used when reading report dates
export function parseDate(s: string) {
  const m = s.match(/(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*[\s-,]+(\d{4})/)
  if (!m) return undefined
  const i = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase())
  return i < 0 ? undefined : iso(Number(m[3]), i + 1, Number(m[1]))
}

export const clock = (now = new Date()) =>
  `${fmtDay(TODAY)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
