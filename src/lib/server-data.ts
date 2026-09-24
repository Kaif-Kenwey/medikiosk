// ============================================================
// MediKiosk — Server data access + audit logging
// ============================================================

import { db } from "@/lib/db"
import { decryptField } from "@/lib/crypto"
import {
  parseJsonArray,
  type AuditEvent,
  type ConsentRecord,
  type DemoData,
  type DocumentRecord,
  type DiagnosticRequest,
  type ExtractedField,
  type FollowUp,
  type InterviewAnswer,
  type MedicineStock,
  type Patient,
  type Referral,
  type ReferralHistoryEntry,
  type Visit,
} from "@/lib/types"

type Row = Record<string, unknown>

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ""))

/**
 * Demo clock — maps real "now" onto the SIH demo day (23 Sep 2026, 09:00 IST)
 * so every server-side timestamp stays consistent with seeded 2026 data
 * while preserving relative ordering between events.
 */
export function demoNow(offsetMinutes = 0): Date {
  const demo = Date.parse("2026-09-23T09:00:00.000+05:30")
  return new Date(Date.now() + (demo - Date.now()) + offsetMinutes * 60000)
}

export function mapPatient(r: Row): Patient {
  return {
    id: String(r.id),
    mrn: String(r.mrn),
    name: String(r.name),
    nameHi: (r.nameHi as string) ?? null,
    age: Number(r.age),
    gender: String(r.gender),
    // phone is AES-256-GCM encrypted at rest — decrypted here for authorized display
    phone: decryptField(String(r.phone ?? "")),
    phoneHash: (r.phoneHash as string) ?? null,
    abhaId: (r.abhaId as string) ?? null,
    village: String(r.village),
    district: String(r.district),
    language: (r.language as Patient["language"]) ?? "hi",
    allergies: parseJsonArray(String(r.allergies ?? "[]")),
    conditions: parseJsonArray(String(r.conditions ?? "[]")),
    medications: parseJsonArray(String(r.medications ?? "[]")),
    createdAt: iso(r.createdAt),
  }
}

export function mapVisit(r: Row): Visit {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    type: r.type as Visit["type"],
    facility: String(r.facility),
    chiefComplaint: String(r.chiefComplaint),
    symptoms: parseJsonArray(String(r.symptoms ?? "[]")),
    durationDays: r.durationDays === null ? null : Number(r.durationDays),
    durationLabel: (r.durationLabel as string) ?? null,
    severity: (r.severity as Visit["severity"]) ?? null,
    triagePriority: (r.triagePriority as Visit["triagePriority"]) ?? null,
    redFlags: parseJsonArray(String(r.redFlags ?? "[]")),
    aiSummary: (r.aiSummary as string) ?? null,
    aiRecommendation: (r.aiRecommendation as string) ?? null,
    status: r.status as Visit["status"],
    frontlineWorker: (r.frontlineWorker as string) ?? null,
    validatedBy: (r.validatedBy as string) ?? null,
    clinicalNote: (r.clinicalNote as string) ?? null,
    interviewAnswers: parseJsonArray<InterviewAnswer>(String(r.interviewAnswers ?? "[]")) as InterviewAnswer[],
    syncStatus: (r.syncStatus as Visit["syncStatus"]) ?? "SYNCED",
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }
}

export function mapReferral(r: Row): Referral {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    visitId: (r.visitId as string) ?? null,
    reason: String(r.reason),
    origin: String(r.origin),
    destination: String(r.destination),
    priority: r.priority as Referral["priority"],
    status: r.status as Referral["status"],
    assignedTo: (r.assignedTo as string) ?? null,
    appointmentAt: r.appointmentAt ? iso(r.appointmentAt) : null,
    notes: (r.notes as string) ?? null,
    history: parseJsonArray<ReferralHistoryEntry>(String(r.history ?? "[]")) as Referral["history"],
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }
}

export function mapDiagnostic(r: Row): DiagnosticRequest {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    visitId: (r.visitId as string) ?? null,
    testType: String(r.testType),
    status: r.status as DiagnosticRequest["status"],
    result: (r.result as string) ?? null,
    resultSummary: (r.resultSummary as string) ?? null,
    orderedBy: (r.orderedBy as string) ?? null,
    createdAt: iso(r.createdAt),
    completedAt: r.completedAt ? iso(r.completedAt) : null,
    reviewedAt: r.reviewedAt ? iso(r.reviewedAt) : null,
  }
}

