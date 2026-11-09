# PreSymp Kidney Map: interactive prototype spec

Read this whole file before writing code. It is the single source of truth for the prototype. If the chat prompt and this file disagree, this file wins.

---

## 0. What you are building, and why

A **hardcoded, clickable, front-end-only prototype** of PreSymp Kidney Map, for a healthathon jury. It has to *feel* like the real product while demonstrating every ability in one sitting, in about 90 seconds of screen recording or a few minutes of free exploration.

**The product in one sentence.** An offline record and follow-up assistant for diabetes clinics in India, focused on diabetic kidney disease. It reads lab reports, puts every eGFR and urine-albumin (UACR) result a patient has ever had on one page, plots them on the published KDIGO grid for the doctor to read, links every number back to the exact line of the source report, and makes sure repeat and yearly tests aren't forgotten.

**The rule that overrides everything.** The competition bans clinical AI that diagnoses, recommends treatment, gives decision support, scores risk, interprets medical data, or advises autonomously. **This prototype must make it obvious that the software assembles, displays and schedules, and never judges.** When a design choice is ambiguous, pick the one that judges less. See section 3 (scope guardrails). They are enforced by an automated check.

**What this prototype is, honestly.** It previews features, some of which are new for the hackathon (click-to-source, due list, reminders, OCR). Everything is synthetic and hardcoded. Nothing is uploaded, parsed, sent or stored. The UI says so (section 12).

**Success looks like:** a judge opens the link, understands in 10 seconds what the product is, clicks one number and sees the original report open with that line highlighted, approves one reminder, and leaves convinced nothing on screen is invented or judged.

---

## 1. Tech and constraints

| Thing | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript (strict) |
| Routing | Hash routing (`#/day`, `#/patient/P-0417`, ...) so it works on any static host |
| State | One small store (Zustand or `useReducer` + context), in memory only. No `localStorage`. A `?reset` URL param and a "Reset demo" button restore the seed. |
| Styling | Plain CSS with CSS variables (tokens in section 2). No Tailwind, no UI kit. |
| Charts | Hand-written inline SVG. No chart library. |
| Fonts | `@fontsource/source-serif-4` and `@fontsource/inter`, imported locally so the demo works offline |
| Backend | **None.** No network calls at runtime, no analytics, no external fonts or CDNs. |
| Tests | Vitest for the pure logic (section 6). Playwright optional for one smoke test. |
| Target | Laptop, 1440×900 first. Must hold at 1280×720. Mobile is out of scope. |
| Deploy | `npm run build` produces a static `dist/`. Include a short README for Vercel, Netlify and GitHub Pages (set `base: './'`). |

**Code style (important).** Write it like a person would, not like a framework tutorial:

- Short, readable names: `pt`, `obs`, `doc`, `cfg`, `nxt`, `idx`, `ts`. Avoid long descriptive identifiers in small scopes.
- Short natural comments that say *why*, in plain words. No banner comments, no JSDoc essays.
- Small files, small functions. No abstract factories, no generic "BaseX" classes, no premature config systems.
- Keep logic out of components. Components render; `src/logic/*` computes.

---

## 2. Visual design system (match the pitch deck exactly)

The look is a calm instrument panel, not a startup landing page. Lots of white space, flat shapes, thin rules.

**Colour tokens** (define as CSS variables in `:root`):

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FAFAF7` | page background (warm off-white) |
| `--ink` | `#1A1A1A` | headlines, key numbers, borders |
| `--body` | `#3D3D3D` | body text |
| `--muted` | `#7A7A7A` | captions, labels |
| `--rule` | `#D9D9D4` | hairlines, grid lines |
| `--panel` | `#F0F0EB` | card and panel fills |
| `--accent` | `#1F5560` | **only** for (a) human-checkpoint UI and (b) the source highlight |
| `--accent-tint` | `#E3EEF0` | fill behind the source highlight only |

**Hard colour bans.** No red, amber, yellow, orange or green anywhere: not in CSS, not in SVG, not in emoji, not in icons. Those read as risk colours. No gradients, glows, 3D, stock photos, or robot/brain/sparkle "AI" icons.

**Type.**

- Headlines and big numbers: Source Serif 4. Page titles 32–40px; section titles 20–24px.
- Everything else: Inter. Body 14–16px; labels 11–12px, uppercase, letter-spacing 0.08em, `--muted`.
- Never smaller than 11px.

**"A person decides here" component** (`<Human>`): a rounded box with a 2px `--accent` border and a small circle-and-shoulders line glyph in `--accent` at the top-left. Use it *only* where a person decides: confirming a match, approving a reminder, the doctor's protocol edit, the doctor reading the chart. Nowhere else may use the accent border.

**Status without colour.** "Due", "overdue", "on file", "new", "pending" are shown with text plus shape, never a traffic-light colour:

- `on file`: plain text with a small hollow circle
- `due`: bold text with a solid dot
- `overdue`: bold text with an outlined pill (ink border)
- `new`: a small filled ink square

**Motion.** Restrained: 150–200ms ease-out for panel slides, tooltips and the source-highlight pulse (one pulse, then static). Respect `prefers-reduced-motion` (no motion, instant).

**App chrome.**

- **Top bar** (dark ink, 44px): "PreSymp | Kidney Map" at left, then a search box (patient name, ID or phone; search across the hardcoded patients works). At right: nav links `Day list · Due list · Review queue (n) · Audit log · Settings` (n is live; the seed value is 1), then the **role switch** (see section 7).
- **Status bar** (bottom, 28px, `--muted`): `Offline · data stays on this PC · last backup 02:00 today ✓ · scope mode: triage off · v0.1.0-prototype`.
- **Persistent ribbon** across the top of the viewport (thin, `--panel`): `Interactive prototype · synthetic data only · nothing is uploaded or sent`. See section 12.

