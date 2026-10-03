# PreSymp

> **Every kidney test on one page. No one lost to follow-up.**  
> An offline record and follow-up assistant for diabetes outpatient clinics.  
> **Health-a-thon by IIT Bombay (2026)**  
> **Repository:** [https://github.com/sohamgosavi2006/PreSymp.git](https://github.com/sohamgosavi2006/PreSymp.git)  
> **Team:** Anmol Agrawal, Sujal Kaware, Soham Gosavi, Dr. Arista Lahiri  
> **Incubation & Clinical Partner:** PreSymp (Incubated at IIT Kharagpur) · Design partner: Diabetes Care Clinic, Kolkata  

---

## The Problem

In India, **46% of patients living with type 2 diabetes develop chronic kidney disease (CKD)**. Yet, **less than 1 in 5 high-risk patients receive the recommended annual urine test** to catch it early.

In a busy Indian clinic where a typical consultation lasts **under two minutes**, this failure is rarely due to clinician negligence. The test results often already exist, but they are scattered across years of printed papers, smartphone photos, and multi-page lab PDFs from different diagnostic centers.

Catching kidney damage early requires evaluating two separate laboratory markers together:
1. **eGFR (estimated Glomerular Filtration Rate)**: How well the kidneys filter blood (measured in mL/min/1.73 m²).
2. **UACR (Urine Albumin-to-Creatinine Ratio)**: Indicates physical or vascular damage to the kidney filters (measured in mg/g).

Two clinical realities make this difficult in routine practice:
* **The Single-Test Trap:** In Indian diabetic cohorts, **39% of patients with declining eGFR have completely normal urine albumin**. Relying on either test alone leaves large blind spots.
* **Biological Variability:** Urine albumin can naturally swing by **41% to 49% between two consecutive tests**. A single abnormal result is not a diagnosis—it requires a confirmatory repeat within 3 to 6 months. In the chaos of paper-based outpatient records, these scheduled repeats are almost universally lost to follow-up.

---

## Our Approach

PreSymp is designed around a single guiding principle: **the longitudinal record is the core of safe clinical care.**

Instead of trying to automate clinical diagnosis with black-box algorithms, PreSymp gives doctors and clinic staff an honest, reliable tool that:
1. Brings years of fragmented lab reports into a single, standardized timeline.
2. Plots every paired test on the internationally accepted KDIGO grid.
3. Links every numerical value directly back to the exact line of the original laboratory report.
4. Generates a daily front-desk due list so patients with pending repeats or annual tests are systematically recalled.

PreSymp runs entirely client-side, keeps all patient data resident on the clinic's local computer, and keeps the treating physician firmly in control of every medical decision.

---

## Kidney Map

The **Kidney Map** is the central visual interface of PreSymp. It presents a patient’s complete renal history at a single glance, eliminating the need to flip through historical file folders during a two-minute consultation.

```
                    KDIGO 2024 Dual-Test Matrix
                 A1 (<30)       A2 (30–300)      A3 (>300)
              Normal / Mild       Moderate        Severe
  G1 (≥90)   [      ·      ]  [             ]  [             ]
  G2 (60–89) [      ·      ]  [             ]  [             ]
  G3a (45–59)[             ]  [      ·      ]  [             ]
  G3b (30–44)[             ]  [      ·      ]  [             ]
  G4 (15–29) [             ]  [             ]  [      ·      ]
  G5 (<15)   [             ]  [             ]  [             ]
```

### How the Kidney Map Works
* **Dual-Axis KDIGO 2024 Coordinate Space:** The vertical axis plots **eGFR** (calculated via the CKD-EPI 2021 creatinine equation, staged from G1 down to G5). The horizontal axis plots **UACR** (categorized into stages A1, A2, and A3).
* **Chronological Trajectory:** Each lab panel is plotted as a point in this two-dimensional coordinate system. Points are connected chronologically from the earliest historical test (e.g., Oct 2021) to the most recent panel (e.g., Sep 2025), showing the patient's individual clinical trajectory over months and years.
* **Unshaded by Design:** In medical textbooks, the KDIGO grid is often overlaid with red, amber, and green risk shading. In PreSymp, **the grid is intentionally rendered unshaded**. The software does not calculate an artificial risk score, generate a triage flag, or diagnose stage severity. The doctor reads the grid; the software simply organizes and displays the measured data faithfully.
* **Interactive Value Inspection:** Hovering or clicking on any plotted node displays the exact test date, the paired eGFR, UACR, and Serum Creatinine values, reference intervals, and the originating laboratory.
* **Direct Click-to-Source Inspection:** Clicking any reading on the map instantly opens the raw laboratory PDF in the adjacent pane and scrolls directly to that specific line item.

---

## Source Traceability

In medicine, an unrecognized transcription error or unit mismatch can lead to inappropriate clinical decisions. Healthcare professionals cannot trust a digital dashboard unless they can verify where each number originated.

PreSymp implements **click-to-source traceability** for every single recorded observation:

1. **Side-by-Side Verification:** The patient record is displayed in a split-view layout. The left side presents the Kidney Map and the chronological readings table; the right side houses the document viewer.
2. **Line-Level Highlighting:** When a clinician clicks on a test entry (for example, *UACR 190 mg/g* from September 2025), the integrated document viewer immediately loads that exact laboratory report, navigates to the specific page (e.g., Page 2 of 3), and highlights the raw test row:
   ```
   Urine Microalbumin ....... 38.0 mg/L
   Urine Creatinine ......... 20.0 mg/dL
   Albumin/Creatinine Ratio . 190 mg/g    <-- [HIGHLIGHTED]
   ```
3. **Audit Confidence:** If an external lab printed an unusual reference range, used a non-standard calculation, or reported a sample with low creatinine concentration, the clinician can see the original context in one click without leaving the patient's record.

---

## Key Features

Every feature listed below is fully implemented and interactive in the single-file prototype (`index.html`):

* **Kidney Map Visualization:** Dynamic SVG plotting of paired eGFR and UACR values across KDIGO 2024 stages with trajectory lines and historical node inspection.
* **Longitudinal Readings Table:** Chronological table displaying all historical panels (Date, eGFR CKD-EPI 2021, UACR, Serum Creatinine, Reference Intervals, and Lab Identifier).
* **Click-to-Source Document Viewer:** Split-screen document inspection highlighting exact line items and pages in source reports.
* **Front-Desk Due List:** Proactive morning queue identifying patients due for follow-up tests:
  * Confirmatory repeat UACR (scheduled 3 to 6 months after an initial abnormal result).
  * Annual comprehensive kidney panels (eGFR + UACR).
  * Routine preventive screenings (e.g., fundus/retinopathy eye exams).
* **Multilingual Reminder Drafter:** Drafts patient reminder messages in **English, Hindi, and Bengali**. Staff can review the message, choose the appropriate regional language, and click `Approve`, `Edit`, or `Skip`. No messages are dispatched automatically.
* **Intake & Review Queue:** Report ingestion workflow for new scans and PDFs. Includes automated patient matching with confidence scoring, document validation, and flagging of ambiguous cases for staff confirmation.
* **Strict Unit Validation:** Refuses or flags non-standard or incompatible biological units (e.g., missing creatinine denominators or invalid concentration units) rather than guessing.
* **Day List:** Real-time daily outpatient roster tracking arriving patients, attended visits, and pending diagnostic orders.
* **Role-Based Access Control:** Instant toggle between **Doctor** view (focused on clinical trends, historical panels, and source verification) and **Front Desk** view (focused on Due List reminders, intake, and patient contact).
* **Immutable Audit Log with Undo:** Comprehensive chronological activity log tracking all system events (reminder approvals, schedule updates, report imports) with single-click undo capability.
* **Standardized Healthcare Export:**
  * **FHIR R4 Bundle Export:** 1-click serialization to standard `application/fhir+json` containing `Bundle`, `Patient`, and `Observation` resources mapped to **LOINC** codes and **UCUM** units.
  * **Lineage-Preserving CSV Export:** Tabular export containing full provenance metadata (`patient_id`, `date`, `code`, `name`, `value`, `unit`, `lab`, `source_doc`, `page`, `line`).
* **Local-First / Offline Architecture:** All state management and document viewing runs locally in the browser via client-side storage, with zero requirement for internet access or cloud backend connectivity.

---

## How It Works

PreSymp structures the clinic workflow into five clear, human-centered steps:

```
[ 1. Ingest & Validate ]
   Lab PDFs and scanned reports are dropped into the Intake Queue.
   Patient identities are matched and laboratory units are verified.
            │
            ▼
[ 2. Human Confirmation ]
   Clinic staff confirm uncertain patient matches or flagged unit discrepancies.
            │
            ▼
[ 3. Organize & Standardize ]
   Observations are structured into the patient's longitudinal record,
   indexed with LOINC codes, UCUM units, and exact document line coordinates.
            │
            ▼
[ 4. Clinical Visualization ]
   Doctor opens the patient page. The Kidney Map renders the historical trajectory
   alongside the readings table. Any value can be clicked to inspect the original report.
            │
            ▼
[ 5. Proactive Care-Gap Recall ]
   Front desk reviews the morning Due List for overdue repeats or annual panels.
   Staff review drafted multilingual reminders and approve communications.
```

---

## Clinical Scope & Safety

PreSymp is an administrative and clinical documentation assistant. It operates under strict safety and regulatory boundaries:

| What PreSymp Does | What PreSymp Intentionally Does NOT Do |
| :--- | :--- |
| **Plots measured lab values** onto the published KDIGO 2024 grid | **Never makes a clinical diagnosis** or categorizes a patient as having CKD |
| **Extracts and verifies laboratory units** from reports | **Never calculates automated risk scores**, prognoses, or progression probability |
| **Displays the clinic's scheduled follow-ups** | **Never recommends or alters clinical treatment plans** or medications |
| **Drafts reminder messages** for staff review | **Never sends unsupervised, automated messages** to patients |
| **Maintains an immutable, reversible audit log** | **Never replaces the doctor’s clinical judgment** or consultation workflow |

### Why We Do Not Use Black-Box Predictive AI
In 6 years of longitudinal records (961 patients) analyzed from our clinical partner in Kolkata, **only 19 patients who began with normal kidney function progressed below the CKD threshold**. 

This low event rate means training a machine learning model on short-term eGFR slopes would produce high rates of false positives and severe clinical bias, largely driven by short-term hydration and biological noise. Rather than building a fragile "AI prediction engine," PreSymp solves the actual clinical failure point: **ensuring existing test data is visible and scheduled follow-ups are completed.**

### Regulatory and Privacy Alignment
* **Digital Personal Data Protection (DPDP) Act (India):** Patient records remain entirely resident on the clinic's local workstation. No patient identifiable health information (PHI) is transmitted to external servers.
* **CDSCO Non-Device Classification:** Under Central Drugs Standard Control Organisation (CDSCO) medical device guidance, software that performs patient registration, data storage, display of laboratory results, and administrative appointment scheduling is excluded from medical device regulation.

---

## The Prototype

The prototype is contained in a single, self-contained file: **`index.html`**.

* **Zero External Dependencies:** Built with pure client-side HTML, CSS, and modern React components bundled into a single file. No external fonts, analytics trackers, or third-party servers are required at runtime.
* **Synthetic Demonstration Data:** To protect patient privacy while demonstrating real clinical complexity, all patient records in the prototype (`Sunita Devi / P-0417`, `Ramesh Das / P-0288`, `Arif Khan / P-0932`, `Mohan Roy / P-0061`, `Kabita Banerjee / P-0533`) are **synthetic demonstration profiles** modeled after realistic clinical distributions from Indian diabetes cohorts.
* **Interactive Scenarios:** The prototype includes functional simulations of report intake, matching resolution, reminder approval with audit logging, role switching, and FHIR/CSV data exports.

---

## Running the Prototype

Because the entire application is bundled into a single standalone HTML file, viewing it requires no installation, build step, or package manager:

### Option 1: Open Directly in Your Browser
Double-click **`index.html`**, or right-click and open with any modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari):
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