export function mapMedicine(r: Row): MedicineStock {
  return {
    id: String(r.id),
    medicine: String(r.medicine),
    facility: String(r.facility),
    status: r.status as MedicineStock["status"],
    quantity: Number(r.quantity),
    unit: String(r.unit ?? "doses"),
    updatedAt: iso(r.updatedAt),
  }
}

export function mapFollowUp(r: Row): FollowUp {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    category: r.category as FollowUp["category"],
    risk: r.risk as FollowUp["risk"],
    lastVisit: r.lastVisit ? iso(r.lastVisit) : null,
    nextDue: iso(r.nextDue),
    assignedWorker: (r.assignedWorker as string) ?? null,
    status: r.status as FollowUp["status"],
    notes: (r.notes as string) ?? null,
    syncStatus: (r.syncStatus as FollowUp["syncStatus"]) ?? "SYNCED",
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }
}

export function mapDocument(r: Row): DocumentRecord {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    type: r.type as DocumentRecord["type"],
    title: String(r.title),
    fileName: (r.fileName as string) ?? null,
    source: (r.source as string) ?? null,
    ocrText: (r.ocrText as string) ?? null,
    extracted: parseJsonArray<ExtractedField>(String(r.extracted ?? "[]")) as ExtractedField[],
    validationStatus: r.validationStatus as DocumentRecord["validationStatus"],
    validatedBy: (r.validatedBy as string) ?? null,
    createdAt: iso(r.createdAt),
    validatedAt: r.validatedAt ? iso(r.validatedAt) : null,
  }
}

export function mapAudit(r: Row): AuditEvent {
  return {
    id: String(r.id),
    actor: String(r.actor),
    actorRole: r.actorRole as AuditEvent["actorRole"],
    action: String(r.action),
    target: String(r.target),
    detail: (r.detail as string) ?? null,
    createdAt: iso(r.createdAt),
  }
}

export function mapConsent(r: Row): ConsentRecord {
  return {
    id: String(r.id),
    patientId: String(r.patientId),
    visitId: (r.visitId as string) ?? null,
    scope: r.scope as ConsentRecord["scope"],
    granted: Boolean(r.granted),
    method: r.method as ConsentRecord["method"],
    language: (r.language as ConsentRecord["language"]) ?? "hi",
    at: iso(r.at),
    withdrawnAt: r.withdrawnAt ? iso(r.withdrawnAt) : null,
  }
}

export async function logAudit(e: {
  actor: string
  actorRole: AuditEvent["actorRole"]
  action: string
  target: string
  detail?: string
  createdAt?: Date
}) {
  await db.auditEvent.create({ data: { ...e, detail: e.detail ?? null } })
}

/** Full demo dataset (small — sent as one payload, refreshed after each mutation) */
export async function getDemoData(): Promise<DemoData> {
  const [patients, visits, referrals, diagnostics, medicines, followUps, documents, consents, audits] =
    await Promise.all([
      db.patient.findMany({ orderBy: { createdAt: "desc" } }),
      db.visit.findMany({ orderBy: { createdAt: "desc" } }),
      db.referral.findMany({ orderBy: { createdAt: "desc" } }),
      db.diagnosticRequest.findMany({ orderBy: { createdAt: "desc" } }),
      db.medicineStock.findMany({ orderBy: { medicine: "asc" } }),
      db.followUp.findMany({ orderBy: { nextDue: "asc" } }),
      db.documentRecord.findMany({ orderBy: { createdAt: "desc" } }),
      db.consentRecord.findMany({ orderBy: { at: "desc" } }),
      db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    ])
  return {
    patients: patients.map(mapPatient),
    visits: visits.map(mapVisit),
    referrals: referrals.map(mapReferral),
    diagnostics: diagnostics.map(mapDiagnostic),
    medicines: medicines.map(mapMedicine),
    followUps: followUps.map(mapFollowUp),
    documents: documents.map(mapDocument),
    consents: consents.map(mapConsent),
    audits: audits.map(mapAudit),
    serverNow: new Date().toISOString(),
  }
}
