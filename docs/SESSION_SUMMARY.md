# Session Summary — TunzaCare (First Build Session)

> **Project**: TunzaCare (*formerly working title ENDELEA*) — Longitudinal care continuity companion for adults in Kenya managing hypertension and/or diabetes.
> **Date**: August 22–23, 2026
> **Discipline**: Follows LINDA build package rigor and AGENTS.md governance rules.

---

## 1. What Was Built

### A. Foundational Governance & Architecture Documentation
- [`00_PROJECT_BRIEF.md`](../00_PROJECT_BRIEF.md): Scope, Kenya NCD cascade burden (24.5% prevalence, 1 in 50 controlled), retention failure mode analysis, target personas, and explicit v1 non-goals.
- [`01_DATA_SOURCES.md`](../01_DATA_SOURCES.md): Complete single source of truth for all clinical and adherence thresholds.
- [`02_AGENTS_RULES.md`](../02_AGENTS_RULES.md) / [`AGENTS.md`](../AGENTS.md): The 12 non-negotiable governance rules.
- [`03_ARCHITECTURE.md`](../03_ARCHITECTURE.md): Local-first data schemas, immutable readings log, topic-level education tracking, and isolated escalation boundary.
- [`04_TODO.md`](../04_TODO.md): Build queue tracker across all phases.
- [`05_DESIGN_MOCKUP.html`](../05_DESIGN_MOCKUP.html): Interactive visual design mockup.
- [`06_DEFINITION_OF_DONE.md`](../06_DEFINITION_OF_DONE.md): Acceptance criteria benchmarks.
- [`07_SELF_PROMPT_LOOP.md`](../07_SELF_PROMPT_LOOP.md): Self-audit loop protocol.
- [`docs/DECISIONS.md`](DECISIONS.md): Tech stack, storage strategy, escalation transport status, and responsive architecture.

### B. Core Business Logic & Data Engine
- [`src/data/clinical_thresholds.json`](../src/data/clinical_thresholds.json): Exhaustive single source of truth JSON file for all cutoffs (80% adherence, BP bands, BP emergency, glucose bands, glucose emergency, glucose nudges, refill rules, escalation timing).
- [`src/storage/store.js`](../src/storage/store.js): Local-first persistence engine supporting IndexedDB / localStorage with synchronous in-memory fallback for unit testing in Node.js.
- [`src/logic/readings.js`](../src/logic/readings.js): Immutable reading entry, dual-output alert classifier (`displayBand` vs `isEmergency`/`isNudge`), and unit conversions.
- [`src/logic/adherence.js`](../src/logic/adherence.js): Daily check-in logging, adherence percentage proxy vs 80% cutoff, refill countdown ($\max(7\text{ days}, 20\%\text{ of supply})$), and 5-day / 7-day silent-dropout trigger.
- [`src/logic/education.js`](../src/logic/education.js): Contextual micro-education engine with topic-level state tracking to prevent mechanical repetition.

### C. Isolated Escalation Subsystem
- [`src/escalation/escalation.js`](../src/escalation/escalation.js):
  - Strictly isolated in `/src/escalation/` — the ONLY folder in the codebase allowed to interface with outbound communication.
  - `sendEscalationTrigger()`: Sole outbound chokepoint.
  - `composeEscalationMessage()`: Fixed privacy-preserving template containing **only the patient's chosen display name and ZERO health data**.
  - Runtime `validateZeroHealthData()` safety invariant validator.
  - Offline queue-and-retry mechanism (`enqueueEscalation` & `processOfflineQueue`).

### D. Bilingual Engine (English + Swahili)
- [`src/i18n/en.json`](../src/i18n/en.json) & [`src/i18n/sw.json`](../src/i18n/sw.json): 100% 1:1 bidirectional string key parity.
- [`src/i18n/i18n.js`](../src/i18n/i18n.js): Lookup engine with fallback, interpolation, and language switching.

