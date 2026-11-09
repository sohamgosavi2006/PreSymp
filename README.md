# PreSymp

> **Every kidney test on one page. No one lost to follow-up.**  
> An offline longitudinal record and follow-up assistant for outpatient diabetes clinics.  
> **Health-a-thon by IIT Bombay (2026)**  
> **Live Deployment:** [https://presymp.onrender.com/](https://presymp.onrender.com/)  
> **Repository:** [https://github.com/sohamgosavi2006/PreSymp.git](https://github.com/sohamgosavi2006/PreSymp.git)  
> **Team:** Anmol Agrawal, Sujal Kaware, Soham Gosavi, Dr. Arista Lahiri  
> **Incubation & Clinical Partner:** PreSymp (Incubated at IIT Kharagpur) · Design partner: Diabetes Care Clinic, Kolkata  

---

## Overview

In India, **46% of patients living with type 2 diabetes develop chronic kidney disease (CKD)**. Yet, **less than 1 in 5 high-risk patients receive the recommended annual urine test** to catch it early.

In a busy outpatient consultation lasting under two minutes, test results are often scattered across years of printed papers, smartphone photos, and multi-page lab PDFs from different diagnostic centers.

Catching kidney damage early requires evaluating two separate laboratory markers together:
1. **eGFR (estimated Glomerular Filtration Rate)**: How well the kidneys filter blood (mL/min/1.73 m²).
2. **UACR (Urine Albumin-to-Creatinine Ratio)**: Indicates physical or vascular damage to kidney filters (mg/g).

Two clinical realities make this difficult in routine practice:
* **The Single-Test Trap:** In Indian diabetic cohorts, **39% of patients with declining eGFR have completely normal urine albumin**. Relying on either test alone leaves large blind spots.
* **Biological Variability:** Urine albumin can naturally swing by **41% to 49% between two consecutive tests**. A single abnormal result is not a diagnosis—it requires a confirmatory repeat within 3 to 6 months. In paper-based outpatient records, these scheduled repeats are almost universally lost to follow-up.

PreSymp is designed around a single guiding principle: **the longitudinal record is the core of safe clinical care.**

---

## Repository Structure

This monorepo maintains two independent applications:

```text
PreSymp/
├── static-website/         # Standalone, zero-dependency HTML/CSS/React single-file prototype
│   ├── index.html          # Self-contained interactive prototype with inlined assets
│   ├── Prototype.png       # High-resolution prototype screenshot and reference design
│   └── README.md           # Documentation specific to the standalone static prototype
├── dynamic-website/        # Full-stack production application with Node gateway & local OCR
│   ├── src/                # React 18 + TypeScript frontend (Kidney Map, Intake, Viewer)
│   ├── server/             # Node.js 22 web service & secure Sarvam voice gateway
│   ├── public/             # Static assets and synthetic test sample documents
│   ├── scripts/            # Build, OCR asset staging, and scope validation scripts
│   ├── e2e/                # Playwright end-to-end test suite
│   ├── render.yaml         # Render Blueprint definition (rootDir: dynamic-website)
│   ├── DEPLOY-RENDER.md    # Render deployment and operation guide
│   ├── package.json        # Dependencies and build scripts
│   └── .env.example        # Environment variable template
├── render.yaml             # Root-level Render Blueprint linking to dynamic-website
└── README.md               # Primary project documentation
```

---

## 1. Static Website (`static-website/`)

The static website is a standalone, self-contained demonstration build.

* **Zero External Dependencies:** Built with pure client-side HTML, CSS, and modern React components bundled into a single file (`index.html`). No external CDNs, analytics trackers, or third-party servers are required at runtime.
* **Synthetic Demonstration Data:** Includes synthetic demonstration profiles (`Sunita Devi`, `Ramesh Das`, `Arif Khan`, `Mohan Roy`, `Kabita Banerjee`) modeled after realistic clinical distributions.
* **Running the Static Prototype:**
  ```bash
  # Open directly in your browser:
  open static-website/index.html       # macOS
  xdg-open static-website/index.html   # Linux
  start static-website/index.html      # Windows
  ```

---

## 2. Dynamic Website (`dynamic-website/`)

The dynamic website is a full-featured outpatient kidney follow-up application built with React 18, Vite, TypeScript, and a Node.js 22 backend.

### Key Capabilities

#### Kidney Map
* **KDIGO 2024 Dual-Test Matrix:** Plots eGFR (CKD-EPI 2021) vertically and UACR (stages A1, A2, A3) horizontally.
* **Chronological Trajectory:** Connects historical test panels to visualize disease progression over years.
* **Unshaded by Design:** Avoids artificial risk categorization; presents raw data faithfully for clinical review.
* **Click-to-Source Verification:** Clicking any lab value opens the original document page with an exact highlight over the reported line.

#### Document Rail Search
* **Local Deterministic Search:** Uses BM25 ranking across extracted report lines with clinical synonym expansion.
* **No Black-Box LLMs or Embeddings:** Prevents hallucinated lab values or unverified findings. Every search result is directly anchored to its source document.

#### Client-Side OCR & Intake
* **Local Processing:** Employs Tesseract.js and pdf.js directly in the browser to extract text from PDFs, scanned documents, and smartphone photos.
* **Patient Matching & Duplicate Guard:** Compares patient identifiers and prevents double-filing. Ambiguous or mismatched reports are diverted to a human review queue ("To check").

#### Patient Communication & Voice Integration
* **Multilingual Take-Home Cards:** Generates printable/downloadable summary cards in English, Hindi, and Bengali.
* **Sarvam Speech & Transcription Gateway:** Connects through the Node server to Sarvam AI (`bulbul:v3` and `saaras:v3`) for voice search, take-home audio notes, and patient voice messages.
* **Explicit Consent & Isolation:** Patient consent is required before any audio or text is processed. API keys remain strictly server-side.

#### Clinical Boundaries
* PreSymp does not diagnose, calculate risk scores, or prescribe treatment.
* All decisions and communications remain strictly under the authority of the physician and clinic staff.

---

## Development, Testing & Verification

### Prerequisites
* **Node.js:** Node 22 (>=22.12.0)
* **npm:** >=10.0.0

### Dynamic Application Commands

```bash
cd dynamic-website

# 1. Install dependencies from lockfile
npm ci --include=dev

# 2. Scope check, type check, and build
npm run build

# 3. Run Vitest unit tests (184 tests across intake, units, search, OCR, phrases)
npm test

# 4. Run voice gateway tests (key isolation, consent, contract validation)
npm run test:voice

# 5. Run Playwright end-to-end tests (39 browser tests including offline/blocked network)
npm run e2e

# 6. Start local production server
npm start
```

---

## Render Deployment

The dynamic application is pre-configured for automated deployment on Render as a **Node Web Service**.

### Configuration Highlights
* **Blueprint File:** `dynamic-website/render.yaml` (and root `render.yaml`)
* **Service Type:** Web Service (Node runtime)
* **Root Directory:** `dynamic-website`
* **Build Command:** `npm ci --include=dev && npm run build`
* **Start Command:** `npm start`
* **Health Check Path:** `/`
* **Port Handling:** Uses dynamic `PORT` provided by Render environment (defaults to `4173` locally).
* **Host Binding:** `0.0.0.0`
* **Environment Variable:** `SARVAM_API_KEY` (configured securely in Render dashboard).

For detailed step-by-step instructions, see [`dynamic-website/DEPLOY-RENDER.md`](dynamic-website/DEPLOY-RENDER.md).

---

## Privacy & Data Protection Compliance

* **DPDP Act (India) Alignment:** Reports and patient data are processed client-side and stored in local memory or IndexedDB. No patient health records are written to external databases.
* **CDSCO Non-Device Classification:** Aligns with CDSCO guidelines as administrative/display workflow software rather than an autonomous medical device.
* **Zero Third-Party Trackers:** All fonts, WebAssembly binaries, and OCR data models (`eng.traineddata.gz`) are bundled and served from the application origin.

---

## License & Attribution

Developed by **Team PreSymp** for the **Health-a-thon by IIT Bombay (2026)**.  
Incubated at **IIT Kharagpur**.  
Design partner: **Diabetes Care Clinic, Kolkata**.
