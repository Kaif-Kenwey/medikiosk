# MediKiosk

**AI-Assisted Rural Healthcare Access & Continuity Platform**

> **AI assists. Healthcare professionals decide.**
> This prototype provides AI-assisted workflow support. It does not replace professional medical judgment, diagnosis, or treatment.

MediKiosk is our solution for **SIH26133 — Accessibility and quality of public healthcare services, particularly in rural and underserved areas** (Smart India Hackathon 2026 · Team **Void Reapers** · Team ID **127945**).

---

## The Idea

Walk into a government sub-centre in a village like Rampur (Gopalganj, Bihar) and you will usually find a single ANM (frontline health worker), a register made of paper, and a queue of people who walked kilometres to get there. The system around her has three compounding gaps:

| Gap | What it looks like on the ground | MediKiosk's answer |
|---|---|---|
| **Access** | Patients can't read forms, don't speak English, can't describe symptoms to a stranger | A **kiosk that talks** — voice-first intake in Hindi/Bengali/English, huge touch targets, audio guidance, high-contrast mode. If a patient can speak, they can use it |
| **Safety** | Red-flag symptoms (breathlessness, pregnancy danger signs) sit in a queue because nobody recognised them | A **deterministic rules engine** screens every intake against emergency criteria and forces an escalation workflow when a red flag matches — with a human verifying every step |
| **Continuity** | Paper records never travel; the district hospital has no idea a patient was seen at the sub-centre | **One longitudinal record per patient** — every visit, lab, medicine, referral and follow-up attached to one identity, exportable as FHIR R4 (ABDM-aligned) |

The core design principle: **AI does the paperwork, humans do the medicine.** Every AI output — extracted symptoms, triage level, OCR'd lab values — is labelled as an assist and requires explicit human validation before it enters the medical record. The triage engine is deliberately deterministic (rule-based, auditable, explainable) rather than a black-box model, because in a safety-critical setting "why did it flag this?" must always have an answer.

### The patient journey, end to end

```
 A patient speaks to the kiosk in Hindi
   → AI extracts symptoms + duration + red-flag suspects (patient confirms each one)
   → Deterministic rules engine scores triage: LOW / MEDIUM / HIGH
   → HIGH? Escalation console: worker verifies → doctor notified → referral initiated
     → 108 ambulance dialog → hospital receives patient → 48h high-risk follow-up auto-created
   → Routine? Frontline worker validates the AI extraction and completes the consult
   → Everything lands in ONE record: visits, labs, medicines, documents, referrals, notes
   → Doctor sees a prioritised queue · Admin sees facility outcomes · Referrals tracked
     across Sub-Centre → PHC → Rural Hospital → District Hospital
```

No login walls, no English forms, no paper register — and no AI making autonomous medical decisions anywhere in the loop.

## What's Inside

- **Kiosk mode** — large touch targets, English / हिन्दी / বাংলা, audio guidance, text-size control, high-contrast mode
- **Voice intake simulation** — listening UI → Hindi/English/Bengali transcript → AI extraction of symptoms, duration and red-flag suspects; the patient confirms before anything is saved
- **AI-assisted triage** — deterministic clinical rules engine flags emergencies; output is always labelled *"AI-assisted risk flag — requires human review"*; AI never diagnoses
- **Red-flag emergency flow** — full escalation timeline (Detected → Verified → Healthcare Worker Notified → Referral Initiated → Hospital Received) with auto-created referral and auto-created 48h high-risk follow-up
- **Document intelligence** — scan prescription/lab report/prior record; OCR simulation extracts fields with confidence + source; nothing enters the record until a human validates it
- **Longitudinal patient record** — visits, symptoms, AI summaries, validated labs, medications, documents, referrals, follow-ups, clinical notes + **FHIR R4 export** (ABDM-aligned abstraction)
- **Referral management** — facility ladder with live status tracker (Pending → Accepted → In Transit → Arrived → Consultation → Completed) and full history log
- **Diagnostic coordination** — order → sample → processing → result → doctor review; results flow into the record
- **Medicine availability** — facility-level stock visibility with alternative-facility suggestions (visibility only — no ordering)
- **High-risk follow-up board** — maternal / child / chronic / high-risk / missed categories with contact, reschedule, escalate, complete actions
- **Offline-first demo** — "Simulate Offline Mode" queues intake and actions locally (localStorage), shows pending-sync state, and replays them with **Sync Now**; records the server rejects are reported as failed, never silently dropped
- **Doctor dashboard** — prioritised queue, waiting time, pending reviews, diagnostics awaiting review
- **Facility dashboard** — patients served, referral completion, follow-up completion %, medicine alerts, red-flag escalation alerts + charts (recharts)
- **Care network map** — animated referral flow across the facility ladder
- **Audit trail** — every AI action, human validation, referral and sync event is logged
- **Demo mode** — 6 guided judge scenarios + one-click **Reset Demo**

