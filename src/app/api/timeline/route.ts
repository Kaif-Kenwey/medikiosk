import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { mapVisit, mapReferral, mapDiagnostic, mapDocument, mapFollowUp } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/**
 * GET /api/timeline?patientId= — clinical timeline generation.
 * Merges visits, referrals, diagnostics, documents and follow-ups into
 * one chronological event list (newest first). ABDM/FHIR-friendly:
 * every event carries its source resource kind.
 */
export async function GET(req: NextRequest) {
  const patientId = new URL(req.url).searchParams.get("patientId")
  if (!patientId) {
    return NextResponse.json({ ok: false, error: "patientId query param required" }, { status: 400 })
  }
  try {
    const patient = await db.patient.findUnique({ where: { id: patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }

    const [visits, referrals, diagnostics, documents, followUps] = await Promise.all([
      db.visit.findMany({ where: { patientId } }),
      db.referral.findMany({ where: { patientId } }),
      db.diagnosticRequest.findMany({ where: { patientId } }),
      db.documentRecord.findMany({ where: { patientId } }),
      db.followUp.findMany({ where: { patientId } }),
    ])

    type TimelineEvent = {
      at: string
      kind: "VISIT" | "REFERRAL" | "DIAGNOSTIC" | "DOCUMENT" | "FOLLOWUP"
      title: string
      detail: string | null
      status: string
      refId: string
      /** Priority color hint for the UI */
      priority: "HIGH" | "MEDIUM" | "LOW" | "INFO"
    }

    const events: TimelineEvent[] = [
      ...visits.map((v): TimelineEvent => {
        const m = mapVisit(v)
        return {
          at: m.createdAt,
          kind: "VISIT",
          title: `${m.type.replace(/_/g, " ")} — ${m.chiefComplaint}`,
          detail: m.aiRecommendation,
          status: m.status,
          refId: m.id,
          priority: m.triagePriority ?? "INFO",
        }
      }),
      ...referrals.map((r): TimelineEvent => {
        const m = mapReferral(r)
        return {
          at: m.createdAt,
          kind: "REFERRAL",
          title: `Referral ${m.origin} → ${m.destination}`,
          detail: m.reason,
          status: m.status,
          refId: m.id,
          priority: m.priority === "EMERGENCY" ? "HIGH" : m.priority === "URGENT" ? "MEDIUM" : "LOW",
        }
      }),
      ...diagnostics.map((d): TimelineEvent => {
        const m = mapDiagnostic(d)
        return {
          at: m.createdAt,
          kind: "DIAGNOSTIC",
          title: `${m.testType} ordered`,
          detail: m.resultSummary,
          status: m.status,
          refId: m.id,
          priority: "INFO",
        }
      }),
      ...documents.map((d): TimelineEvent => {
        const m = mapDocument(d)
        return {
          at: m.createdAt,
          kind: "DOCUMENT",
          title: `${m.type.replace(/_/g, " ")} — ${m.title}`,
          detail: m.ocrText ? `${m.extracted.length} fields extracted` : null,
          status: m.validationStatus,
          refId: m.id,
          priority: "INFO",
        }
      }),
      ...followUps.map((f): TimelineEvent => {
        const m = mapFollowUp(f)
        return {
          at: m.createdAt,
          kind: "FOLLOWUP",
          title: `${m.category.replace(/_/g, " ")} follow-up scheduled`,
          detail: m.notes,
          status: m.status,
          refId: m.id,
          priority: m.risk,
        }
      }),
    ].sort((a, b) => (a.at < b.at ? 1 : -1))

    return NextResponse.json({
      ok: true,
      data: {
        patientId,
        generatedAt: new Date().toISOString(),
        events,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "timeline failed" },
      { status: 500 }
    )
  }
}
