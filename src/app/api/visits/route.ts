import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, mapVisit, getDemoData, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

const VALID_STATUSES = ["WAITING", "TRIAGED", "ESCALATED", "IN_CONSULTATION", "COMPLETED"]

/** PATCH — update visit (escalate, start consultation, validate, complete) */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string
      status?: string
      validatedBy?: string
      clinicalNote?: string
      by?: string
    }
    if (!body.id || (body.status && !VALID_STATUSES.includes(body.status))) {
      return NextResponse.json({ ok: false, error: "Valid id (and status) required" }, { status: 400 })
    }
    const existing = await db.visit.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Visit not found" }, { status: 404 })
    }
    const visit = await db.visit.update({
      where: { id: body.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.validatedBy ? { validatedBy: body.validatedBy } : {}),
        ...(body.clinicalNote !== undefined ? { clinicalNote: body.clinicalNote } : {}),
      },
    })
    await logAudit({
      actor: body.by ?? body.validatedBy ?? "Doctor",
      actorRole: body.validatedBy || body.by?.startsWith("Dr.") ? "DOCTOR" : "FRONTLINE",
      action: body.status ? `VISIT_${body.status}` : "VISIT_UPDATED",
      target: `${visit.id.slice(-8)} ${visit.chiefComplaint}`,
      detail: body.clinicalNote ?? (body.validatedBy ? "Clinical information validated by professional" : undefined),
      createdAt: demoNow(),
    })
    if (body.status === "ESCALATED") {
      const fuCount = await db.followUp.count()
      const existingFu = await db.followUp.findFirst({
        where: { patientId: existing.patientId, category: "HIGH_RISK", status: { not: "COMPLETED" } },
      })
      if (!existingFu) {
        await db.followUp.create({
          data: {
            patientId: existing.patientId,
            category: "HIGH_RISK",
            risk: "HIGH",
            lastVisit: demoNow(),
            nextDue: new Date(Date.parse("2026-09-25T10:00:00+05:30") + fuCount * 3600000),
            assignedWorker: "ANM Sunita Sharma",
            status: "PENDING",
            notes: "Auto-created after red-flag escalation — 48h high-risk follow-up.",
            createdAt: demoNow(),
          },
        })
        await logAudit({
          actor: "MediKiosk Workflow",
          actorRole: "SYSTEM",
          action: "FOLLOWUP_CREATED",
          target: `High-risk follow-up — ${existing.patientId.slice(-8)}`,
          detail: "Automatically created from red-flag escalation",
          createdAt: demoNow(),
        })
      }
    }
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { visit: mapVisit(visit) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "visit update failed" },
      { status: 500 }
    )
  }
}
