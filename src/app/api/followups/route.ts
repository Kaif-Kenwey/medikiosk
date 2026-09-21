import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, mapFollowUp, getDemoData, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

const VALID_STATUSES = ["PENDING", "CONTACTED", "RESCHEDULED", "COMPLETED", "ESCALATED"]

/** PATCH — update follow-up task (contact / reschedule / complete / escalate) */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string
      status?: string
      nextDue?: string | null
      notes?: string
      by?: string
    }
    if (!body.id || !body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Valid id and status required" }, { status: 400 })
    }
    const existing = await db.followUp.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Follow-up not found" }, { status: 404 })
    }
    const fu = await db.followUp.update({
      where: { id: body.id },
      data: {
        status: body.status,
        ...(body.nextDue !== undefined
          ? { nextDue: body.nextDue ? new Date(body.nextDue) : existing.nextDue }
          : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      },
    })
    await logAudit({
      actor: body.by ?? "ANM Sunita Sharma",
      actorRole: "FRONTLINE",
      action: `FOLLOWUP_${body.status}`,
      target: `${existing.category} follow-up — ${existing.id.slice(-8)}`,
      detail: body.notes ?? `Status → ${body.status}`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { followUp: mapFollowUp(fu) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "followup update failed" },
      { status: 500 }
    )
  }
}
