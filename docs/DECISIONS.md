# Architecture & Technical Decisions — ENDELEA

This document records the architectural and design decisions made across the development of ENDELEA, ensuring traceability to governance rules (`AGENTS.md`) and clinical data sources (`01_DATA_SOURCES.md`).

---

## 1. Storage & Offline-First Strategy
- **Decision**: Local-first storage model using on-device persistence (`localStorage` / IndexedDB in browser, backed by synchronous in-memory store in Node.js test environments).
- **Rationale**: ENDELEA operates on patient-held hardware across low-connectivity regions in Kenya. Zero reliance on continuous internet connectivity ensures uninterrupted access to longitudinal health logs and emergency guidance.
- **Rule Alignment**: Rule 5 (Local-first architecture).

---

## 2. Escalation Subsystem Boundary & Outbound Chokepoint
- **Decision**: `/src/escalation/` is the sole directory permitted to contain outbound communication logic. `sendEscalationTrigger()` is the single chokepoint.
- **Payload Privacy**: `composeEscalationMessage()` generates a fixed, privacy-preserving template containing **only the patient's chosen display name and ZERO health data** (no BP/glucose values, no adherence percentages, no medication names).
- **Real Transport Deferral**: The production SMS transport (commercial SMS API such as Africa's Talking / Safaricom Gateway vs Twilio) is stubbed in v1 and explicitly deferred as a strategic decision for Osus.

---

## 3. Settings Screen & Data Export Mechanism (Local-Only)
- **Decision**: The "Data Export" button in the Settings screen exports the patient's complete local record (`profile`, `readings`, `adherence_log`, `prescription`) as a structured `.json` file generated entirely client-side via in-memory `Blob` and `URL.createObjectURL`.
- **Network Invariant**: The Data Export mechanism **makes zero network requests, performs zero cloud uploads, and transmits zero data off-device**. The exported file remains strictly on local device storage unless the patient explicitly chooses to share that downloaded file via their own OS-level share sheet (e.g., emailing or sending it via WhatsApp to their clinician).
- **Architecture Validation**: `/src/escalation/` remains the *sole and exclusive* outbound network chokepoint in the entire codebase.

---

## 4. Non-Clinical Heuristic UX Defaults (Flagged for Field Calibration)
- **Decision**: The 5-day self-prompt / 7-day contact escalation trigger window and the refill reminder lead time formula ($\max(7\text{ days}, 20\%\text{ of total supply})$) are established as configurable settings in `src/data/clinical_thresholds.json`.
- **Status**: Flagged for clinical/field observation with Kenyan community health promoters (CHPs) rather than treated as immutable clinical constants.

---

## 5. Shipped Visual Identity — Ledger & Passport Metaphor
- **Decision**: Replaced prior theme with the **Ledger Concept** (`Spectral`, `Special Elite`, `IBM Plex Mono`, warm parchment `--paper` palette, passport circular stamp adherence check-in, visa-grid calendar, and torn-page emergency interrupt).
- **Rationale**: Distinctive, tangible, non-templated visual identity grounded in patient-held personal health record books commonly used in chronic care management across Kenya. All elements are bound to real logic data (no dummy placeholders).

---

## 6. Official Product Name Change — TunzaCare
- **Date**: August 23, 2026
- **Decision**: Official shipped product name changed from **ENDELEA** (working title) to **TunzaCare**.
- **Rationale**: Bilingual blend — *"Tunza"* (Swahili: to nurture, care for, look after) + *"Care"* (English). Reads naturally in both Kenyan languages while preserving the nurturing, longitudinal continuity relationship established in v1. Historical build documents retain ENDELEA as their working reference.

---

## 7. Responsive & Cross-Device Architecture
- **Date**: August 23, 2026
- **Tier 1 (Phone, 360–430px)**: Single-page personal health record book. Features touch targets $\ge 44\text{px}$ (stamp button, navigation tabs, toggle switches) and non-overlapping right-edge signature tabs.
- **Tier 2 (Tablet & Desktop, $\ge 700\text{px}$)**: Open Notebook Two-Page Spread. Rather than stretching a mobile phone or floating an isolated card, the interface leans into the physical metaphor by rendering facing pages side-by-side:
  - *Spine Gutter*: Stitched spine and binding holes run down the center divider between left and right pages.
  - *Context Pairings*: Left page shows primary active context (Home, Log Reading, Settings) while Right page shows The Ledger (historical trends and readings log for immediate context).
  - *Emergency Invariant (Rule 3)*: Emergency Alert and Escalation screens render as centered, full-attention single pages, never diluted by a facing page.
- **Tier 3 (Cross-Platform & Ecosystem Boundaries)**:
  - *PWA Installability*: Zero-store web application installable on Android and iOS devices, capable of complete offline execution.
  - *Native Wrapper (Capacitor)*: Deferred strategic option for future app-store distribution if required.
  - *Feature Phones / USSD*: Formally acknowledged as an architectural boundary. Basic non-smartphone users in Kenya require an independent SMS/USSD triage pipeline; responsive CSS cannot bridge hardware-level capability gaps.
