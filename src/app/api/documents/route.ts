import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { simulateOcr, tryVisionOcr, type OcrExtraction } from "@/lib/ai-engine"
import { logAudit, mapDocument, getDemoData, demoNow } from "@/lib/server-data"
import { guard } from "@/lib/auth"
import type { ExtractedField } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * Document intelligence (OCR) for the demo.
 *
 * Two engines, chosen by the request:
 * - `imageDataUrl` present → REAL vision OCR: a photo/scan of the paper
 *   document is read by the vision model and structured fields are
 *   extracted ("vision-ocr").
 * - no image → SIMULATED template extraction for deterministic demos
 *   ("simulated-template").
 *
 * In BOTH cases the output is machine-generated and marked PENDING until
 * a human healthcare professional validates it.
 */
export async function POST(req: NextRequest) {
  const denied = guard(req, "POST")
  if (denied) return denied
  try {
    const body = (await req.json()) as {
      patientId?: string
      kind?: "LAB_REPORT" | "PRESCRIPTION" | "MEDICAL_RECORD"
      fileName?: string
      imageDataUrl?: string
      actor?: string
    }
    if (!body.patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }
    const kind = body.kind ?? "LAB_REPORT"
    const fallback = simulateOcr(kind)
    // Guard against huge payloads (~8MB image cap)
    if (body.imageDataUrl && body.imageDataUrl.length > 11_000_000) {
      return NextResponse.json({ ok: false, error: "Image too large (max ~8MB)" }, { status: 413 })
    }
    const result: OcrExtraction = body.imageDataUrl
      ? await tryVisionOcr(body.imageDataUrl, kind, fallback)
      : { ...fallback, engine: "simulated-template" }
    const doc = await db.documentRecord.create({
      data: {
        patientId: body.patientId,
        type: kind,
        title: result.title,
        fileName: body.fileName ?? `${result.title.toLowerCase().replace(/\s+/g, "_")}.jpg`,
        source: result.source,
        ocrText: result.ocrText,
        extracted: JSON.stringify(result.extracted as ExtractedField[]),
        validationStatus: "PENDING",
        createdAt: demoNow(),
      },
    })
    await logAudit({
      actor: body.actor ?? "ANM Sunita Sharma",
      actorRole: "FRONTLINE",
      action: "DOCUMENT_SCANNED",
      target: `${patient.mrn} ${patient.name} — ${result.title}`,
      detail: `Engine: ${result.engine} — extracted ${result.extracted.length} fields — pending human validation`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({
      ok: true,
      data,
      meta: { document: mapDocument(doc), engine: result.engine },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "ocr failed" },
      { status: 500 }
    )
  }
}
