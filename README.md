# MediKiosk

**AI-Assisted Rural Healthcare Access & Continuity Platform**

MediKiosk turns a kiosk in a rural sub-centre into an accessible, multilingual, voice-first front door to the public health system — then keeps every patient connected to one continuous record across Sub-Centre → PHC → Rural Hospital → District Hospital.

> **AI assists. Healthcare professionals decide.**
> This prototype provides AI-assisted workflow support and does not replace professional medical judgment, diagnosis, or treatment.

---

## Problem Statement

**SIH26133 — Accessibility and quality of public healthcare services, particularly in rural and underserved areas.**
Team **Void Reapers** · Team ID **127945** · Smart India Hackathon 2026

## Solution

Rural patients face three compounding gaps: **access** (language, literacy, distance), **safety** (missed red flags), and **continuity** (paper records that never follow the patient). MediKiosk addresses all three in one connected workflow:

```
PATIENT/FRONTLINE WORKER
    → Accessible digital intake (voice + multilingual + offline)
    → AI-assisted history + triage (deterministic red-flag rules)
    → Document intelligence (simulated OCR, never auto-trusted)
    → Human validation (healthcare worker confirms every AI extraction)
    → Longitudinal patient record (one patient, one history)
    → Referral / diagnostics / medicine visibility
    → Hospital consultation
    → High-risk follow-up (auto-created after escalation)
    → Facility quality dashboard (operational outcomes)
```

## Key Features

- **Kiosk mode** — large touch targets, English / हिन्दी / বাংলা, audio guidance, text-size control, high-contrast mode
- **Voice intake simulation** — listening UI → Hindi/English/Bengali transcript → AI extraction of symptoms, duration and red-flag suspects; patient confirms before anything is saved
- **AI-assisted triage** — deterministic clinical rules engine flags emergencies; output is always labelled *"AI-assisted risk flag — requires human review"*; AI never diagnoses
- **Red-flag emergency flow** — full escalation timeline (Detected → Verified → Worker Notified → Referral Initiated → Hospital Received) with auto-created referral and auto-created 48h high-risk follow-up
- **Document intelligence** — scan prescription/lab report/prior record; OCR simulation extracts fields with confidence + source; nothing enters the record until a human validates it
- **Longitudinal patient record** — visits, symptoms, AI summaries, validated labs, medications, documents, referrals, follow-ups, clinical notes + **FHIR R4 export** (ABDM-aligned abstraction)
- **Referral management** — facility ladder with live status tracker (Pending → Accepted → In Transit → Arrived → Consultation → Completed) and full history log
- **Diagnostic coordination** — order → sample → processing → result → doctor review, results flow into the record
- **Medicine availability** — facility-level stock visibility with alternative-facility suggestions (visibility only — no ordering)
- **High-risk follow-up board** — maternal / child / chronic / high-risk / missed categories with contact, reschedule, escalate, complete actions
- **Offline-first demo** — "Simulate Offline Mode" queues intake and actions locally (localStorage), shows pending-sync state, and replays them with **Sync Now**
- **Doctor dashboard** — prioritised queue, waiting time, pending reviews, diagnostics awaiting review
- **Facility dashboard** — patients served, referral completion, follow-up completion %, medicine alerts, red-flag escalation alerts + charts (recharts)
- **Care network map** — animated referral flow across the facility ladder
- **Audit trail** — every AI action, human validation, referral and sync event is logged
- **Demo mode** — 6 guided judge scenarios + one-click **Reset Demo**

## Architecture

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
│       └── fhir/             #   GET  — FHIR R4 Bundle export (ABDM-aligned abstraction)
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
    ├── server-data.ts        # Prisma mappers, audit logging, demo clock
    ├── seed.ts               # Fictional SIH demo dataset (demo clock: 23 Sep 2026)
    └── fhir.ts               # FHIR R4 / ABDM-aligned bundle mapper
```

Every mutation returns the full refreshed dataset (`{ok, data}`) so the UI is always consistent — appropriate for demo-scale data.

## Technology Stack

- **Next.js 16** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **Lucide icons** — healthcare teal design system
- **Prisma ORM + SQLite**
- **Zustand** state management
- **recharts** dashboards, **framer-motion** micro-interactions, **sonner** toasts
- **z-ai-web-dev-sdk** (server-side only) — optional LLM narrative enrichment with deterministic fallback

## Demo Flow (3–5 minutes, judging script)

1. **Kiosk** → choose **हिन्दी** → *Start Healthcare Assistance*
2. Tap the **mic** — "listening" → Hindi transcript typed out → AI extracts **Fever + Difficulty breathing, 3 days**
3. Confirm → adaptive red-flag checklist → **Demo: Sita Devi** demo-fill → *Known patient matched — previous visits found* (continuity!)
4. **AI triage: HIGH** — red flag, 93% confidence → **Escalate**
5. **Emergency console** — Verify Evidence → Escalate to Doctor → Start Referral → escalation timeline completes
6. **Doctor dashboard** — case in queue → Review → longitudinal record shows Aug lab (Hb 10.2), June hospital visit
7. **Document intelligence** — scan CBC report → OCR extracts 6 fields → **Human validation** → confirm → record updated
8. **Diagnostics** — CBC ordered → result attached → reviewed into record
9. **Medicines** — check Metformin: OUT at Sub-Centre, alternative facility shown
10. **Follow-ups** — auto-created HIGH-RISK task due 25 Sep
11. **Facility dashboard** — urgent alert, live metrics, charts
12. **Offline → Sync** — simulate offline, capture a record, reconnect, Sync Now ✓
13. Or open **Demo Mode** for the 6 guided scenarios + instant **Reset Demo**

## Demo Credentials

No login — role switching is a demo feature (header menu):

| Role | Identity |
|---|---|
| Kiosk · Patient | Self-service (Sita Devi / Rahul Kumar demo-fills in intake) |
| Frontline Worker | ANM Sunita Sharma (Rampur Sub-Centre) |
| Doctor | Dr. A. Prasad (Gopalganj District Hospital) |
| Facility Administrator | Admin view (Rampur PHC) |

## Running Locally

```bash
bun install
cp .env.example .env   # SQLite path (resolves relative to prisma/schema.prisma)
bun run db:push        # create the SQLite schema
bun run dev            # http://localhost:3000
```

The demo dataset seeds automatically on first load. `Demo Mode → Reset Demo` (or `POST /api/demo/reset`) restores it at any time.

## Environment Variables

```
DATABASE_URL="file:../db/custom.db"   # SQLite (Prisma) — relative to prisma/schema.prisma
```

No secrets or API keys are required or committed. The optional LLM narrative path runs server-side only and degrades gracefully to deterministic output when no model access is configured.

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
