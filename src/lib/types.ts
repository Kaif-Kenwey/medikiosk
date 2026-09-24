// ============================================================
// MediKiosk — Shared type contracts
// Used by client store, API routes and all UI modules.
// ============================================================

export type Language = "en" | "hi" | "bn"
export type Role = "kiosk" | "frontline" | "doctor" | "admin"

/** Client-side views (SPA — only `/` route is user visible) */
export type View =
  | "kiosk"
  | "intake"
  | "triage"
  | "emergency"
  | "documents"
  | "validation"
  | "record"
  | "referrals"
  | "diagnostics"
  | "medicines"
  | "followups"
  | "doctor"
  | "facility"
  | "network"
  | "audit"
  | "demo"

export type TriagePriority = "LOW" | "MEDIUM" | "HIGH"
export type ReferralPriority = "ROUTINE" | "URGENT" | "EMERGENCY"
export type SyncStatus = "SYNCED" | "PENDING"

export interface Patient {
  id: string
  mrn: string
  name: string
  nameHi: string | null
  age: number
  gender: string
  phone: string // decrypted for display — stored AES-256-GCM encrypted at rest
  phoneHash?: string | null
  abhaId: string | null // ABDM / ABHA address (INTEGRATION-READY)
  village: string
  district: string
  language: Language
  allergies: string[]
  conditions: string[]
  medications: string[]
  createdAt: string
}