---

## 3. Scope guardrails (enforced, not just advised)

### 3.1 Never put these on screen or in code strings

The prototype must not contain any of: `risk`, `high-risk`, `alert`, `warning`, `critical`, `predict`, `prognosis`, `score`, `probability`, `trend`, `worsening`, `improving`, `declining`, `progress` (as in progression), `decline`, `deteriorat`, `abnormal`, `normal` (as a verdict on a result), `healthy`, `diagnos`, `recommend`, `suggest`, `advise`, `should`, `AI`, `smart`, `insight`.

**Allowed exceptions:** the scope slide copy in section 10 (it names the excluded items in the negative, e.g. "No diagnosis. No score. No advice.") and the word "reference" for lab-printed ranges. Put those exceptions in an allow-list file `scope-allow.json` mapping file path to allowed phrases.

**Neutral vocabulary to use instead:** "on file", "due", "overdue", "reading", "result", "result on file", "since", "pending repeat", "doctor reviews both", "as printed by the lab".

### 3.2 Automated check

Write `scripts/scope-check.mjs`:

- Scans `src/**/*.{ts,tsx,css}` and `index.html`.
- Fails (exit 1) on any banned word from 3.1 (case-insensitive, whole-word or stem as listed) outside the allow-list.
- Fails on any of these colour patterns in CSS/TSX/SVG: `red`, `orange`, `amber`, `yellow`, `green`, `lime`, `crimson`, `tomato`, and any hex whose dominant channel makes it clearly red/orange/yellow/green. Keep it simple: whitelist the exact hexes in section 2 plus greys derived from them, and fail on any other hex.
- Wire it up as `npm run check:scope`. Run it in `npm run build` (prebuild) and in your own verification after every phase.

### 3.3 Things the software never does

- No score, badge, tier, or colour attached to a patient or a result.
- No slope, no trend arrow, no "improving/worsening" wording, no projections. The Kidney Map plots measured points only.
- No flags on values. Show the lab's own printed reference interval as plain text next to a value, nothing more.
- No alerts or pop-ups telling anyone what to do clinically. The only prompts are scheduling prompts ("Repeat UACR due since 3 weeks").
- Reminders contain **no health content** beyond the name of the check that's due (section 8.5).

---

## 4. Demo world: the hardcoded data

**"Today" is fixed: Thursday, 18 December 2025.** All date arithmetic uses this, never the real clock. Show it in the status area as `Demo date: Thu 18 Dec 2025`.

**Clinic:** "Demo Diabetes Clinic, Kolkata" (fictional). Labs: "Lab A" and "Lab B" (fictional, generic names; no real brands). Staff: front desk **K.** (Kaberi); doctor **Dr. M.** (Dr. Mukherjee). All patients, phone numbers (masked like `+91 98xxx xx210`), and values are synthetic.

### 4.1 Patients

| ID | Name | Age/Sex | Language | Story it shows |
|---|---|---|---|---|
| P-0417 | Sunita Devi | 58 F | Bengali | **Hero patient.** Full 7-reading history, click-to-source, fundus overdue |
| P-0288 | Ramesh Das | 63 M | Bengali | One UACR ≥30 on file, repeat due (3 weeks past the 3-month mark) |
| P-0932 | Arif Khan | 47 M | Hindi | Yearly kidney panel overdue by 5 months |
| P-0061 | Mohan Roy | 71 M | English | First eGFR <60 on file, second reading due (1 week past 3 months) |
| P-0533 | Kabita Banerjee | 52 F | Bengali | Everything current: the quiet row, nothing due |
| P-0814 | Nandini Ghosh | 44 F | English | New report arrived today (day-list "new" marker) |
| P-0299 | Rina Das | 55 F | Bengali | Same surname as Ramesh, to make patient matching genuinely ambiguous |
| P-0702 | Tapan Sen | 66 M | Hindi | Has a report waiting in the review queue (unit refused, see 5.5) |

Display names as initial + surname in dense lists (`S. Devi`) and full name in the patient ribbon.

### 4.2 Observations (the only clinical numbers in the prototype)

Each reading is a **pair** (eGFR + UACR drawn from the same panel) plus a creatinine value (for the "Show creatinine" toggle). eGFR unit `mL/min/1.73 m²` (CKD-EPI 2021, as reported by the lab), UACR unit `mg/g`, creatinine `mg/dL`.

**P-0417 Sunita Devi** (hero; use exactly these):

| Date | eGFR | UACR | Creat | Lab | Native |
|---|---|---|---|---|---|
| 12 Oct 2021 | 77 | 9.6 | 0.84 | A | text |
| 20 Jan 2022 | 74 | 12 | 0.88 | A | text |
| 14 Feb 2023 | 70 | 15 | 0.92 | A | text |
| 22 Mar 2024 | 68 | 18 | 0.95 | B | text |
| 18 Oct 2024 | 61 | 140 | 1.04 | B | scan (OCR) |
| 20 Jun 2025 | 52 | 210 | 1.19 | A | text |
| 18 Sep 2025 | 54 | 190 | 1.15 | A | text |

Other documents for Devi: fundus report 18 Oct 2024 (Lab B / ophthalmology, no values transcribed); foot examination record 15 Jan 2025.

**P-0288 Ramesh Das:** 14 Aug 2023: eGFR 78 / UACR 14. 16 Aug 2024: 75 / 22. 28 Aug 2025: 72 / 85 (Lab A). Creatinine 0.98, 1.02, 1.08.

