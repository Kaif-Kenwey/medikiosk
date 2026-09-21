import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildFhirBundle } from "@/lib/fhir"
import { mapPatient, getDemoData } from "@/lib/server-data"
import type { Patient } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * FHIR R4 export (ABDM-aligned abstraction) — prototype demonstration only.
 * NOT a live ABDM/HIP integration.
 */
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId")
    if (!patientId) {
      return NextResponse.json({ ok: false, error: "patientId required" }, { status: 400 })
    }
    const row = await db.patient.findUnique({ where: { id: patientId } })
    if (!row) {
      return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 })
    }
    const patient = mapPatient(row as unknown as Record<string, unknown>) as Patient
    const data = await getDemoData()
    const bundle = buildFhirBundle(patient, data)
    return NextResponse.json(bundle)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fhir export failed" },
      { status: 500 }
    )
  }
}
