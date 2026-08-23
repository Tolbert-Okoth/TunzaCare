# 04 — Ordered Build Queue (TODO)

> **Notice**: Official product name changed from ENDELEA to **TunzaCare** — see [`docs/DECISIONS.md`](docs/DECISIONS.md).
> **Execution Tracker**: Follow this checklist strictly in sequence. Mark tasks `[x]` upon verified completion.

---

## Phase 0: Project Setup & Foundational Documents
- [x] Create `00_PROJECT_BRIEF.md` (Scope, Kenya NCD cascade data, adherence failure mode, v1 boundaries)
- [x] Create `01_DATA_SOURCES.md` (Every clinical cutoff, emergency threshold, refill timeline, unit conversions)
- [x] Create `02_AGENTS_RULES.md` & copy to `AGENTS.md` (7 non-negotiable governance rules)
- [x] Create `03_ARCHITECTURE.md` (Local-first architecture, escalation module isolation, data schemas)
- [x] Create `04_TODO.md` (This build queue)
- [x] Create `05_DESIGN_MOCKUP.html` (Mobile-first responsive reference layout)
- [x] Create `06_DEFINITION_OF_DONE.md` (Exit criteria and acceptance benchmarks)
- [x] Create `07_SELF_PROMPT_LOOP.md` (Self-auditing QA loop)
- [x] Create `/docs/DECISIONS.md` (Architecture decision log & escalation transport note)
- [x] Create `package.json` with Node.js test runner configuration (`node --test`)

---

## Phase 1: Clinical Config & Core Logic Modules
- [x] Create `src/data/clinical_thresholds.json` (Single source of truth for all numerical constants)
- [x] Create `src/storage/store.js` (Local-first persistence engine with memory fallback for test environments)
- [x] Create `src/logic/readings.js` (Immutable reading entry, dual-output display band & emergency evaluation)
- [x] Create `src/logic/adherence.js` (Daily check-in recorder, 80% adherence rate calculator, max(7d, 20%) refill countdown)
- [x] Create `src/logic/education.js` (Contextual micro-education rule engine with topic-level state tracking)
- [x] Create `src/escalation/escalation.js` (Isolated silent-dropout state machine & minimal signal generator)

---

## Phase 2: Isolated Escalation Subsystem
- [x] Enforce isolation in `/src/escalation/` (sole outbound chokepoint `sendEscalationTrigger`)
- [x] Implement `composeEscalationMessage` (display name only, zero health data)
- [x] Implement offline queue-and-retry mechanism for dropped connections
- [x] Enforce informed consent UI order (message template preview shown before toggle can be enabled)

---

## Phase 3: Bilingual Dictionaries & Language Engine
- [x] Create `src/i18n/en.json` (Complete English language bundle)
- [x] Create `src/i18n/sw.json` (Culturally grounded Kenyan Kiswahili bundle with 100% 1:1 key parity)
- [x] Create `src/i18n/i18n.js` (Lookup engine with interpolation, fallback, and language switching)

---

## Phase 4: Mobile-First Patient Interface
- [x] Create `src/ui/index.html` (Semantic HTML5 shell matching `05_DESIGN_MOCKUP.html`)
- [x] Create `src/ui/styles.css` (Accessible, high-contrast, responsive Kenyan health palette with Lora + Inter typography)
- [x] Create `src/ui/app.js` (State orchestrator, tab navigation, reactive re-rendering, interactive SVG charts, modal handling)
- [x] Implement Hard Emergency Modal (blocking, non-auto-dismissible, explicit acknowledgment required)
- [x] Implement Opt-In Escalation Setup & Simulation Sandbox
- [x] Implement Settings Screen (Documented Addition: Profile nickname update, language toggle, refill management, and local-only client-side JSON Data Export via in-memory Blob)

---

## Phase 5: Testing & QA (23/23 Passing)
- [x] Create `tests/core_logic.test.js` (Immutable logs, dual alert level, 80% adherence proxy, refill max(7, 20%), 5d/7d escalation trigger)
- [x] Create `tests/boundary_clinical.test.js` (80% adherence boundary, BP bands, BP emergency, glucose bands, and explicit glucose nudge vs emergency boundaries)
- [x] Create `tests/emergency_invariant.test.js` (Rule 3 un-dismissible emergency modal invariant)
- [x] Create `tests/escalation_privacy.test.js` (Rule 4 fresh profile defaults to disabled, zero health data assertion, offline queue-and-retry, late check-in cancellation)
- [x] Create `tests/i18n.test.js` (1:1 dictionary key symmetry and non-shaming copy audit)
- [x] Create `tests/adversarial.test.js` (Extreme vitals, same-day duplicate check-in overwrite, depleted prescriptions, bidirectional unit precision)

---

## Phase 6: Wrap-up & Documentation
- [x] Update `/docs/DECISIONS.md`
- [x] Create `/docs/SESSION_SUMMARY.md`
- [x] Compile `walkthrough.md`
