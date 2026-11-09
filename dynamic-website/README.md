# PreSymp Kidney Map: final-round build

A clinic tool for diabetes follow-up. It shows every eGFR and UACR result on one page, links each number to the exact line of its source report, and keeps repeat and yearly tests from being forgotten. It does not diagnose, score, predict or advise. A person presses Send on every message.

Fixed demo date: Thu 18 Dec 2025. All patients, labs and reports are made up.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Reports, OCR and saved voice recordings work locally. Sarvam speech and transcription need an internet connection and a server-side key.

## Voice MVP

- **Listen with Sarvam:** open a follow-up card, allow its text to be sent, generate speech, then play or download the WAV. The current English, Hindi or Bengali card is read as written. Editing the card clears generated audio.
- **Voice note on the card:** record a take-home message below the card. Transcribe it, review the words, then press **Use as card note** to insert up to 240 characters. Keep or download the original audio to share alongside the printed card/image. Audio is a separate attachment; it is not embedded in the printed card or PNG.
- **Voice search:** use the microphone next to patient search. Record a name, ID or phone digits, transcribe, check/edit the words, and press **Search these words**.
- **Patient voice messages:** open a patient and press **Voice messages**. Consent, record up to 25 seconds, listen, and press **Keep voice message**. Saved recordings and optional transcripts survive reload in this browser's IndexedDB. Replay, download or explicitly delete each one. They remain separate from demo reset and are not synced to another device. Clearing site data removes them.
- Transcription supports auto-detection, English and ten Indian languages, with as-spoken, mixed-script and English translation modes. Check names, numbers and medicine names against the recording before using a transcript.

Copy `.env.example` to `.env` if needed and set `SARVAM_API_KEY`. Never prefix it with `VITE_`. `npm run dev` and `npm run preview` include the same-origin voice gateway. **Settings → Sarvam voice** reports whether the server has a key, without exposing it.

For the built MVP with voice:

```bash
npm run build
npm start             # http://localhost:4173 — serves dist/ and /api/voice/
npm run test:voice    # gateway validation, consent, provider errors and key isolation
npm run check:voice   # real Sarvam speech → transcription, synthetic Hindi greeting only
npx playwright test e2e/voice.spec.ts
```

The production server runs on Render and binds to `0.0.0.0`. `HOST` overrides the bind address and `PORT` selects the port supplied by Render (4173 when unset). No server needs to run on your laptop for the hosted app. Voice needs HTTPS or localhost for microphone access. A remote clinic deployment needs the same server endpoints behind the clinic's authentication; copying only `dist/` to a static host does not provide Sarvam. This MVP does not include multi-user authentication or cloud medical-record storage.

The gateway uses Sarvam's [speech API](https://docs.sarvam.ai/api-reference/text-to-speech/convert) (`bulbul:v3`) and [transcription API](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) (`saaras:v3`). The key stays server-side; consent and an explicit action are required before any clip or card text is sent. Provider failures leave the local clip available. The server does not write recordings, transcripts or provider responses to disk.

## Build and deploy

```bash
npm run build        # checks scope, type-checks, writes dist/
npm run preview      # http://localhost:4173
```

`dist/` is a plain static site for local features. Use `npm start` to include Sarvam, or provide the same gateway on your host. Keep the folder together: the OCR engine (`dist/tesseract/`, about 15 MB) and the sample files (`dist/samples/`) sit next to `index.html`.

`npm run build:single` writes one `index.html` without OCR. It is a backup for showing the screens; photos and scans will go to To check.

### Render submission demo

See [DEPLOY-RENDER.md](DEPLOY-RENDER.md) for GitHub upload and deployment steps. The included `render.yaml` configures a Node Web Service that serves the app, OCR assets and Sarvam gateway together. `.node-version` selects Node 22, with a minimum of 22.12.0 declared in `package.json`.

## Offline and privacy

- No analytics or CDN. Fonts, the pdf.js worker, the tesseract.js worker, its core and `eng.traineddata` are served from this site. The optional voice gateway calls Sarvam only for explicitly requested transcription or speech.
- A file you add is read inside the page and kept in memory. It never leaves the page. Reloading drops it. No patient data is written to localStorage.
- Pressing **Keep voice message** writes that recording and its optional transcript to this browser's IndexedDB. Only this explicit save persists audio. Download copies and deletion are available on each recording. Voice is not part of the demo's illustrated backups.
- `npm run test` and `npm run e2e` include a run with every request outside localhost blocked.

## What is real and what is made up

| Feature | Status |
|---|---|
| Reading text PDFs (pdf.js: lines, labels, number, unit, equation, header) | real |
| Reading phone photos and scanned PDFs (tesseract.js, on this computer) | real |
| Unit check and conversion (mg/mmol to mg/g, µmol/L to mg/dL, eGFR per 1.73 m²) | real |
| Patient matching, To check, duplicate guard | real |
| Click a value or date to open the real page with the marker | real |
| Find in reports (BM25 over the report lines, small synonym list, no model) | real |
| Follow-up card in EN, HI, BN (print, save as image) | real; Hindi and Bengali words are drafts and need a native speaker |
| Listen before sending (the browser's own voices) | real, when the computer has a voice for the language |
| Sarvam speech, voice search and card dictation | real, with the app server and SARVAM_API_KEY |
| Recording, replay, download and kept patient voice messages | real; explicitly kept audio survives reload on this browser |
| Patients, seeded reports, the lab report text behind them, backups | made up |
| Sending a message | not sent. The demo shows the sent state and writes History |

## Commands

```bash
npm run check:scope  # banned words, any colour that is not a design token, --marker only in the viewer
npm test             # unit tests
npm run e2e          # Playwright at 1366x768, against a preview build (run npm run build first)
npm run samples      # rebuilds the five sample files in public/samples
```

## API keys

The voice gateway uses `SARVAM_API_KEY` from `.env` (git-ignored; copy `.env.example`). These existing developer scripts can also use the configured keys:

```bash
npm run check:keys       # one tiny call each to Claude and Sarvam, to check the keys work. Prints no key
npm run phrases:review   # writes PHRASE-REVIEW.md: every Hindi and Bengali phrase with a machine back-translation for the native-speaker review
```

Never give these variables a `VITE_` prefix: Vite would copy them into the page.

## Sample files

`public/samples/` holds five made-up reports. The "Add a report" dialog lists them, and the guided demo uses them.

| File | What happens |
|---|---|
| `kabita-banerjee-text.pdf` | ID matches: saved |
| `r-das-text.pdf` | no ID, two possible patients: To check |
| `m-roy-wrong-unit.pdf` | eGFR printed as mL/min: refused, To check |
| `a-khan-phone-photo.jpg` | a tilted photo, read by OCR, UACR 1.4 mg/mmol saved as 12.4 mg/g with "as printed" |
| `n-ghosh-scanned.pdf` | a PDF that is only a picture, read by OCR: saved |

## Known limits

- OCR on a very blurry or badly lit photo goes to To check. It is never guessed.
- Hindi and Bengali wording still needs the native-speaker sign-off in `PHRASE-REVIEW.md`.
- Only English printed text is read. Handwriting is not read.
- LOINC and UCUM codes in the FHIR export are drafts. Check them on loinc.org before real use.