## Running Locally

**Prerequisites:** [Bun](https://bun.sh) (or Node 20+ with a compatible package manager). No API keys, no accounts, no external services.

```bash
# 1 — install dependencies
bun install

# 2 — configure the database path
cp .env.example .env

# 3 — create the SQLite schema
bun run db:push

# 4 — start the dev server
bun run dev          # → http://localhost:3000
```

**First run:** open `http://localhost:3000`. The demo dataset (5 patients, visits, referrals, lab history, medicine stock) **seeds automatically on first load** — there is no seed command to run.

**If the facility server is unreachable at load time**, the app retries automatically, falls back to the last dataset cached on the device, and — if nothing is cached — shows an explicit connection screen with a retry button. A rendering error in any screen shows a recovery card, never a blank page.

**Reset everything:** `Demo Mode → Reset Demo` (or `POST /api/demo/reset`) instantly restores the pristine demo dataset.

### Environment Variables

```
DATABASE_URL="file:../db/custom.db"   # SQLite (Prisma) — relative to prisma/schema.prisma
```

That's the only variable. The optional LLM narrative path runs server-side only and degrades gracefully to deterministic output when no model access is configured.

## Guided Tour — explore it the way each role would

No login required: switch roles from the header menu (a demo feature).

| Role (header menu) | Lands on | What to try |
|---|---|---|
| **Kiosk · Patient** | Kiosk home | Choose **हिन्दी** → *Start Healthcare Assistance* → tap the **mic** → confirm AI-extracted symptoms → answer the red-flag checklist → demo-fill as **Sita Devi** (known patient — watch continuity kick in) |
| **Frontline Worker** | Intake flow | Validate AI extractions, scan a CBC report (Document intelligence) → **validate** the OCR'd fields, review the follow-up board |
| **Doctor** | Doctor dashboard | Open the prioritised queue → review Sita Devi's longitudinal record → review diagnostics awaiting sign-off |
| **Facility Administrator** | Facility dashboard | Live metrics + charts, medicine stock alerts, network map of referral flows, full audit trail |

### Judging script (3–5 minutes)

1. **Kiosk** → choose **हिन्दी** → *Start Healthcare Assistance*
2. Tap the **mic** — "listening" → Hindi transcript types out → AI extracts **Fever + Difficulty breathing, 3 days**
3. Confirm → adaptive red-flag checklist → **Demo: Sita Devi** demo-fill → *Known patient matched — previous visits found* (continuity!)
4. **AI triage: HIGH** — red flag, 93% confidence → **Escalate**
5. **Emergency console** — Verify Evidence → Escalate to Doctor → Start Referral → escalation timeline completes
6. **Doctor dashboard** — case in queue → Review → longitudinal record shows Aug lab (Hb 10.2), June hospital visit
7. **Document intelligence** — scan CBC report → OCR extracts 6 fields → **Human validation** → confirm → record updated
8. **Diagnostics** — CBC ordered → result attached → reviewed into record
9. **Medicines** — check Metformin: OUT at Sub-Centre, alternative facility shown
10. **Follow-ups** — auto-created HIGH-RISK task due 25 Sep
11. **Facility dashboard** — urgent alert, live metrics, charts
12. **Offline → Sync** — simulate offline, capture a record, reconnect, **Sync Now** ✓
13. Or open **Demo Mode** for the 6 guided scenarios + instant **Reset Demo**

### The 6 guided demo scenarios

| # | Scenario | Shows |
|---|---|---|
| 1 | Routine patient | Low-friction multilingual intake → MEDIUM triage → worker completes consult |
| 2 | **Emergency / red-flag (HERO)** | Voice → HIGH triage → escalation timeline → referral → auto follow-up |
| 3 | Referral journey | Facility ladder, status workflow, history log |
| 4 | Offline → Sync | Queue locally while "offline", replay on reconnect |
| 5 | Document OCR → Human validation | Simulated scan → confidence-scored fields → human approves into record |
| 6 | High-risk follow-up | Maternal/chronic/missed task board with actions |

## Architecture

Single-page App Router app: **only `/` is user-visible**; the 16 views (kiosk, intake, triage, emergency, documents, validation, record, referrals, diagnostics, medicines, followups, doctor, facility, network, audit, demo) are switched client-side by a Zustand router.

```
src/
├── app/
│   ├── page.tsx              # Single visible route: client-side view router (16 views)
│   └── api/                  # REST API routes
│       ├── bootstrap/        #   GET  — full demo dataset (auto-seeds on first run)
│       ├── intake/           #   POST — patient + visit + deterministic AI triage
│       ├── ai/extract/       #   POST — multilingual symptom extraction (deterministic NLP)
│       ├── ai/triage/        #   POST — rules engine + optional LLM narrative (fallback safe)
│       ├── documents/        #   POST — simulated OCR;  /validate — human validation
│       ├── referrals/        #   POST/PATCH — create + facility status workflow
│       ├── diagnostics/      #   POST/PATCH — order + workflow + demo results
│       ├── followups/        #   PATCH — contact/reschedule/complete/escalate
│       ├── visits/           #   PATCH — escalate/validate/complete (auto follow-up on escalate)
│       ├── demo/reset/       #   POST — instant demo reset
│       └── fhir/             #   GET  — FHIR R4 Bundle export (?patientId=…)
├── components/medikiosk/
│   ├── AppShell.tsx          # Header (role/lang/search/offline/a11y/demo) + sticky footer
│   ├── shared.tsx            # Shared primitives (badges, stat cards, banners…)
│   ├── journey/              # Kiosk home, intake, triage, emergency
│   ├── records/              # Document scan, validation, patient record, global search
│   ├── care/                 # Referrals, diagnostics, medicines, follow-ups
│   └── dashboards/           # Doctor, facility, network map, audit, demo mode + guide
└── lib/
    ├── store.ts              # Zustand — navigation, roles, offline queue, mutations
    ├── ai-engine.ts          # Deterministic rules engine + simulated OCR + LLM fallback
    ├── types.ts              # Shared contracts
    ├── i18n.ts               # en / hi / bn dictionaries
    ├── api-client.ts         # Offline queue (localStorage) + sync replay
    ├── audio.ts              # Kiosk audio guidance (speech synthesis)
    ├── demo-scenarios.ts     # The 6 guided judge scenarios
    ├── format.ts             # Dates, numbers, labels
    ├── server-data.ts        # Prisma mappers, audit logging, demo clock
    ├── seed.ts               # Fictional SIH demo dataset (demo clock: 23 Sep 2026)
    ├── fhir.ts               # FHIR R4 / ABDM-aligned bundle mapper
    ├── db.ts                 # Prisma client singleton
    └── utils.ts              # cn() and small helpers
```

Every mutation returns the full refreshed dataset (`{ok, data}`) so the UI is always consistent — appropriate for demo-scale data.

### API quick reference (verified contracts)

| Endpoint | Method | Body / Query |
|---|---|---|
| `/api/bootstrap` | GET | — (seeds on first call) |
| `/api/ai/extract` | POST | `{ text, language? }` |
| `/api/ai/triage` | POST | `{ symptoms[], durationDays?, severity?, age, conditions[] }` |
| `/api/intake` | POST | `{ name, age, gender, phone, chiefComplaint, symptoms[], durationDays?, severity?, conditions[], allergies[], medications[], clientRef? }` |
| `/api/documents` | POST | `{ patientId, type, label? }` |
| `/api/documents/validate` | POST | `{ id, action: ACCEPT (or VALIDATE) \| REJECT, editedExtracted?, validatedBy? }` — one-time validation (409 on re-validation) |
| `/api/referrals` | POST / PATCH | POST: `{ patientId, reason, destination, priority?, origin? }` · PATCH: `{ id, status, by?, note? }` — terminal states locked |
| `/api/diagnostics` | POST / PATCH | POST: `{ patientId, testType, orderedBy? }` · PATCH: `{ id, status }` — REVIEWED requires a result |
| `/api/followups` | PATCH | `{ id, status, by?, notes?, nextDue? }` |
| `/api/visits` | PATCH | `{ id, status, … }` |
| `/api/demo/reset` | POST | — |
| `/api/fhir` | GET | `?patientId=…` → FHIR R4 document Bundle (Composition + resources) |

## Technology Stack

- **Next.js 16** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **Lucide icons** — healthcare teal design system
- **Prisma ORM + SQLite**
- **Zustand** state management
- **recharts** dashboards, **framer-motion** micro-interactions, **sonner** toasts
- **z-ai-web-dev-sdk** (server-side only) — optional LLM narrative enrichment with deterministic fallback

## Demo Credentials

No login — role switching is a demo feature (header menu):

| Role | Identity |
|---|---|
| Kiosk · Patient | Self-service (Sita Devi / Rahul Kumar demo-fills in intake) |
| Frontline Worker | ANM Sunita Sharma (Rampur Sub-Centre) |
| Doctor | Dr. A. Prasad (Gopalganj District Hospital) |
| Facility Administrator | Admin view (Rampur PHC) |

## Mock Integrations (clearly identified)

| Capability | Status |
|---|---|
| Intake, triage rules, records, referrals, diagnostics, follow-ups, dashboards, offline queue, audit | **Implemented** (working end-to-end) |
| Voice input | **Simulated** — scripted listening/typing UX (Web Speech API can be added; extraction API is real) |
| OCR / document scan | **Simulated** — deterministic template extraction; validation workflow is real |
| 108 ambulance dispatch | **Simulated** dialog |
| LLM narrative | **Optional** — z-ai-web-dev-sdk with deterministic fallback; never decides safety |
| FHIR R4 / ABDM | **Integration-ready abstraction** — internal JSON model maps to FHIR resources (Patient, Encounter, Observation, MedicationRequest, ServiceRequest, Task, DocumentReference); **not** a live ABDM/HIP connection |
| ABHA / health-ID auth, SMS, real pharmacy ordering, real lab HL7 feeds | **Out of scope for prototype** |

## Production Requirements (beyond this prototype)

- NextAuth/JWT-backed RBAC replacing the demo role switcher; facility-scoped data access
- Real ASR (Indic languages, e.g. Bhashini/AI4Bharat models) and TTS
- Registered ABDM M1/M2/M3 integration (HIP/SRC credentials, consent manager)
- Hospital information system / lab integration (HL7 v2 / FHIR APIs)
- Conflict-aware sync (server reconciles clientRefs, per-record merge)
- Postgres/MySQL, encryption at rest, DPIA + data-locality compliance under DPDP Act
