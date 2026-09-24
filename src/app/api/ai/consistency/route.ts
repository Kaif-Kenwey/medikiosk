import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { detectContradictions } from "@/lib/ai-engine"
import { logAudit, demoNow } from "@/lib/server-data"
import { parseJsonArray } from "@/lib/types"
import type { ExtractedField } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/consistency — contradiction detection (deterministic).
 * Body: { patientId, documentId? }
 * Cross-checks stated symptoms + transcript against the patient record
 * and (optionally) a scanned document. Findings are advisory; a human
 * healthcare professional resolves every contradiction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { patientId?: string; documentId?: string }
    if (!body.patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }

    let document: Parameters<typeof detectContradictions>[0]["document"] = null
    if (body.documentId) {
      const doc = await db.documentRecord.findUnique({ where: { id: body.documentId } })
      if (doc) {
        document = {
          type: doc.type,
          title: doc.title,
          extracted: parseJsonArray<ExtractedField>(doc.extracted) as ExtractedField[],
        }
      }
    }

    const latestVisit = await db.visit.findFirst({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
    })

    const result = detectContradictions({
      symptoms: latestVisit ? parseJsonArray(latestVisit.symptoms) : [],
      transcript: latestVisit?.clinicalNote ?? latestVisit?.chiefComplaint ?? null,
      allergies: parseJsonArray(patient.allergies),
      conditions: parseJsonArray(patient.conditions),
      medications: parseJsonArray(patient.medications),
      document,
    })

    await logAudit({
      actor: "MediKiosk AI",
      actorRole: "AI_SERVICE",
      action: "CONSISTENCY_CHECK",
      target: `${patient.mrn} ${patient.name}`,
      detail: `${result.findings.length} finding(s)${document ? " (with document cross-check)" : ""} — human resolution required`,
      createdAt: demoNow(),
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "consistency check failed" },
      { status: 500 }
    )
  }
}
