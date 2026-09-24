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
3. Confirm → adaptive red-flag checklist → **AI asks adaptive follow-up questions** (patient answers Yes/No) → **Demo: Sita Devi** demo-fill → *Known patient matched — previous visits found* (continuity!)
4. **Consent checkbox** (DPDP-style) → submit → **AI triage: HIGH** — red flag, 93% confidence → **Escalate**
5. **Emergency console** — Verify Evidence → Escalate to Doctor → Start Referral → escalation timeline completes
6. **Doctor dashboard** — case in queue → Review → longitudinal record shows Aug lab (Hb 10.2), June hospital visit → generate the **AI clinical summary** + see the **consent register**
7. **Document intelligence** — scan CBC report (or upload a real photo → vision OCR) → fields extracted → **Human validation** with **AI consistency check** → confirm → record updated
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
│   └── api/                  # REST API routes (all mutations JWT-guarded + RBAC-checked)
│       ├── bootstrap/        #   GET  — full demo dataset (auto-seeds on first run)
│       ├── auth/             #   POST login (JWT cookie) · GET session · POST logout
│       ├── intake/           #   POST — consent-gated patient + visit + deterministic AI triage
│       ├── ai/extract/       #   POST — multilingual symptom extraction (deterministic NLP)
│       ├── ai/triage/        #   POST — rules engine + optional LLM narrative (fallback safe)
│       ├── ai/interview/     #   POST — adaptive interview: next question from what's known
│       ├── ai/consistency/   #   POST — contradiction detection (symptoms ↔ docs ↔ record)
│       ├── ai/summary/       #   POST — fact-only clinical record summary (LLM polish, safe fallback)
│       ├── documents/        #   POST — vision OCR (real, from photo) or template;  /validate — human validation
│       ├── timeline/         #   GET  — merged clinical timeline (?patientId=…)
│       ├── consent/withdraw/ #   POST — withdraw kiosk consent (auditable artifact)
│       ├── referrals/        #   POST/PATCH — create + facility status workflow
│       ├── diagnostics/      #   POST/PATCH — order + workflow + demo results
│       ├── followups/        #   PATCH — contact/reschedule/complete/escalate
│       ├── visits/           #   PATCH — escalate/validate/complete (auto follow-up on escalate)
│       ├── demo/reset/       #   POST — instant demo reset (ADMIN only)
│       └── fhir/             #   GET  — FHIR R4 Bundle export (?patientId=…)
├── components/medikiosk/
│   ├── AppShell.tsx          # Header (session/lang/search/offline/a11y/demo) + sticky footer
│   ├── auth/SignInDialog.tsx # JWT sign-in dialog (kiosk auto-session + staff PINs)
│   ├── shared.tsx            # Shared primitives (badges, stat cards, banners…)
│   ├── journey/              # Kiosk home, intake (+ adaptive interview), triage (+ read-aloud), emergency
│   ├── records/              # Document scan (photo upload), validation (+ AI consistency), patient record (+ AI summary, consent), global search
│   ├── care/                 # Referrals, diagnostics, medicines, follow-ups
│   └── dashboards/           # Doctor, facility, network map, audit, demo mode + guide
└── lib/
    ├── store.ts              # Zustand — navigation, JWT session, offline queue, mutations
    ├── ai-engine.ts          # Rules engine + adaptive interview + contradiction detection + summaries + vision OCR
    ├── auth.ts               # HS256 JWT (node:crypto) + RBAC permission matrix
    ├── crypto.ts             # AES-256-GCM field encryption + blind index
    ├── types.ts              # Shared contracts
    ├── i18n.ts               # en / hi / bn dictionaries
    ├── api-client.ts         # Offline queue (localStorage) + sync replay + 401 handling
    ├── audio.ts              # Multilingual TTS via speech synthesis (works offline)
    ├── demo-scenarios.ts     # The 6 guided judge scenarios
    ├── format.ts             # Dates, numbers, labels
    ├── server-data.ts        # Prisma mappers, audit logging, demo clock
    ├── seed.ts               # Fictional SIH demo dataset (demo clock: 23 Sep 2026)
    ├── fhir.ts               # FHIR R4 / ABDM-aligned bundle mapper (ABHA identifiers)
    ├── db.ts                 # Prisma client singleton
    └── utils.ts              # cn() and small helpers
