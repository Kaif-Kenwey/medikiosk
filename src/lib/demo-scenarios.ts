// ============================================================
// MediKiosk — Demo scenarios for the judge walkthrough
// Each scenario = ordered steps; the floating Demo Guide highlights
// the next step and can navigate directly to it.
// ============================================================

import type { View } from "@/lib/types"

export interface ScenarioStep {
  view: View
  label: string
  hint: string
}

export interface Scenario {
  id: string
  icon: string
  title: string
  description: string
  steps: ScenarioStep[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: "routine",
    icon: "🩺",
    title: "Scenario 1 — Routine patient",
    description: "Low-risk intake flows to routine OPD care.",
    steps: [
      { view: "kiosk", label: "Start at kiosk", hint: "Tap 'Start Healthcare Assistance'." },
      { view: "intake", label: "Intake (routine)", hint: "Use demo-fill: Rahul Kumar — routine BP follow-up." },
      { view: "triage", label: "AI triage — LOW/MEDIUM", hint: "Routine presentation → routine OPD workflow." },
      { view: "doctor", label: "Doctor queue", hint: "Routine patient appears in the OPD queue." },
      { view: "record", label: "Longitudinal record", hint: "Open record — see one continuous history." },
    ],
  },
  {
    id: "emergency",
    icon: "🚨",
    title: "Scenario 2 — Emergency / red-flag (HERO)",
    description: "The polished end-to-end hero journey: Sita Devi, fever + breathing difficulty.",
    steps: [
      { view: "kiosk", label: "1. Kiosk — choose हिन्दी", hint: "Select Hindi, then Start Healthcare Assistance." },
      { view: "intake", label: "2. Voice intake", hint: "Tap mic — Hindi transcript extracted into structured symptoms." },
      { view: "triage", label: "3. AI triage — HIGH", hint: "Red flags detected. AI flag requires human review." },
      { view: "emergency", label: "4. Red-flag alert", hint: "Frontline worker reviews evidence and escalates." },
      { view: "referrals", label: "5. Referral created", hint: "Escalation auto-creates referral → track status." },
      { view: "doctor", label: "6. Doctor reviews", hint: "Doctor opens case from high-priority queue." },
      { view: "record", label: "7. Longitudinal record", hint: "Previous lab (Hb 10.2) + June hospital visit visible." },
      { view: "documents", label: "8. Document intelligence", hint: "Scan CBC lab report → OCR extraction." },
      { view: "validation", label: "9. Human validation", hint: "Healthcare worker confirms AI-extracted fields." },
      { view: "diagnostics", label: "10. Diagnostics", hint: "Doctor requests CBC + Chest X-Ray; results flow back." },
      { view: "medicines", label: "11. Medicine availability", hint: "Check Paracetamol / Salbutamol stock across facilities." },
      { view: "followups", label: "12. Follow-up auto-created", hint: "High-risk follow-up task for 25 Sep." },
      { view: "facility", label: "13. Facility dashboard", hint: "Case reflected in metrics + urgent alerts." },
      { view: "demo", label: "14. Offline → Sync", hint: "Toggle offline, capture a record, sync back." },
    ],
  },
  {
    id: "referral",
    icon: "🚑",
    title: "Scenario 3 — Referral journey",
    description: "Sub-Centre → PHC → Rural Hospital → District Hospital continuity.",
    steps: [
      { view: "referrals", label: "Open referral tracker", hint: "Watch Ramesh Yadav's referral across facilities." },
      { view: "referrals", label: "Advance statuses", hint: "ACCEPTED → IN TRANSIT → ARRIVED → CONSULTATION → COMPLETED." },
      { view: "network", label: "Care network map", hint: "See the referral flow across the facility ladder." },
    ],
  },
  {
    id: "offline",
    icon: "📴",
    title: "Scenario 4 — Offline → Sync",
    description: "Care continues without connectivity; data syncs on reconnection.",
    steps: [
      { view: "kiosk", label: "Simulate offline", hint: "Toggle 'Simulate Offline Mode' from the header." },
      { view: "intake", label: "Capture intake offline", hint: "Complete an intake — marked 'Pending Sync'." },
      { view: "kiosk", label: "Reconnect & Sync Now", hint: "Press Sync — watch queued records synchronize." },
      { view: "audit", label: "Audit trail", hint: "Offline capture + sync events are logged." },
    ],
  },
  {
    id: "ocr",
    icon: "📄",
    title: "Scenario 5 — Document OCR → Human validation",
    description: "AI extracts, human validates — nothing enters the record unverified.",
    steps: [
      { view: "documents", label: "Scan lab report", hint: "Upload/scan a CBC report — OCR extracts fields." },
      { view: "validation", label: "Review extractions", hint: "Accept / Edit / Reject each AI-extracted field." },
      { view: "record", label: "Added to record", hint: "Validated values appear in the longitudinal record." },
    ],
  },
  {
    id: "followup",
    icon: "🔔",
    title: "Scenario 6 — High-risk follow-up",
    description: "No patient falls through the cracks — maternal & chronic care follow-up.",
    steps: [
      { view: "followups", label: "Follow-up board", hint: "Asha Kumari — maternal ANC due 25 Sep (HIGH)." },
      { view: "followups", label: "Contact → Reschedule", hint: "Frontline worker actions update status." },
      { view: "facility", label: "Follow-up completion", hint: "Dashboard shows completion rate & pending tasks." },
    ],
  },
]

export const HERO_SCENARIO = "emergency"
