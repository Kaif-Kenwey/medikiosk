import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit, mapDiagnostic, getDemoData, demoNow } from "@/lib/server-data"
import { guard } from "@/lib/auth"

export const dynamic = "force-dynamic"

const VALID_STATUSES = ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "RESULT_READY", "REVIEWED"]

const DEMO_RESULTS: Record<string, { result: string; summary: string }> = {
  CBC: {
    result: "Hemoglobin 10.1 g/dL (low) | WBC 13,100 /µL (high) | Platelets 2,05,000 /µL",
    summary: "Low hemoglobin with elevated WBC — pattern consistent with infection on top of known anemia. Physician review advised.",
  },
  CHEST_XRAY: {
    result: "Bilateral lower-zone infiltrates; heart size normal; no effusion.",
    summary: "Findings require physician correlation with clinical picture.",
  },
  BLOOD_GLUCOSE: {
    result: "Fasting: 104 mg/dL | Post-prandial: 138 mg/dL",
    summary: "Values within acceptable range for current care plan.",
  },
  HBA1C: {
    result: "HbA1c: 8.2 %",
    summary: "Glycemic control suboptimal — medication review suggested.",
  },
  URINE_TEST: {
    result: "Protein: nil | Sugar: nil | Pus cells: 2-4/HPF",
    summary: "Within normal limits.",
  },
}

/** POST — create diagnostic request; PATCH — advance workflow / attach result */
export async function POST(req: NextRequest) {
  const denied = guard(req, "POST")
  if (denied) return denied
  try {
    const body = (await req.json()) as {
      patientId?: string
      visitId?: string | null
      testType?: string
      orderedBy?: string
    }
    if (!body.patientId || !body.testType) {
      return NextResponse.json({ ok: false, error: "patientId and testType required" }, { status: 400 })
    }
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }
    const diag = await db.diagnosticRequest.create({
      data: {
        patientId: body.patientId,
        visitId: body.visitId ?? null,
        testType: body.testType,
        status: "REQUESTED",
        orderedBy: body.orderedBy ?? "Doctor",
        createdAt: demoNow(),
      },
    })
    await logAudit({
      actor: body.orderedBy ?? "Dr. A. Prasad",
      actorRole: "DOCTOR",
      action: "DIAGNOSTIC_REQUESTED",
      target: `${body.testType} — ${patient.mrn} ${patient.name}`,
      detail: `Requested at ${body.orderedBy === "Dr. A. Prasad" ? "Gopalganj District Hospital" : "referring facility"}`,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { diagnostic: mapDiagnostic(diag) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "diagnostic create failed" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const denied = guard(req, "PATCH")
  if (denied) return denied
  try {
    const body = (await req.json()) as {
      id?: string
      status?: string
      by?: string
    }
    if (!body.id || !body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Valid id and status required" }, { status: 400 })
    }
    const existing = await db.diagnosticRequest.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Diagnostic request not found" }, { status: 404 })
    }
    if (existing.status === "REVIEWED") {
      return NextResponse.json(
        { ok: false, error: "Diagnostic request is already reviewed — workflow is closed" },
        { status: 409 }
      )
    }
    if (body.status === "REVIEWED" && !existing.result) {
      return NextResponse.json(
        { ok: false, error: "Cannot mark reviewed before a result is attached" },
        { status: 409 }
      )
    }
    // UI test-type labels ("Blood Glucose") are normalized to the
    // demo-result template keys ("BLOOD_GLUCOSE")
    const demo = DEMO_RESULTS[existing.testType.toUpperCase().replace(/\s+/g, "_")] ?? {
      result: "Demo result available for review.",
      summary: "Demo diagnostic result.",
    }
    const diag = await db.diagnosticRequest.update({
      where: { id: body.id },
      data: {
        status: body.status,
        ...(body.status === "RESULT_READY"
          ? { result: demo.result, resultSummary: demo.summary, completedAt: demoNow() }
          : {}),
        ...(body.status === "REVIEWED" ? { reviewedAt: demoNow() } : {}),
      },
    })
    await logAudit({
      actor: body.by ?? "Lab Technician",
      actorRole: body.status === "REVIEWED" ? "DOCTOR" : "SYSTEM",
      action: `DIAGNOSTIC_${body.status}`,
      target: `${existing.testType} — ${diag.id.slice(-8)}`,
      detail: body.status === "RESULT_READY" ? "Result available — awaiting doctor review" : undefined,
      createdAt: demoNow(),
    })
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { diagnostic: mapDiagnostic(diag) } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "diagnostic update failed" },
      { status: 500 }
    )
  }
}