```

Every mutation returns the full refreshed dataset (`{ok, data}`) so the UI is always consistent — appropriate for demo-scale data.

### API quick reference (verified contracts)

| Endpoint | Method | Body / Query |
|---|---|---|
| `/api/bootstrap` | GET | — (seeds on first call) |
| `/api/auth/login` | POST | `{ role, pin? }` → sets `mk_session` httpOnly JWT cookie (kiosk needs no PIN) |
| `/api/auth/session` | GET | — → current session or 401 |
| `/api/auth/logout` | POST | — clears cookie |
| `/api/ai/extract` | POST | `{ text, language? }` |
| `/api/ai/triage` | POST | `{ symptoms[], durationDays?, severity?, age, conditions[] }` |
| `/api/ai/interview` | POST | `{ symptoms[], severity, asked[] }` → next adaptive question or `{ done: true }` |
| `/api/ai/consistency` | POST | `{ patientId, documentId? }` → contradiction findings (CRITICAL/WARNING/INFO) |
| `/api/ai/summary` | POST | `{ patientId }` → fact-only clinical summary |
| `/api/intake` | POST | `{ name, age, gender, phone, chiefComplaint, symptoms[], durationDays?, severity?, conditions[], allergies[], medications[], consent: true, abhaId?, interviewAnswers?, clientRef? }` — **401 without session, 400 without consent** |
| `/api/documents` | POST | `{ patientId, kind, fileName?, imageDataUrl? }` — with image → vision OCR, without → template |
| `/api/documents/validate` | POST | `{ id, action: ACCEPT (or VALIDATE) \| REJECT, editedExtracted?, validatedBy? }` — one-time validation (409 on re-validation) |
| `/api/referrals` | POST / PATCH | POST: `{ patientId, reason, destination, priority?, origin? }` · PATCH: `{ id, status, by?, note? }` — terminal states locked |
| `/api/diagnostics` | POST / PATCH | POST: `{ patientId, testType, orderedBy? }` · PATCH: `{ id, status }` — REVIEWED requires a result — **doctor/admin only** |
| `/api/followups` | PATCH | `{ id, status, by?, notes?, nextDue? }` |
| `/api/visits` | PATCH | `{ id, status, … }` — frontline/doctor/admin |
| `/api/consent/withdraw` | POST | `{ patientId }` — frontline/admin; marks latest consent withdrawn |
| `/api/timeline` | GET | `?patientId=…` → merged chronological clinical events |
| `/api/demo/reset` | POST | — **ADMIN only (403 otherwise)** |
| `/api/fhir` | GET | `?patientId=…` → FHIR R4 document Bundle (Composition + resources) |

**RBAC matrix** (enforced server-side on every mutation): kiosk → intake + document scan · frontline → validate documents/visits, referrals, follow-ups · doctor → diagnostics + clinical updates · admin → everything + demo reset. Read-only GETs stay open (shared kiosk tablet).

## Technology Stack

**What the prototype runs on:**

- **Next.js 16** (App Router; Node.js REST API via Route Handlers) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **Lucide icons** — healthcare teal design system
- **Prisma ORM + SQLite** (document-style access patterns; Prisma's connector model maps 1:1 to MongoDB — see below)
- **Zustand** state management
- **z-ai-web-dev-sdk** (server-side only) — LLM narrative + **vision OCR** on real document photos, always with deterministic fallback
- **recharts** dashboards, **framer-motion** micro-interactions, **sonner** toasts

**Requested stack → what's implemented (honest capability map):**

| Requested | Status in this prototype |
|---|---|
| React.js / Next.js + Tailwind | **Implemented** — exactly this |
| Node.js + Express.js REST API | **Implemented** as Node.js REST API via Next.js Route Handlers (same runtime, one deployable; no separate Express process needed) |
| MongoDB | **Integration-ready** — Prisma + SQLite in the sandbox; the schema uses JSON-string document columns and Prisma supports `provider = "mongodb"` with the same models for production |
| Multilingual ASR | **Simulated** voice input (scripted multilingual transcripts); the extraction API behind it is real. Production: Bhashini/AI4Bharat |
| Multilingual TTS | **Implemented** — browser speech synthesis (hi-IN/bn-IN/en-IN), read-aloud on kiosk + triage results, works offline |
| LLM/NLP | **Implemented** — z-ai SDK for narrative/summary/OCR with deterministic fallback on every path |
| Medical Entity Extraction | **Implemented** — `/api/ai/extract` (multilingual symptom dictionary + duration parsing) |
| Adaptive Interview | **Implemented** — `/api/ai/interview` picks the next question from what's known; red-flag answers feed triage; Q&A stored on the visit |
| Red-Flag Detection | **Implemented** — deterministic rule engine (symptom red flags, pediatric/elderly/pregnancy rules) + adaptive probes; HIGH forces escalation workflow |
| Contradiction Detection | **Implemented** — `/api/ai/consistency` cross-checks stated symptoms vs transcript negations vs scanned documents vs recorded allergies/medications |
| Clinical Summarization | **Implemented** — `/api/ai/summary` fact-only record summary (LLM polish, facts never invented) |
| OCR / Prescription & Report Extraction | **Implemented (real AI)** — upload a photo of a document → vision model reads the actual image into structured fields (fallback: simulated template) + human validation workflow |
| Clinical Timeline Generation | **Implemented** — merged chronological timeline in the record view + `/api/timeline` endpoint |
| Referral Workflow / Queue Mgmt / Follow-ups / Diagnostic Coordination / Medicine Availability | **Implemented** — full workflows with dashboards |
| FHIR R4 | **Implemented** — R4 document Bundle export (Composition, Patient, Encounter, Observation, MedicationRequest, ServiceRequest, Task, DocumentReference) |
| ABDM-compatible architecture | **Integration-ready** — ABHA address field on patients + FHIR identifier mapping; consent artifacts + audit trail align with ABDM consent-manager patterns; **not** a registered HIP connection |
| JWT / RBAC | **Implemented** — HS256 JWT (node:crypto) in httpOnly cookie, server-enforced permission matrix per route/role, 401/403 surfaced via sign-in dialog |
| Encryption | **Implemented** — AES-256-GCM at-rest encryption of patient phone numbers + HMAC blind index for continuity match without decryption |
| Consent | **Implemented** — DPDP-style consent checkbox at intake, stored consent artifacts, withdrawable (frontline/admin), audited |
| Audit Logs | **Implemented** — every action (intake, triage, validation, sync, consent, sessions) recorded with actor/role/time |
| Offline-tolerant workflow; local queue; sync on reconnect | **Implemented** — localStorage action queue, optimistic UI, replay on reconnect with per-record success/failure accounting |
| 108 ambulance dispatch, SMS, real ABDM/HIP registration | **Simulated / out of scope** (clearly labelled in the UI) |

## Demo Credentials (JWT sessions)

Kiosk devices auto-authenticate in the **KIOSK** role (no PIN). Elevated roles sign in via the header → *Sign in as staff* (demo PINs shown in the dialog):

| Role | Identity | Demo PIN |
|---|---|---|
| Kiosk · Patient | Kiosk Device (auto-session) | — none — |
| Frontline Worker | ANM Sunita Sharma (Rampur Sub-Centre) | `1234` |
| Doctor | Dr. A. Prasad (Gopalganj District Hospital) | `2345` |
| Facility Administrator | Facility Admin (reset, full admin) | `3456` |

## Mock Integrations (clearly identified)

| Capability | Status |
|---|---|
| Intake, triage rules, adaptive interview, contradiction detection, summaries, records, referrals, diagnostics, follow-ups, dashboards, offline queue, audit, JWT/RBAC, consent, field encryption | **Implemented** (working end-to-end) |
| Voice input (ASR) | **Simulated** — scripted listening/typing UX (Web Speech API can be added; the extraction API is real) |
| OCR from document photos | **Real AI** (vision model) with a simulated template fallback; validation workflow is human |
| TTS read-aloud | **Implemented** — browser speech synthesis, multilingual, offline-capable |
| 108 ambulance dispatch | **Simulated** dialog |
| LLM narrative / summary / vision OCR | **Optional** — z-ai-web-dev-sdk with deterministic fallback; never decides safety |
| FHIR R4 | **Implemented** export (demo abstraction) |
| ABDM / ABHA | **Integration-ready** — ABHA identifier mapping + consent artifacts + audit; **not** a registered ABDM/HIP connection |
| SMS, real pharmacy ordering, real lab HL7 feeds, ABDM M1–M3 registration | **Out of scope for prototype** |

## Production Requirements (beyond this prototype)

- Replace demo PIN identities with hashed credentials + MFA; facility-scoped data access policies
- Real ASR (Indic languages, e.g. Bhashini/AI4Bharat models) alongside the implemented TTS
- Registered ABDM M1/M2/M3 integration (HIP/SRC credentials, consent manager) — the consent artifact model is already aligned
- Hospital information system / lab integration (HL7 v2 / FHIR APIs)
- MongoDB (or PostgreSQL) deployment — Prisma models carry over; JSON columns map to document fields
- Conflict-aware sync (server reconciles clientRefs, per-record merge)
- Managed key rotation for the AES-256-GCM field encryption; DPIA + data-locality compliance under DPDP Act
- HTTPS-only deployment (enable the `secure` cookie flag) + rate limiting on auth endpoints