export interface Visit {
  id: string
  patientId: string
  type: "KIOSK_INTAKE" | "PHC_VISIT" | "HOSPITAL_VISIT" | "FOLLOW_UP"
  facility: string
  chiefComplaint: string
  symptoms: string[]
  durationDays: number | null
  durationLabel: string | null
  severity: "MILD" | "MODERATE" | "SEVERE" | null
  triagePriority: TriagePriority | null
  redFlags: string[]
  aiSummary: string | null
  aiRecommendation: string | null
  status: "WAITING" | "TRIAGED" | "ESCALATED" | "IN_CONSULTATION" | "COMPLETED"
  frontlineWorker: string | null
  validatedBy: string | null
  clinicalNote: string | null
  interviewAnswers: InterviewAnswer[]
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

/** One adaptive-interview question + the patient's confirmed answer */
export interface InterviewAnswer {
  question: string
  answer: string
  at: string
}

export interface ReferralHistoryEntry {
  status: string
  at: string
  by: string
  note?: string
}

export interface Referral {
  id: string
  patientId: string
  visitId: string | null
  reason: string
  origin: string
  destination: string
  priority: ReferralPriority
  status:
    | "PENDING"
    | "ACCEPTED"
    | "IN_TRANSIT"
    | "ARRIVED"
    | "IN_CONSULTATION"
    | "COMPLETED"
    | "CANCELLED"
  assignedTo: string | null
  appointmentAt: string | null
  notes: string | null
  history: ReferralHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface DiagnosticRequest {
  id: string
  patientId: string
  visitId: string | null
  testType: string
  status:
    | "REQUESTED"
    | "SAMPLE_COLLECTED"
    | "PROCESSING"
    | "RESULT_READY"
    | "REVIEWED"
  result: string | null
  resultSummary: string | null
  orderedBy: string | null
  createdAt: string
  completedAt: string | null
  reviewedAt: string | null
}

export interface MedicineStock {
  id: string
  medicine: string
  facility: string
  status: "AVAILABLE" | "LOW" | "OUT"
  quantity: number
  unit: string
  updatedAt: string
}

export interface FollowUp {
  id: string
  patientId: string
  category: "MATERNAL" | "CHILD" | "CHRONIC" | "HIGH_RISK" | "MISSED"
  risk: "HIGH" | "MEDIUM" | "LOW"
  lastVisit: string | null
  nextDue: string
  assignedWorker: string | null
  status: "PENDING" | "CONTACTED" | "RESCHEDULED" | "COMPLETED" | "ESCALATED"
  notes: string | null
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface ExtractedField {
  field: string
  value: string
  unit?: string
  confidence: number // 0..1
  source: string // document source description
  flag?: "low" | "high" | "normal" | "info"
}

export interface DocumentRecord {
  id: string
  patientId: string
  type: "PRESCRIPTION" | "LAB_REPORT" | "MEDICAL_RECORD"
  title: string
  fileName: string | null
  source: string | null
  ocrText: string | null
  extracted: ExtractedField[]
  validationStatus: "PENDING" | "VALIDATED" | "REJECTED"
  validatedBy: string | null
  createdAt: string
  validatedAt: string | null
}

export interface AuditEvent {
  id: string
  actor: string
  actorRole: "PATIENT_KIOSK" | "FRONTLINE" | "DOCTOR" | "ADMIN" | "SYSTEM" | "AI_SERVICE"
  action: string
  target: string
  detail: string | null
  createdAt: string
}

/** DPDP-style consent artifact captured at the kiosk */
export interface ConsentRecord {
  id: string
  patientId: string
  visitId: string | null
  scope: "KIOSK_INTAKE" | "DATA_SHARING_REFERRAL"
  granted: boolean
  method: "KIOSK_CHECKBOX" | "VERBAL_WORKER"
  language: Language
  at: string
  withdrawnAt: string | null
}

export interface TriageResult {
  priority: TriagePriority
  reason: string
  redFlags: string[]
  summary: string
  recommendation: string
  suggestedWorkflow: string
  confidence: number
  engine: "deterministic-rules" | "llm-assisted"
  disclaimer: string
}

/** Full dataset payload — returned by GET /api/bootstrap and every mutation (demo-scale data) */
export interface DemoData {
  patients: Patient[]
  visits: Visit[]
  referrals: Referral[]
  diagnostics: DiagnosticRequest[]
  medicines: MedicineStock[]
  followUps: FollowUp[]
  documents: DocumentRecord[]
  consents: ConsentRecord[]
  audits: AuditEvent[]
  serverNow: string
}

/** POST /api/intake body */
export interface IntakePayload {
  name: string
  nameHi?: string
  age: number
  gender: string
  phone: string
  village: string
  district: string
  language: Language
  chiefComplaint: string
  symptoms: string[]
  durationDays: number | null
  durationLabel: string
  severity: "MILD" | "MODERATE" | "SEVERE"
  conditions: string[]
  medications: string[]
  allergies: string[]
  transcript?: string
  frontlineWorker?: string
  clientRef?: string // offline temp id for reconciliation on sync
  consent: boolean // DPDP-style informed consent — intake is rejected without it
  abhaId?: string // ABDM / ABHA address (optional at intake)
  interviewAnswers?: InterviewAnswer[] // adaptive interview Q&A transcript
}

/** POST /api/ai/extract response */
export interface ExtractResult {
  language: Language
  languageLabel: string
  transcript: string
  symptoms: { label: string; hi?: string; confidence: number }[]
  durationDays: number | null
  durationLabel: string
  severity: "MILD" | "MODERATE" | "SEVERE"
  redFlagSuspects: string[]
  followUpQuestions: string[]
  engine: "deterministic-nlp" | "llm-assisted"
}

/** POST /api/documents (simulated OCR) response = DocumentRecord */
export type OcrResult = DocumentRecord

export interface ApiEnvelope {
  ok: boolean
  data: DemoData
  meta?: Record<string, unknown>
  error?: string
}

/** Queued offline action stored in localStorage */
export interface QueuedAction {
  id: string
  method: "POST" | "PATCH"
  url: string
  body: Record<string, unknown>
  label: string
  createdAt: string
}

export const FACILITIES = [
  "Rampur Sub-Centre",
  "Rampur PHC",
  "Siwan Rural Hospital",
  "Gopalganj District Hospital",
] as const

export const DEMO_NOW_ISO = "2026-09-23T09:00:00.000+05:30"

/** Parse JSON-string columns safely */
export function parseJsonArray<T = string>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}
