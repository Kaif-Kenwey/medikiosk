import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, mapReferral, getDemoData, demoNow } from "@/lib/server-data"
import type { ReferralHistoryEntry } from "@/lib/types"

export const dynamic = "force-dynamic"

const VALID_STATUSES = [
  "PENDING", "ACCEPTED", "IN_TRANSIT", "ARRIVED",
  "IN_CONSULTATION", "COMPLETED", "CANCELLED",
]

/** POST — create referral; PATCH — update referral status (facility workflow) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      patientId?: string
      visitId?: string | null
      reason?: string
      origin?: string
      destination?: string
      priority?: "ROUTINE" | "URGENT" | "EMERGENCY"
      createdBy?: string
      assignedTo?: string
      appointmentAt?: string | null
    }
    if (!body.patientId || !body.reason || !body.destination) {
      return NextResponse.json(
        { ok: false, error: "patientId, reason, destination required" },
        { status: 400 }
      )
    }
    const referral = await db.referral.create({
      data: {
        patientId: body.patientId,
        visitId: body.visitId ?? null,
        reason: body.reason,
        origin: body.origin ?? "Rampur Sub-Centre",
        destination: body.destination,
        priority: body.priority ?? "ROUTINE",
        status: "PENDING",
        assignedTo: body.assignedTo ?? null,
        appointmentAt: body.appointmentAt ? new Date(body.appointmentAt) : null,
        history: JSON.stringify([
          { status: "PENDING", at: demoNow().toISOString(), by: body.createdBy ?? "Frontline Worker" },
        ] as ReferralHistoryEntry[]),
        createdAt: demoNow(),
      },
    })
    await logAudit({
      actor: body.createdBy ?? "ANM Sunita Sharma",
      actorRole: "FRONTLINE",
      action: "REFERRAL_CREATED",
      target: `${referral.id.slice(-8)} ${body.reason}`,
      detail: `${referral.origin} → ${referral.destination} (${referral.priority})`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { referral: mapReferral(referral) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "referral create failed" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string
      status?: string
      by?: string
      note?: string
      assignedTo?: string
      appointmentAt?: string | null
    }
    if (!body.id || !body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Valid id and status required" }, { status: 400 })
    }
    const existing = await db.referral.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Referral not found" }, { status: 404 })
    }
    const history = [
      ...JSON.parse(existing.history),
      { status: body.status, at: demoNow().toISOString(), by: body.by ?? "Facility", note: body.note },
    ]
    const referral = await db.referral.update({
      where: { id: body.id },
      data: {
        status: body.status,
        history: JSON.stringify(history),
        ...(body.assignedTo ? { assignedTo: body.assignedTo } : {}),
        ...(body.appointmentAt !== undefined
          ? { appointmentAt: body.appointmentAt ? new Date(body.appointmentAt) : null }
          : {}),
      },
    })
    await logAudit({
      actor: body.by ?? "Facility",
      actorRole: body.by?.startsWith("Dr.") ? "DOCTOR" : "FRONTLINE",
      action: `REFERRAL_${body.status}`,
      target: `${referral.id.slice(-8)} ${existing.reason}`,
      detail: `${existing.origin} → ${existing.destination}`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { referral: mapReferral(referral) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "referral update failed" },
      { status: 500 }
    )
  }
}