### E. Mobile-First Patient Interface — The Ledger & Passport Metaphor
- Built directly against [`09_DESIGN_LEDGER_CONCEPT.html`](../09_DESIGN_LEDGER_CONCEPT.html) (`Spectral`, `Special Elite`, `IBM Plex Mono`, warm paper `--paper` `#F3EDDD`, stitched spine, right-edge tab rail).
- **100% Real Data Binding (Zero Dummy UI)**:
  - **Stamp Button**: Wired directly to `logAdherence()`, reflecting the exact stored check-in status for today (`TAKEN TODAY` vs `STAMP TODAY`).
  - **Visa-Grid Calendar**: Renders dynamic month grid populated from real stored `adherence_log` entries.
  - **Refill Countdown**: Computes actual days remaining and percentage from `getRefillStatus()`.
  - **Log Reading Screen**: Live evaluates `getAlertLevel()`, updating dynamic band tags on keystroke, and routing to the real Emergency Torn Page screen if emergency thresholds are crossed.
  - **Emergency Screen**: Displays actual entered vitals (e.g. `204/108`) with mandatory acknowledgment ("Nimeelewa — I understand").
  - **Sealed Letter Escalation**: Renders dynamic `composeEscalationMessage()` template with actual patient name in active language.
  - **The Ledger (Trends)**: Renders actual entries from immutable `readings` log with true empty state when no entries exist.
  - **Registry (Settings)**: Profile management, language toggle, refill management, and local-only JSON export.

---

## 2. Test Suite & Validation Results

Executed via Node.js native test runner: `node --test tests/*.test.js`
**Result**: **23 tests passing, 0 failures.**

1. [`tests/core_logic.test.js`](../tests/core_logic.test.js):
   - Immutable reading logs and append behavior.
   - Dual outputs from `getAlertLevel` (`displayBand` vs `isEmergency`).
   - `calculateAdherenceRate` check-in proxy vs 80% cutoff.
   - `getRefillStatus` evaluating $\max(7\text{ days}, 20\%\text{ of supply})$.
   - `checkEscalationTrigger` 5-day self-prompt and 7-day contact notify sequence.
2. [`tests/boundary_clinical.test.js`](../tests/boundary_clinical.test.js):
   - Adherence boundary (79% vs 80% vs 81%).
   - BP display bands (<130/85, 130–139/85–89, 140–159/90–99, $\ge$160/100).
   - BP emergency cutoffs (199 vs 200 systolic, 99 vs 100 diastolic, 79 vs 80 systolic).
   - **Glucose Nudge vs Emergency Boundaries (User Item 1)**: Verified 53 mg/dL $\rightarrow$ Emergency, 54–69 mg/dL $\rightarrow$ Nudge (15-15 rule), 70–99 mg/dL $\rightarrow$ Normal fasting, 100–125 mg/dL $\rightarrow$ Prediabetes, 126–300 mg/dL $\rightarrow$ Diabetes range, 301–400 mg/dL $\rightarrow$ Mild high nudge, and 401 mg/dL $\rightarrow$ Severe emergency.
3. [`tests/emergency_invariant.test.js`](../tests/emergency_invariant.test.js):
   - Proves emergency alerts have `requiresAcknowledgment: true` and cannot be silently bypassed or suppressed.
4. [`tests/escalation_privacy.test.js`](../tests/escalation_privacy.test.js):
   - **Fresh profile defaults to disabled (User Item 2)**: Proves `optInEscalation === false` on new profiles.
   - **Zero Health Data Assertion**: Asserts composed messages never contain BP values, glucose values, percentages, or medication names.
   - **Offline Queue-and-Retry (User Item 3)**: Simulates connection drop, verifies queuing, and proves successful retry upon connection recovery.
   - Late check-in cancellation and mid-cycle disable adversarial tests.
