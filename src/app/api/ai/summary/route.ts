import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildPatientSummary, tryLlmPatientSummary, type SummaryInput } from "@/lib/ai-engine"
import { logAudit, demoNow } from "@/lib/server-data"
import { parseJsonArray } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/summary — clinical record summarization.
 * Body: { patientId }
 * Deterministic fact-only summary of the whole record; the LLM (when
 * reachable) may polish the wording — never the facts, never a diagnosis.
 * This is an aid for the reviewing healthcare professional.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { patientId?: string }
    if (!body.patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }

    const [visits, referrals, diagnostics, followUps, documents] = await Promise.all([
      db.visit.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.referral.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.diagnosticRequest.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.followUp.findMany({ where: { patientId: patient.id }, orderBy: { nextDue: "asc" }, take: 3 }),
      db.documentRecord.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    ])

    const input: SummaryInput = {
      patient: {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        mrn: patient.mrn,
        conditions: parseJsonArray(patient.conditions),
        allergies: parseJsonArray(patient.allergies),
        medications: parseJsonArray(patient.medications),
      },
      visits: visits.map((v) => ({
        chiefComplaint: v.chiefComplaint,
        triagePriority: v.triagePriority,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        facility: v.facility,
      })),
      referrals: referrals.map((r) => ({ destination: r.destination, priority: r.priority, status: r.status })),
      diagnostics: diagnostics.map((d) => ({ testType: d.testType, status: d.status })),
      followUps: followUps.map((f) => ({ category: f.category, status: f.status, nextDue: f.nextDue.toISOString() })),
      documents: documents.map((d) => ({ type: d.type, title: d.title, validationStatus: d.validationStatus })),
    }

    const deterministic = buildPatientSummary(input)
    const llm = await tryLlmPatientSummary(deterministic)
    const summary = llm.used ? `${deterministic}\n\nNarrative (LLM-assisted): ${llm.summary}` : deterministic

    await logAudit({
      actor: "MediKiosk AI",
      actorRole: "AI_SERVICE",
      action: "SUMMARY_GENERATED",
      target: `${patient.mrn} ${patient.name}`,
      detail: `${llm.used ? "LLM-assisted" : "Deterministic"} record summary — for professional review only`,
      createdAt: demoNow(),
    })

    return NextResponse.json({
      ok: true,
      data: {
        summary,
        engine: llm.used ? ("llm-assisted" as const) : ("deterministic-rules" as const),
        disclaimer:
          "AI-assisted summary of recorded facts — not a diagnosis. Requires review by a healthcare professional.",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "summary failed" },
      { status: 500 }
    )
  }
}
