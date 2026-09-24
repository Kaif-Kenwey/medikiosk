import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, getDemoData, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/** Runtime shape check for human-edited extraction fields */
function isValidExtracted(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every(
    (f) =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as Record<string, unknown>).field === "string" &&
      typeof (f as Record<string, unknown>).value === "string"
  )
}

/** Human validation of AI-extracted document fields.
 *  action: "ACCEPT" (alias "VALIDATE") | "REJECT"
 *  A document can only be resolved once — re-validation is rejected (409)
 *  so the audit trail stays truthful. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string
      action?: string
      editedExtracted?: unknown
      validatedBy?: string
    }
    if (!body.id || !body.action) {
      return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 })
    }
    const action = body.action === "VALIDATE" ? "ACCEPT" : body.action
    if (action !== "ACCEPT" && action !== "REJECT") {
      return NextResponse.json(
        { ok: false, error: "action must be ACCEPT (or VALIDATE) or REJECT" },
        { status: 400 }
      )
    }
    if (body.editedExtracted !== undefined && body.editedExtracted !== null && !isValidExtracted(body.editedExtracted)) {
      return NextResponse.json(
        { ok: false, error: "editedExtracted must be a non-empty array of {field, value} objects" },
        { status: 400 }
      )
    }
    const existing = await db.documentRecord.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 })
    }
    if (existing.validationStatus !== "PENDING") {
      return NextResponse.json(
        {
          ok: false,
          error: `Document already ${existing.validationStatus.toLowerCase()} by ${existing.validatedBy ?? "another reviewer"} — re-validation is not allowed`,
        },
        { status: 409 }
      )
    }
    const validatedBy = body.validatedBy ?? "ANM Sunita Sharma"
    const doc = await db.documentRecord.update({
      where: { id: body.id },
      data: {
        validationStatus: action === "ACCEPT" ? "VALIDATED" : "REJECTED",
        validatedBy,
        validatedAt: demoNow(),
        ...(action === "ACCEPT" && body.editedExtracted
          ? { extracted: JSON.stringify(body.editedExtracted) }
          : {}),
      },
    })
    await logAudit({
      actor: validatedBy,
      actorRole: "FRONTLINE",
      action: action === "ACCEPT" ? "DOCUMENT_VALIDATED" : "DOCUMENT_REJECTED",
      target: `${existing.id} ${existing.title}`,
      detail:
        action === "ACCEPT"
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
