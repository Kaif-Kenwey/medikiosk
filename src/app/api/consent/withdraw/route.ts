import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, getDemoData, demoNow } from "@/lib/server-data"
import { guard, getSessionFromRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/consent/withdraw — patient withdraws kiosk data consent.
 * Body: { patientId, by? }
 * The latest active KIOSK_INTAKE consent artifact is marked withdrawn;
 * the data itself is retained per health-record retention norms, but the
 * event is auditable and future kiosk intake requires fresh consent.
 */
export async function POST(req: NextRequest) {
  const denied = guard(req, "POST")
  if (denied) return denied
  try {
    const body = (await req.json()) as { patientId?: string; by?: string }
    if (!body.patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }
    const active = await db.consentRecord.findFirst({
      where: { patientId: body.patientId, scope: "KIOSK_INTAKE", granted: true, withdrawnAt: null },
      orderBy: { at: "desc" },
    })
    if (!active) {
      return NextResponse.json(
        { ok: false, error: "No active consent artifact to withdraw" },
        { status: 409 }
      )
    }
    await db.consentRecord.update({
      where: { id: active.id },
      data: { withdrawnAt: demoNow() },
    })
    const session = getSessionFromRequest(req)
    await logAudit({
      actor: body.by ?? session?.name ?? "Facility staff",
      actorRole: "FRONTLINE",
      action: "CONSENT_WITHDRAWN",
      target: `${patient.mrn} ${patient.name}`,
      detail: "Kiosk data consent withdrawn — recorded in consent register",
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "withdraw failed" },
      { status: 500 }
    )
  }
}