### Option 2: Run via a Local HTTP Server (Optional)
If you prefer running through a local web server:
```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx serve .
```
Open `http://localhost:8000/index.html` in your browser.

### Option 3: Online Deployment (GitHub Pages / Render)
* **GitHub Pages:** Enable GitHub Pages under Repository Settings pointing to the `main` branch root (`/`).
* **Render:** Create a new **Static Site**, connect this repository, and set the publish directory to `./`. Render will automatically serve `index.html`.

---

## Future Scope

While the current prototype strictly implements the kidney record and follow-up workflow, our roadmap focuses on pragmatic extensions for Indian primary and secondary diabetes clinics:

1. **Expanded Microvascular Follow-Up Engine:** Extending the Due List engine to track annual diabetic retinopathy (fundus photo documentation) and peripheral neuropathy (diabetic foot exams) on the same unified timeline.
2. **Direct Lab Interfacing:** Ingesting raw JSON and PDF results directly from regional laboratory information management systems (LIMS) via local HL7/FHIR feeds.
3. **ABHA / ABDM Integration:** Connecting the export engine with the Ayushman Bharat Digital Mission (ABDM) sandbox to allow patients to link records to their Ayushman Bharat Health Account (ABHA).
4. **Prospective 12-Week Clinical Pilot:** Measuring clinical impact across four targets:
   * Proportion of clinic diabetics receiving both eGFR and UACR within 12 months.
   * Confirmatory repeat UACR completion rate within 3 to 6 months of an initial abnormal test.
   * Staff time required to assemble a complete kidney history.
   * Zero misfiled or misattributed laboratory reports.

---

## Health-a-thon by IIT Bombay

* **Event:** Health-a-thon organized by IIT Bombay (2026)
* **Focus Area:** Outpatient healthcare workflows, longitudinal health records, and preventive care-gap management.
* **Team PreSymp:**
  * **Anmol Agrawal**
  * **Sujal Kaware**
  * **Soham Gosavi**
  * **Dr. Arista Lahiri** (Community Medicine Physician & Clinical Design Partner)
* **Institutional Incubation:** PreSymp, incubated at IIT Kharagpur.
* **Repository:** [https://github.com/sohamgosavi2006/PreSymp.git](https://github.com/sohamgosavi2006/PreSymp.git)

---

*Repository Structure: This repository consists solely of `index.html` (the working prototype) and `README.md` (documentation).*