**P-0932 Arif Khan:** 18 Jul 2022: 97 / 9. 20 Jul 2023: 94 / 10. 18 Jul 2024: 95 / 12 (all Lab B). Creatinine 0.90, 0.93, 0.92. Foot exam 10 Mar 2025. Fundus 04 Feb 2025.

**P-0061 Mohan Roy:** 12 Mar 2025: 64 / 18. 19 Jun 2025: 61 / 21. 11 Sep 2025: 57 / 25 (all Lab A). Creatinine 1.12, 1.16, 1.22. Fundus 22 Jan 2025. Foot 30 May 2025.

**P-0533 Kabita Banerjee:** 05 Jun 2024: 99 / 8. 09 Dec 2024: 97 / 9. 03 Jun 2025: 98 / 7. 02 Dec 2025: 96 / 8 (Lab B). Creatinine 0.71 to 0.74. Fundus 11 Jun 2025. Foot 11 Jun 2025.

**P-0814 Nandini Ghosh:** 09 Dec 2024: 88 / 11. 17 Dec 2025: 86 / 13 (Lab A; **uploaded today**, shows the "new" marker). Creatinine 0.82, 0.84.

**P-0299 Rina Das:** 03 Oct 2024: 82 / 16. 10 Oct 2025: 80 / 18 (Lab B). Creatinine 0.80, 0.83.

**P-0702 Tapan Sen:** 07 May 2025: 70 / 24. 12 Nov 2025: 68 / 26 (Lab A). Creatinine 1.05, 1.08.

### 4.3 Follow-up protocol (clinic defaults)

| Item | Default | Notes |
|---|---|---|
| Kidney panel (eGFR + UACR) | every **12** months | clinician can override per patient |
| Repeat UACR after a result ≥30 | due **3** months after, window closes at **6** months | "doctor reviews both" once on file |
| Second eGFR after first <60 | due **3** months after | "doctor reviews both" once on file |
| Fundus (eye) examination | every **12** months | document-only; no values |
| Foot examination | every **12** months | document-only; no values |

**Per-patient override:** Devi's kidney panel is every **6** months (doctor-set). Show it in her follow-up panel as `6 months · set by Dr. M.`.

**Which follow-up items exist.** The kidney-panel, UACR-repeat and second-eGFR items come from the readings. A fundus or foot item exists only for a patient who has at least one such document on file; otherwise it isn't tracked and isn't shown. With the seed, exactly four items are due or overdue today: Devi's fundus, Das's UACR repeat, Khan's kidney panel and Roy's second eGFR.

### 4.4 Check the numbers against these expected results (unit-test them)

With today = 18 Dec 2025:

| Patient | Item | Expected display |
|---|---|---|
| Devi | Kidney panel | on file, next due **Mar 2026** (18 Sep 2025 + 6 mo) |
| Devi | UACR repeat | "on file, Sep 2025" (two results ≥30 within 6 months: Jun and Sep 2025) |
| Devi | Fundus | **2 months overdue** (due 18 Oct 2025); ribbon says "14 months since last" |
| Devi | Foot | due **Jan 2026** (15 Jan 2025 + 12 mo) |
| Das | UACR repeat | **due since 3 weeks** (28 Aug + 3 mo = 28 Nov) |
| Khan | Kidney panel | **5 months overdue** (due 18 Jul 2025) |
| Roy | Second eGFR | **due since 1 week** (11 Sep + 3 mo = 11 Dec) |
| Banerjee | all | nothing due |

**Due-since wording:** under 7 days → "N days"; under 8 weeks → "N weeks"; otherwise whole calendar months. Always a plain count, never "late".

### 4.5 Source reports (what click-to-source opens)

For every observation, generate (or hand-write) a **lab report document**: a paper-like HTML page, 2–3 pages, 40+ result lines in small print so the highlight is genuinely useful. Contents:

- **Lab A layout:** header block ("Lab A · Synthetic Diagnostics Pvt Ltd" in a fictional letterhead, address, accession no., collected/reported dates, patient name, age/sex, ID). Sections: Haematology, Biochemistry (glucose, HbA1c, urea, **creatinine**, **eGFR**), Lipids, Liver, Urine (**microalbumin, urine creatinine, albumin/creatinine ratio**). Columns: Test, Result, Unit, Reference interval.
- **Lab B layout:** a different look (two-column, units column first, reference intervals in brackets, creatinine in `µmol/L` which the app converts with the original kept visible, see 8.4).
- **Scanned variant** (Devi, Oct 2024): the same page rendered as a slightly skewed (0.4°), grainy, greyscale "scan" with CSS filters. Over it, thin bounding boxes around each word the "OCR" read, and on hover a small tooltip `OCR read "190" · confidence 96%`. Only the value the user clicked is drawn with the accent highlight; other boxes are `--rule` hairlines.
- The line the user clicked gets: `--accent-tint` fill, `--accent` 2px outline, and one pulse.
- Fill other lines with plausible but obviously fictional values. **Do not label any value high/low and do not print flags.** Print the lab's reference interval as plain text only.

Data shape (keep it small):

```ts
type Obs = { id: string; pid: string; kind: 'egfr'|'uacr'|'creat'; v: number; u: string;
             d: string /* ISO */; doc: string; pg: number; ln: string;
             via: 'text'|'ocr'; conf?: number };
```

Each `Obs` knows which `doc`, `pg`, `ln` it came from. Click-to-source scrolls that page to that line.

---

## 5. The screens

Hash routes: `#/day` (landing), `#/due`, `#/queue`, `#/patient/:id`, `#/audit`, `#/settings`.

### 5.1 Day list (landing)

A morning list. **Sorting is by date facts only, never by severity:** patients with a report that arrived today first, then by longest-due, then the rest alphabetically.

