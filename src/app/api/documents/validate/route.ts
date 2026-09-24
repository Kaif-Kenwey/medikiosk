import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, getDemoData, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/** Human validation of AI-extracted document fields */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string
      action?: "ACCEPT" | "REJECT"
      editedExtracted?: unknown
      validatedBy?: string
    }
    if (!body.id || !body.action) {
      return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 })
    }
    const existing = await db.documentRecord.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 })
    }
    const validatedBy = body.validatedBy ?? "ANM Sunita Sharma"
    const doc = await db.documentRecord.update({
      where: { id: body.id },
      data: {
        validationStatus: body.action === "ACCEPT" ? "VALIDATED" : "REJECTED",
        validatedBy,
        validatedAt: demoNow(),
        ...(body.editedExtracted ? { extracted: JSON.stringify(body.editedExtracted) } : {}),
      },
    })
    await logAudit({
      actor: validatedBy,
      actorRole: "FRONTLINE",
      action: body.action === "ACCEPT" ? "DOCUMENT_VALIDATED" : "DOCUMENT_REJECTED",
      target: `${existing.id} ${existing.title}`,
      detail:
        body.action === "ACCEPT"
          ? "Healthcare worker confirmed AI-extracted information"
          : "Healthcare worker rejected AI-extracted information",
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { documentId: doc.id } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "validate failed" },
      { status: 500 }
    )
  }
}
