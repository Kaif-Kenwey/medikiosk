import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { simulateOcr } from "@/lib/ai-engine"
import { logAudit, mapDocument, getDemoData, demoNow } from "@/lib/server-data"
import type { ExtractedField } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * SIMULATED document intelligence (OCR) for the demo.
 * Produces realistic extracted fields for known document templates.
 * Clearly marked as simulated; results are NOT clinically verified
 * until a human validates them.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      patientId?: string
      kind?: "LAB_REPORT" | "PRESCRIPTION" | "MEDICAL_RECORD"
      fileName?: string
      actor?: string
    }
    if (!body.patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const tpl = simulateOcr(body.kind ?? "LAB_REPORT")
    const doc = await db.documentRecord.create({
      data: {
        patientId: body.patientId,
        type: tpl.type,
        title: tpl.title,
        fileName: body.fileName ?? `${tpl.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
        source: tpl.source,
        ocrText: tpl.ocrText,
        extracted: JSON.stringify(tpl.extracted as ExtractedField[]),
        validationStatus: "PENDING",
        createdAt: demoNow(),
      },
    })
    await logAudit({
      actor: body.actor ?? "ANM Sunita Sharma",
      actorRole: "FRONTLINE",
      action: "DOCUMENT_SCANNED",
      target: `${doc.id} ${tpl.title}`,
      detail: `Simulated OCR extracted ${tpl.extracted.length} fields — pending human validation`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { document: mapDocument(doc) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "ocr failed" },
      { status: 500 }
    )
  }
}