5. [`tests/i18n.test.js`](../tests/i18n.test.js):
   - Bidirectional 1:1 key parity between English and Swahili dictionaries.
   - **Non-shaming copy audit (User Item 4)**: Asserts zero shaming keywords in either language.
6. [`tests/adversarial.test.js`](../tests/adversarial.test.js):
   - Extreme vitals, same-day duplicate check-in updates, depleted prescription behavior, and bidirectional unit conversions.

---

## 3. What Is Stubbed & Non-Clinical UX Defaults Flagged for Review

### A. Real Escalation Outbound Transport (Stubbed)
- In v1, `sendEscalationTrigger` is built with a stubbed transport that validates safety, generates the privacy-preserving payload, and queues offline if disconnected.
- The decision on commercial SMS gateways (e.g., Africa's Talking / Safaricom API / Twilio) and telecom regulatory licensing in Kenya is **explicitly logged as Osus's strategic decision** in [`docs/DECISIONS.md`](DECISIONS.md).

### B. Non-Clinical UX Defaults (Flagged for Future Field Calibration)
Per `01_DATA_SOURCES.md`, the following two parameters are heuristic UX defaults rather than cited clinical cutoffs, built as configurable settings in `clinical_thresholds.json`:
1. **Silent-Dropout Escalation Window (5-day self-prompt, 7-day contact trigger)**:
   - *Rationale*: Chosen to balance patient grace period against timely intervention before chronic abandonment.
   - *Review Note*: Needs real-world field observation with Kenyan patients and CHWs to calibrate optimal sensitivity.
2. **Refill Reminder Lead Time ($\max(7\text{ days}, 20\%\text{ of total prescription supply})$)**:
   - *Rationale*: Sized to provide sufficient lead time in rural/peri-urban transport contexts where chemist or dispensary visits cannot be done same-day.
   - *Review Note*: To be reviewed against regional facility stock availability and refill trip frequency.

### C. Settings Data Export Audit (Local-Only Invariant)
- **Mechanism**: The Settings screen's "Export Data (JSON)" button generates a structured `.json` export client-side via in-memory `Blob` and triggers a local browser download (`URL.createObjectURL`).
- **Network Invariant**: Confirmed that it makes **zero network requests, zero API calls, and zero cloud uploads**. The data never leaves the patient's device except when the patient explicitly chooses to share the downloaded file via their own OS share sheet. `/src/escalation/` remains the sole outbound network chokepoint.

---

## 4. Human Review Checklist Prior to Real Patient Deployment

1. **Escalation Module Audit**: Review [`src/escalation/escalation.js`](../src/escalation/escalation.js) to confirm no outbound network calls exist outside `sendEscalationTrigger`.
2. **Emergency Modal UX**: Confirm in clinical walkthroughs that the un-dismissible emergency modal appropriately routes patients to physical facility care during crises.
3. **Swahili Copy Review**: Validate plain-language Swahili translations with Kenyan community health promoters (CHPs) for local dialect nuances.

---

## 5. Official Product Rename — TunzaCare
- **Date**: August 23, 2026
- **Update**: The application name was officially changed from working title **ENDELEA** to **TunzaCare** (bilingual blend: *Tunza* [Swahili: nurture, look after] + *Care* [English]).
- **Sweep Completed**: Updated user-facing dictionaries (`en.json`, `sw.json`), HTML page titles, package metadata, and export filenames (`tunzacare_ledger_<timestamp>.json`). Historical build records retain ENDELEA as their working reference.

---

## 5. Official Product Rename — TunzaCare
- **Date**: August 23, 2026
- **Update**: The application name was officially changed from working title **ENDELEA** to **TunzaCare** (bilingual blend: *Tunza* [Swahili: nurture, look after] + *Care* [English]).
- **Sweep Completed**: Updated user-facing dictionaries (`en.json`, `sw.json`), HTML page titles, package metadata, and export filenames (`tunzacare_ledger_<timestamp>.json`). Historical build records retain ENDELEA as their working reference.