Each row shows exactly three facts: **what's new** ("New report today" or nothing), **what's due** (the single most-overdue item with its "since" text, or "Nothing due"), and **what's on file** ("7 kidney panels · Oct 2021 to Sep 2025"). Click the row to open the patient. Banerjee's row reads "Nothing due. All current." and is styled as a quiet, complete state, not an empty one. Add a short line at top: `Thursday 18 Dec 2025 · 8 patients · 4 items due · 1 new report · 1 in review queue`.

### 5.2 Patient screen (the centrepiece)

Three zones, laid out as in the deck wireframe:

**Ribbon** (full width, outlined box): name, age/sex, ID; `7 kidney panels on file · Oct 2021 to Sep 2025`; `Last eGFR + UACR: 3 months ago`; `Repeat UACR: on file`; `Fundus: 14 months since last`. No chips with colour.

**Left panel: KIDNEY MAP.** Title: `KIDNEY MAP · eGFR against UACR on the KDIGO 2024 grid`.

- 6 rows × 3 columns. Rows (top to bottom): `G1 ≥90`, `G2 60–89`, `G3a 45–59`, `G3b 30–44`, `G4 15–29`, `G5 <15`. Columns: `A1 <30`, `A2 30–300`, `A3 >300`. Axis titles: "eGFR (mL/min/1.73 m²)" rotated on the left; "UACR (mg/g), log scale within each column" below.
- **All cells unshaded**, plain `--paper` with `--rule` lines. This is deliberate. Caption under it: *Cells are deliberately unshaded. The grid is the guideline's; the reading is the doctor's.*
- **Points:** one dot per paired reading, placed by the math in section 6.2. Older points are hollow and lighter; the **latest is solid ink** and labelled `Sep '25 (latest)`. Connect them in date order with a thin line that darkens toward the latest. Label first and a couple of intermediate points with the year (`'21`, `'24`) as in the deck. Avoid label collisions (nudge with a small offset algorithm).
- **Hover** a point: tooltip `20 Jun 2025 · eGFR 52 · UACR 210 · Lab A`. **Click** a point: selects its table row and opens the source viewer (5.3).
- **Date scrub (optional but nice):** a small control under the grid, `Show readings up to: [dropdown of dates]`, that hides later points. Pure display filter. No animation of "progression", no play button.
- **Show/hide the grid cell labels** toggle is not needed. Keep it simple.

**Right panel: READINGS AS PRINTED BY THE LAB.** Table: `Date · eGFR · UACR · Lab · Ref.` (Ref shows the lab-printed interval like `<30` as plain text), newest first.

- **Every value is a link.** Hover shows an underline and a `↗ source` cue; click opens the source viewer scrolled and highlighted (5.3). Focus-visible and keyboard (Enter) work.
- Buttons under it: `Open PDF` (opens the viewer at page 1 of the latest report), `Show creatinine` (adds a creatinine column), `Export (FHIR / CSV)` (section 8.7).
- Units caption: `Units: eGFR mL/min/1.73 m² (CKD-EPI 2021, as reported); UACR mg/g. Units verified on entry; each value opens its source line, highlighted.`
- Rows from the scanned report show a tiny `scanned · OCR 96%` tag.

**Bottom strip: FOLLOW-UP · schedule set by the clinician, dates only.** A table `Item · Every · Status`:

- Kidney panel (eGFR + UACR): `6 months · set by Dr. M.` → `next due Mar 2026`
- UACR repeat after ≥30: `3–6 months` → `on file, Sep 2025`
- Fundus examination: `12 months` → `2 months overdue`
- Foot examination: `12 months` → `due Jan 2026`

