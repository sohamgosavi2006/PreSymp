import { forwardRef } from 'react'
import type { ItemKey } from '../../logic/due'
import { PHRASE_KEY } from '../../logic/due'
import { dateIn, CARD, CHECK, CLINIC, CLINIC_PHONE, type Lang } from '../../logic/phrases'

export type CardRow = { k: ItemKey; when: string }
export type CardData = {
  lang: Lang
  name: string
  pid: string
  done: CardRow[]
  next: CardRow[]
  appt: string
  note: string
  // null: the doctor has not asked for results. an object with no visit: nothing on file
  results: null | { d: string; egfr: number; uacr: number } | { none: true }
}

// the A5 card itself. it is the only thing that prints and the only thing saved as an image.
// every word is from the fixed phrase bank; the doctor's note is the one exception and is shown as typed
export const CardSheet = forwardRef<HTMLElement, { data: CardData }>(function CardSheet({ data }, ref) {
  const { lang, done, next, appt, note, results } = data
  const name = (k: ItemKey) => CHECK[PHRASE_KEY[k]][lang]
  const rows = (list: CardRow[]) =>
    list.length ? (
      <ul>{list.map((r) => <li key={r.k}><span>{name(r.k)}</span><span className="when">{dateIn(lang, r.when)}</span></li>)}</ul>
    ) : (
      <p className="none">{CARD.none[lang]}</p>
    )
  return (
    <article ref={ref} className="fcard fsheet" lang={lang} aria-label={CARD.title[lang]} data-testid="card">
      <header>
        <p className="clinic">{CLINIC}</p>
        <p className="small">{CARD.phone[lang]}: {CLINIC_PHONE}</p>
      </header>
      <h2 className="ctitle">{CARD.title[lang]}</h2>
      <p className="who"><b>{CARD.patient[lang]}:</b> {data.name} <span className="sep">·</span> {CARD.id[lang]} {data.pid}</p>

      <h3>{CARD.done[lang]}</h3>
      {rows(done)}

      <h3>{CARD.next[lang]}</h3>
      {rows(next)}

      {appt && (<><h3>{CARD.appt[lang]}</h3><p className="appt">{dateIn(lang, appt)}</p></>)}

      {results && (
        <>
          <h3>{CARD.last[lang]}</h3>
          {'none' in results ? (
            <p className="none">{CARD.none[lang]}</p>
          ) : (
            <ul>
              <li><span>{CARD.date[lang]}</span><span className="when">{dateIn(lang, results.d)}</span></li>
              <li><span>eGFR</span><span className="when">{results.egfr} mL/min/1.73 m²</span></li>
              <li><span>UACR</span><span className="when">{results.uacr} mg/g</span></li>
            </ul>
          )}
        </>
      )}

      {note.trim() && (
        <>
          <h3>{CARD.note[lang]}</h3>
          <p className="note" lang="">{note}</p>
        </>
      )}

      <p className="foot">{CARD.call[lang]}</p>
    </article>
  )
})