Buttons: `Add to due list` (adds/refreshes an item; front-desk allowed) and `Edit protocol` (doctor only; opens the doctor's editor, 8.6).

**Documents rail** (newest first, with a "new" marker if arrived today): e.g. `● Sep 2025 · Kidney panel, Lab A [new]`, `Jun 2025 …`, `Oct 2024 · Fundus report`, `Oct 2024 · Kidney panel, Lab B (scanned)`. Click a document to open it in the viewer at page 1. A dashed drop-zone at the bottom: `Drop a report here. It is read, matched, and queued for staff if uncertain.` Dropping or choosing any file runs the **intake demo** (8.3) using the next scripted sample. **Never read or upload the actual file.** Say so in a one-line note under the drop-zone.

**The "quiet" empty state.** A patient with nothing due shows a calm, complete follow-up panel ("Everything on this patient's schedule is current."), not an empty-looking one.

### 5.3 Source viewer (click-to-source)

A right-hand slide-over panel (about 45% width, resizable not required), over the patient screen, which stays visible and dimmed slightly.

- Header: `Lab A report · page 2 of 3 · 18 Sep 2025` + prev/next page buttons + close (Esc).
- Body: the paper-like report from 4.5, scrolled so the clicked line is vertically centred, with the highlight and one pulse.
- Footer strip (`--panel`): `Transcribed value: 190 mg/g · read from text layer (exact position)` or, for scans, `Transcribed value: 190 mg/g · OCR confidence 96% · bounding box shown`.
- For Lab B creatinine: a line `Printed: 92 µmol/L → stored as 1.04 mg/dL (unit conversion; original kept)`.
- If the user opens a document via the rail rather than a value, no highlight; just the page.
- This is the demo's money moment. It must be smooth: no layout jump, immediate scroll, no flash of un-highlighted state.

### 5.4 Due list (front desk)

`Due list · Thursday` with header counts derived from the data (`4 due · 3 sent today`; "3 sent today" comes from a seeded log). Table: `Patient · Item due · Due since · Contact · Language · Action`. Rows (hardcoded and cross-checked with 4.4): Devi (Fundus exam, 2 months, Bengali), Das (Urine test repeat, 3 weeks, Bengali), Khan (Yearly kidney panel, 5 months, Hindi), Roy (Second eGFR reading, 1 week, English).  Derive the rows from the data and protocol rather than hardcoding them, so protocol edits and arriving results change the list. With the seed there are exactly 4 due items.

Each row has `Approve · Edit · Skip` inside a `<Human>` boundary on the Action cell. Clicking a row (not the buttons) selects it and shows the **reminder preview** panel beneath (8.5).

### 5.5 Review queue

`Review queue (1)` at the seed. It holds one item, and the intake demo (8.3) can add more. There are two kinds of item (full behaviour in 8.3):

1. A report whose patient can't be matched confidently: shows the report thumbnail, the extracted name/age/sex, and **2–3 candidate patients with confidence** (e.g. Ramesh Das 0.58, Rina Das 0.55). Staff pick one and `File to this patient` (one click), or `None of these`.
2. A report refused by the unit check. **The seeded item** is Tapan Sen's report, which reads `eGFR printed as "54 mL/min", not normalised to 1.73 m². Can't be compared with this patient's other eGFR readings. Not filed.` Actions: `Request corrected report`, `Enter value manually with unit` (a tiny form), `Discard`.

An empty queue shows a calm "Nothing waiting for review."

### 5.6 Audit log

Append-only table: `Time · Who · Role · Action · Details · Reversible?`. Seeded with ~10 earlier entries (dates before "today"). Every user action in the demo appends a new entry at the top with the demo clock time (today 18 Dec 2025, current wall-clock HH:MM is fine). **"Undo" never deletes**; it appends a second entry `Undid: <action>` and restores state. No hard deletes. A line at the top: `Append-only. Nothing here can be edited or deleted.`

### 5.7 Settings

- **Protocol** (doctor-editable, 8.6): clinic defaults and version history with `Revert` buttons.
- **Units & reference intervals**: read-only table of parameters with unit (UCUM text) and the lab-printed reference interval. Header sentence: `Intervals are the lab's own, printed as-is. Nothing here flags a value.`
- **Backups**: `Nightly at 02:00 · last backup today 02:00 ✓ · 30 daily / 12 monthly kept` with a `Restore…` button that opens a calm modal listing three dated backups (fake) and a Cancel/Restore pair; Restore shows a toast and writes an audit entry (state does not actually change).
- **Language templates**: view-only list of the approved reminder templates (8.5).
- **About**: version, `scope mode: triage off`, demo-date note.

---

## 6. Pure logic (put in `src/logic/`, unit-test with Vitest)

### 6.1 `kdigo.ts`

- `gStage(egfr)`: `≥90 G1`, `60–89 G2`, `45–59 G3a`, `30–44 G3b`, `15–29 G4`, `<15 G5`. Boundaries: 90 → G1, 60 → G2, 45 → G3a, 30 → G3b, 15 → G4.
- `aStage(uacr)`: `<30 A1`, `30–300 A2` (30 and 300 both inclusive), `>300 A3`.
- Return a cell `{ g, a }` only. **No risk category function exists. Do not write one.**

### 6.2 `mapPos.ts` (point placement inside the grid)

Column x: A1 `t = log10(clamp(u,3,30)/3)`, A2 `t = log10(u/30)`, A3 `t = log10(clamp(u,300,3000)/300)` (each t in [0,1]). Place at `col*cw + (0.08 + 0.84*t)*cw`.
Row y: row bands `G1 [90,120] G2 [60,90) G3a [45,60) G3b [30,45) G4 [15,30) G5 [0,15)`; `t = (hi - e)/(hi - lo)`, clamp 0..1; place at `row*rh + (0.08 + 0.84*t)*rh`.

### 6.3 `due.ts`

- `addMonths(date, n)` calendar-safe (clamp day to month end).
- `monthsBetween`, `sinceText(due, today)` per 4.4's wording rule.
- `nextPanel(obs, months)`, `status(item, today)` returning `onFile | due | overdue`, plus the text.

### 6.4 `repeat.ts` (UACR repeat state, no judgement)

States, for display only:

```
none ──(first UACR ≥30)──▶ one_on_file ──(3 months pass, no new result)──▶ repeat_due
                                 │                                            │
                                 └──(2nd result within 6 months)──▶ repeat_on_file ◀──(result arrives)──┘
```

- Pending text: `Repeat due since 3 weeks` etc.
- On file: `on file, Sep 2025`; add `doctor reviews both` as a plain line.
- Same shape for "Second eGFR after first <60", with a ≥3-month wait.
- A UACR <30 resets the state to `none`. No wording about what the numbers mean.

### 6.5 `units.ts` (the unit check)

- Known good units for each kind: eGFR `mL/min/1.73 m²`; UACR `mg/g`; creatinine `mg/dL` (also accepts `µmol/L` and converts, `÷ 88.4`, and keeps the original).
- `check(kind, value, unit)` returns `ok | converted | refused` with a plain-sentence reason. `mL/min` without `/1.73 m²` → `refused` as in 5.5.
- Unit tests for each case.

### 6.6 `templates.ts` (reminders), `fhir.ts` (export), `audit.ts` (log)

Specified in section 8.

---

## 7. Roles

A role switch at top-right: `Front desk` · `Doctor`. A segmented control, with a short caption `Switch role to see what each can do`. State persists for the session.

| Ability | Front desk (K.) | Doctor (Dr. M.) |
|---|---|---|
| Open patients, read charts | ✓ | ✓ |
| Confirm review-queue matches | ✓ | ✓ |
| Approve / edit / skip reminders | ✓ | ✓ |
| Add item to due list | ✓ | ✓ |
| Edit protocol (clinic default or patient override) | read-only (button disabled, tooltip `Doctor only`) | ✓ |
| Revert protocol version | ✗ | ✓ |
| Export | ✓ | ✓ |

Every audit entry records the active role and name.

---

## 8. Abilities to demonstrate (each one fully working, hardcoded)

### 8.1 One-page history on the KDIGO grid
Section 5.2. Plain, unshaded, measured points only.

### 8.2 Click-to-source
Section 5.3. The signature interaction. Works from table values, map points, and documents.

### 8.3 Report intake pipeline (scripted, animated)

Triggered from the drop-zone on the patient screen or an `Intake demo` button on the Day list and Queue pages. **Three scripted samples**, used in order each time the user runs the demo (then loop):

1. **Clean match.** A Lab A report for Nandini Ghosh with ID and phone matching. Stages animate over ~4 seconds as a horizontal stepper (each stage a process box, ticking left to right): `Received → Read (text layer) → Transcribed · units checked ✓ → Matched to patient · confidence 0.98 → Filed with provenance`. Ends with the new reading appearing on her map and in her table, and a `new` marker. Audit entry added.
2. **Ambiguous match.** A report for "R. Das". Stages run to `Matched to patient · confidence 0.58 (two candidates)`, then the stepper stops at a `<Human>` box `Staff confirm in review queue`. It lands in the Review queue (count goes 1 → 2). Staff selects Ramesh Das → the report files to his record, his UACR-repeat state updates to `repeat on file`, and the due list drops that row. Audit entries for confirm + file.
3. **Unit refused.** A report for Mohan Roy where eGFR is printed as `55 mL/min` (the seeded queue item is the same kind of case for Tapan Sen). Stages stop at `Transcribed · units checked ✗` with the plain sentence from 5.5 and routes to the queue as the second item type.

Show a small **safety line** under the stepper: `A report is never filed automatically below the confidence threshold.` and a `Provenance` expander listing: source document hash (fake, 12 hex), matched on (ID / phone / name+DOB), confidence, confirmed by (staff name or "auto, ≥0.90").

### 8.4 Unit checking
Demonstrated by the Lab B creatinine conversion in the viewer (5.3) and the refused eGFR in 8.3. A tiny `Units verified ✓` marker sits next to every transcribed value in the source-viewer footer.

### 8.5 Due list and reminders

Reminder templates, **fixed text** with slots. In the prototype, "drafting" just fills the slots; nothing generative runs. Do not label anything "AI". Say `Drafted from an approved template`.

Slots: `{name}`, `{item}`, `{clinic}`. Item names per language:

| Key | English | Hindi | Bengali |
|---|---|---|---|
| `repeat_uacr` | follow-up urine test | दोबारा यूरिन टेस्ट | ফলো-আপ প্রস্রাব পরীক্ষা |
| `panel` | yearly kidney check (blood and urine tests) | किडनी की वार्षिक जाँच (खून और यूरिन टेस्ट) | কিডনির বার্ষিক পরীক্ষা (রক্ত ও প্রস্রাব) |
| `egfr2` | second kidney blood test | किडनी का दूसरा ब्लड टेस्ट | কিডনির দ্বিতীয় রক্ত পরীক্ষা |
| `fundus` | eye check | आँखों की जाँच (फंडस) | চোখের পরীক্ষা (ফান্ডাস) |
| `foot` | foot check | पैरों की जाँच | পায়ের পরীক্ষা |

Templates:

- **English:** `Namaste {name}. This is a reminder from {clinic} that your {item} is due. Please call the clinic to book a time.`
- **Hindi:** `नमस्ते {name}। {clinic} की ओर से याद दिलाया जा रहा है कि आपकी {item} का समय हो गया है। कृपया समय तय करने के लिए क्लिनिक को फोन करें।`
- **Bengali:** `নমস্কার {name}। {clinic} থেকে মনে করিয়ে দেওয়া হচ্ছে যে আপনার {item}-এর সময় হয়েছে। অনুগ্রহ করে সময় ঠিক করতে ক্লিনিকে ফোন করুন।`

(Add a code comment that the Hindi and Bengali need a native-speaker review before any real use.)

**Reminder preview panel** (below the due list):

- Title: `REMINDER PREVIEW · {patient}, {language}`. A segmented control to switch preview language (EN / हिं / বাং). The patient's own language is the default.
- The message in a rounded bubble.
- Under it: `Drafted from an approved template. Contains no health content beyond the name of the check.` and `Consent on file ✓ (seeded)`.
- Buttons inside `<Human>`: `Approve & send` · `Edit` · `Skip`.
  - **Edit** makes the bubble editable, limited to a text area (no AI). Edits are logged with before/after.
  - **Approve & send** shows a modal-less confirmation: the row moves to a `Sent` state with `via clinic WhatsApp · 10:42` (use the demo wall-clock time), the `sent today` counter rises, an audit entry is added with an **Undo** link (within the session; undo appends an audit entry and reverts the row to `Due`). Nothing is actually sent. Add a tiny line: `Prototype: no message is sent.`
  - **Skip** asks for a one-word reason from a short list (`Patient attended`, `Called by phone`, `Not needed`), then the row shows `Skipped · reason`.
- Once a result arrives (via the intake demo), the matching due row clears itself with an audit entry `Cleared: result on file`.

### 8.6 Doctor's protocol editor (preview → reason → version → revert)

Opened from Settings → Protocol, or `Edit protocol` on a patient (doctor only). Wrapped in `<Human>`.

- Fields: the five interval values from 4.3 (numeric steppers in whole months; repeat window has 3 and 6 months).
- **Live preview as the doctor edits**, computed from the data: e.g. `Changing the kidney panel interval from 12 to 6 months moves 3 patients from "on file" to "due".` Show the affected patients in a short list. If nothing moves: `This changes no one's due date today.`
- Next, a **mandatory reason** text field (cannot save empty).
- `Save as version 3` writes a new protocol version (v1 seed, v2 earlier seed, v3 the new one) with timestamp, author, and reason; the due list and every patient's follow-up panel recompute immediately.
- **Version history list** with a `Revert to this version` button (doctor only). Reverting creates a new version (nothing deleted) and an audit entry.
- Per-patient override: on a patient's follow-up panel (doctor role), `Override for this patient` lets the doctor set that patient's kidney panel interval; shows as `X months · set by Dr. M.`.

### 8.7 Export

`Export (FHIR / CSV)` opens a small menu. All client-side, from the hardcoded data:

- **CSV (long):** one row per observation: `patient_id, date, code, name, value, unit, lab, source_doc, page, line`.
- **FHIR R4 Bundle (JSON)** of `Observation` resources for the current patient. Use LOINC and UCUM codes:
  - eGFR CKD-EPI 2021: LOINC `98979-8`, UCUM `mL/min/{1.73_m2}`
  - Albumin/creatinine ratio, urine: LOINC `9318-7`, UCUM `mg/g`
  - Creatinine, serum: LOINC `2160-0`, UCUM `mg/dL`
  - (Note in a code comment to double-check these codes before any real use.)
- Both produce a browser download (Blob) and an audit entry (`Exported`).
- Show a one-line toast `Exported 7 readings for S. Devi. Nothing left this PC.`

### 8.8 Audit and reversibility
Section 5.6. Every state-changing action writes to the audit log. Every approve/skip/confirm/protocol change has an Undo that appends rather than deletes.

### 8.9 Backups and offline status
Status bar and Settings → Backups (5.7). Purely presentational and calm.

### 8.10 Scope tour: "What this software never does"

A page or modal reachable from a link in the top ribbon, `Scope: what it never does`. Two columns, as on the pitch deck's slide 6:

| The rules exclude | What Kidney Map does instead |
|---|---|
| Diagnosis | Shows readings on the published grid. The doctor decides. |
| Treatment advice | Records the prescription the doctor writes. |
| Decision support | Tells the front desk which scheduled test is due. |
| Risk scoring | Plots measured values only. No model is trained or run. |
| Interpreting results | Transcribes values with units checked, linked to the source line. |
| Autonomous advice | Drafts a scheduling reminder a person approves. |

This page and the scope guardrail allow-list are the only places the excluded words may appear.

### 8.11 (Stretch, only if time remains) Prescription note

A simple `Record prescription` form on the patient screen (doctor only): pick from a tiny hardcoded drug list (generic + one brand each, e.g. "Metformin 500 mg"), dose text, duration; `Save` appends to a prescriptions list and shows a letterhead preview in a modal printable with `window.print()` (print CSS). **No interaction checking, no suggestions, no defaults filled in.** Keep drugs generic and non-specific to kidney function. Skip this entirely if it threatens the schedule.

---

## 9. Guided demo mode (for the 90-second video)

A `Guided demo` button in the top ribbon starts a lightweight step overlay (a floating card, bottom-right, with `Next` / `Back` / `Exit`; it highlights the relevant element with a thin ring and never blocks clicks on it). Steps:

1. **Day list.** "Four items due, one new report. Banerjee has nothing due, and that's a complete state." → highlight the list.
2. **Open Sunita Devi.** "Every kidney result she has had, on one page." → navigate to her patient screen.
3. **Hover the map.** "Her readings on the KDIGO grid. The grid is unshaded: the doctor reads it." → hover the latest point.
4. **Click 190.** "Click any value and the original report opens at that exact line." → open the source viewer, highlight pulses.
5. **Close, open Due list.** "The front desk sees who to call today." → go to the Due list, select Ramesh Das.
6. **Approve the reminder in Bengali.** "Drafted from an approved template. No message leaves without a person approving it." → click Approve (audit entry appears).
7. **Run the intake demo (ambiguous sample).** "Uncertain matches are never filed automatically." → queue → confirm Ramesh Das.
8. **Switch to Doctor, edit protocol.** "Every change is previewed, needs a reason, and can be reverted." → preview → reason → save v3 → show the audit log.
9. **Export.** "FHIR and CSV, locally. Nothing leaves the PC." → end card: `Your lab report tells you the number. We make sure someone sees all of them, and that the next test happens.`

Also: a `Reset demo` button (ribbon) and the `?reset` param restore the seed instantly, so the tour can be rerun between takes.

---

## 10. Copy rules

Plain, calm, specific. No hype ("revolutionary", "seamless", "powered by"), no exclamation marks, no emoji. Short sentences. Button labels are verbs (`Approve & send`, `File to this patient`). Empty states are complete and quiet, not apologetic.

Use only the neutral vocabulary from 3.1. Where a result needs a word, use "result", "reading" or "value", never an adjective about what it means.

---

## 11. Accessibility and polish

- All interactive elements are real `<button>` or `<a>`, with visible focus rings (2px `--ink` outline + 2px offset). Esc closes the viewer/modal. Arrow keys move between table rows.
- Status is never colour-only (and there is no status colour anyway).
- Map points have `aria-label`s (`20 Jun 2025, eGFR 52, UACR 210`), and the table is the accessible equivalent of the map.
- Contrast: body text on `--paper` must meet WCAG AA. Check `--muted` on `--paper` (adjust the grey slightly darker if it fails; stay grey).
- Loading is instant (no spinners; everything is local). Page transitions are instant or a 120ms fade.
- No layout shift when the viewer opens. No scroll jank. The map renders crisply at 1×, 1.5× and 2× pixel densities (SVG).

---

## 12. Honesty banner and labels

- Persistent thin ribbon at the top: `Interactive prototype · synthetic data only · nothing is uploaded or sent` with links `Guided demo`, `Reset demo`, `Scope: what it never does`.
- On the drop-zone: `Prototype: your file is not read or uploaded. A sample report is used.`
- On "Approve & send": `Prototype: no message is sent.`
- On Backups restore: `Prototype: nothing is changed.`
- Footer of the Settings → About: `PreSymp Kidney Map prototype. All names, numbers and reports are synthetic. This is a preview of features; the existing PreSymp v0.1 build is described separately in the submission.`

---

## 13. Project layout

```
kidney-map-prototype/
  SPEC.md                  (this file)
  README.md                (run, test, deploy; short)
  package.json  vite.config.ts  tsconfig.json  index.html
  scope-allow.json
  scripts/scope-check.mjs
  src/
    main.tsx  App.tsx  routes.tsx  tokens.css  app.css
    store/            store.ts  seed.ts  (patients, obs, docs, protocol, audit seed)
    logic/            kdigo.ts  mapPos.ts  due.ts  repeat.ts  units.ts  templates.ts  fhir.ts  audit.ts
    logic/*.test.ts
    components/       Human.tsx  TopBar.tsx  StatusBar.tsx  Ribbon.tsx  KidneyMap.tsx
                      ReadingsTable.tsx  FollowUp.tsx  DocRail.tsx  SourceViewer.tsx
                      ReportPage.tsx  DueTable.tsx  ReminderPreview.tsx  IntakeStepper.tsx
                      QueueItem.tsx  ProtocolEditor.tsx  ExportMenu.tsx  Tour.tsx  Toast.tsx
    pages/            Day.tsx  Patient.tsx  Due.tsx  Queue.tsx  Audit.tsx  Settings.tsx  Scope.tsx
    reports/          labA.tsx  labB.tsx  scan.tsx  fill.ts   (report renderers and filler lines)
```

Keep files under ~250 lines where you can.

---

## 14. Build plan (work in phases; commit after each)

Run `npm run check:scope`, `npm test` and `npm run build` at the end of every phase. Take a Playwright screenshot of each new screen and look at it before moving on.

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Scaffold, tokens, chrome (top bar, status bar, ribbon, router), scope-check script | App loads; `check:scope` runs and passes on the empty shell |
| 1 | Seed data and `src/logic/*` with tests (kdigo, mapPos, due, repeat, units) | All expected results in 4.4 pass as tests |
| 2 | Patient screen: ribbon, KidneyMap, ReadingsTable, FollowUp, DocRail | Devi's screen matches the deck wireframe; hover and select work |
| 3 | Report renderers + SourceViewer + click-to-source (text, scan, Lab B conversion) | Clicking 190 opens page 2, highlighted, smoothly; scan overlay works |
| 4 | Day list, Due list, reminders (3 languages), approve/edit/skip, audit log with undo | Due rows match 4.4; approve → audit entry → undo works |
| 5 | Intake stepper (3 scripted samples), Review queue, provenance expander | Ambiguous sample → queue → confirm → state updates everywhere |
| 6 | Roles, ProtocolEditor (preview → reason → version → revert), per-patient override, Settings | Doctor edit recomputes due list live; front desk sees it disabled |
| 7 | Export (CSV + FHIR), backups modal, Scope page, Guided demo, Reset | Full 9-step tour runs end to end without errors |
| 8 | Polish: a11y pass, 1280×720 pass, README, deploy config | Section 15 checklist all ticked |

---

## 15. Final acceptance checklist

**Look and feel**
- [ ] Matches the deck: warm paper background, serif headlines, thin rules, flat wireframe feel.
- [ ] Accent teal appears only on `<Human>` boxes and the source highlight.
- [ ] No red/amber/yellow/orange/green anywhere. `check:scope` is clean.

**Scope**
- [ ] No banned word on any screen outside the Scope page (verified by the script and by eye).
- [ ] No score, badge, trend, arrow, flag or colour attached to any value or patient.
- [ ] Reminders contain only the name of the check, nothing about results.

**Abilities**
- [ ] Map: unshaded grid, correct cell placement for every Devi reading, hover and click work.
- [ ] Click any value → viewer opens at the exact line, highlighted, with correct provenance footer (text vs OCR vs converted).
- [ ] Due list numbers match section 4.4 exactly; Approve → sent state + audit + undo.
- [ ] Reminder preview works in English, Hindi and Bengali.
- [ ] All three intake samples work; ambiguous one goes through the queue and updates the due list.
- [ ] Unit check refuses `mL/min` and converts `µmol/L` with the original kept.
- [ ] Doctor protocol edit: live preview count, mandatory reason, new version, revert, audit entries; front desk can't edit.
- [ ] CSV and FHIR downloads work and contain the right readings.
- [ ] Audit log is append-only; every undo appends.
- [ ] Guided demo runs all 9 steps; Reset restores the seed.

**Quality**
- [ ] Vitest passes (kdigo boundaries, mapPos clamps, due-since wording, repeat state, unit check).
- [ ] `npm run build` is clean (no TS errors, no console errors at runtime).
- [ ] No network requests at runtime (check the browser's Network panel).
- [ ] Works at 1440×900 and 1280×720.
- [ ] Keyboard-only run-through of the main flow works.
- [ ] README explains run / test / deploy in under 30 lines.

---

## 16. Things to leave out on purpose

Real OCR, real PDF parsing, real file upload, login, a backend, a database, real messaging, any model or "AI" behaviour, risk colours of any kind, trend or slope displays, mobile layouts, internationalisation of the UI chrome (only the reminder templates are multilingual). If you're tempted to add something not in this file, don't. Ask first, or leave it out.
