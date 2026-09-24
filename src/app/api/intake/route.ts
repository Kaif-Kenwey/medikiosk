import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { computeTriage } from "@/lib/ai-engine"
import { logAudit, mapPatient, mapVisit, getDemoData, demoNow } from "@/lib/server-data"
import { guard } from "@/lib/auth"
import { blindIndex, encryptField } from "@/lib/crypto"
import type { IntakePayload, Language } from "@/lib/types"

export const dynamic = "force-dynamic"

const ROLES: Record<string, { actor: string; actorRole: "PATIENT_KIOSK" | "FRONTLINE" }> = {
  kiosk: { actor: "Patient (Kiosk self-service)", actorRole: "PATIENT_KIOSK" },
  frontline: { actor: "ANM Sunita Sharma", actorRole: "FRONTLINE" },
}

export async function POST(req: NextRequest) {
  const denied = guard(req, "POST")
  if (denied) return denied
  try {
    const body = (await req.json()) as IntakePayload & { actor?: string }
    const required = ["name", "age", "gender", "phone", "chiefComplaint"]
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json({ ok: false, error: `Missing field: ${k}` }, { status: 400 })
      }
    }
    // DPDP-style informed consent is mandatory before any personal data is recorded
    if (body.consent !== true) {
      return NextResponse.json(
        { ok: false, error: "Informed consent is required before intake can be recorded" },
        { status: 400 }
      )
    }
    const phone = body.phone.replace(/\s/g, "")
    const age = Number(body.age) || 0
    if (!age || age < 0 || age > 120) {
      return NextResponse.json({ ok: false, error: "Invalid age" }, { status: 400 })
    }
    // Same rule the kiosk UI enforces: at least 10 digits so the
    // continuity match-by-phone stays reliable
    const phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Phone number must contain at least 10 digits" },
        { status: 400 }
      )
    }

    const { actor, actorRole } = ROLES[body.actor === "frontline" ? "frontline" : "kiosk"]

    // Continuity: match existing patient by phone — via tamper-proof blind
    // index (works on encrypted rows) with legacy plaintext fallback
    const phoneNormalized = phone.replace(/\s/g, "")
    const phoneIdx = blindIndex(phoneNormalized)
    const allPatients = await db.patient.findMany()
    const existing =
      allPatients.find((p) => p.phoneHash === phoneIdx) ??
      allPatients.find((p) => !p.phoneHash && p.phone.replace(/\s/g, "") === phoneNormalized) ??
      null

    let patientRow = existing ?? null
    if (existing) {
      // Backfill encryption on legacy plaintext rows
      const phonePatch = existing.phone.startsWith("enc.v1:")
        ? {}
        : { phone: encryptField(existing.phone), phoneHash: blindIndex(existing.phone) }
      await db.patient.update({
        where: { id: existing.id },
        data: {
          ...phonePatch,
          conditions: JSON.stringify([
            ...new Set([...JSON.parse(existing.conditions), ...(body.conditions ?? [])]),
          ]),
          medications: JSON.stringify([
            ...new Set([...JSON.parse(existing.medications), ...(body.medications ?? [])]),
          ]),
          allergies: JSON.stringify([
            ...new Set([...JSON.parse(existing.allergies), ...(body.allergies ?? [])]),
          ]),
        },
      })
    } else {
      const count = await db.patient.count()
      patientRow = await db.patient.create({
        data: {
          mrn: `MK-2026-${String(500 + count).padStart(4, "0")}`,
          name: body.name.trim(),
          nameHi: body.nameHi ?? null,
          age,
          gender: body.gender,
          phone: encryptField(body.phone),
          phoneHash: blindIndex(body.phone),
          abhaId: body.abhaId?.trim() || null,
          village: body.village || "Rampur",
          district: body.district || "Gopalganj",
          language: (body.language as Language) || "hi",
          allergies: JSON.stringify(body.allergies ?? []),
          conditions: JSON.stringify(body.conditions ?? []),
          medications: JSON.stringify(body.medications ?? []),
          createdAt: demoNow(),
        },
      })
    }

    if (!patientRow) {
      return NextResponse.json({ ok: false, error: "Could not create patient" }, { status: 500 })
    }

    // Deterministic AI triage (safety-critical path)
    const triage = computeTriage({
      symptoms: body.symptoms ?? [],
      durationDays: body.durationDays ?? null,
      severity: body.severity || "MILD",
      age,
      conditions: body.conditions ?? [],
    })

    const visit = await db.visit.create({
      data: {
        patientId: patientRow.id,
        type: "KIOSK_INTAKE",
        facility: "Rampur Sub-Centre",
        chiefComplaint: body.chiefComplaint || body.symptoms?.join(", ") || "General consultation",
        symptoms: JSON.stringify(body.symptoms ?? []),
        durationDays: body.durationDays ?? null,
        durationLabel: body.durationLabel || null,
        severity: body.severity || "MILD",
        triagePriority: triage.priority,
        redFlags: JSON.stringify(triage.redFlags),
        aiSummary: triage.summary,
        aiRecommendation: triage.recommendation,
        status: "TRIAGED",
        frontlineWorker: body.frontlineWorker ?? null,
        interviewAnswers: JSON.stringify(body.interviewAnswers ?? []),
        // The server now owns this record (offline-captured ones arrive via
        // sync replay) — PENDING is a client-side optimistic state only.
        syncStatus: "SYNCED",
        createdAt: demoNow(-(25 + Math.min(((await db.visit.count()) % 4) * 8, 24))),
      },
    })

    // Consent artifact — captured at the kiosk, auditable and withdrawable
    await db.consentRecord.create({
      data: {
        patientId: patientRow.id,
        visitId: visit.id,
        scope: "KIOSK_INTAKE",
        granted: true,
        method: "KIOSK_CHECKBOX",
        language: (body.language as Language) || "hi",
        at: demoNow(),
      },
    })
    await logAudit({
      actor,
      actorRole,
      action: "CONSENT_RECORDED",
      target: `${patientRow.mrn} ${patientRow.name}`,
      detail: "Kiosk intake consent granted (DPDP-style artifact stored)",
      createdAt: demoNow(),
    })

    await logAudit({
      actor,
      actorRole,
      action: "INTAKE_CREATED",
      target: `${patientRow.mrn} ${patientRow.name}`,
      detail: `AI triage: ${triage.priority}${triage.redFlags.length ? ` — red flags: ${triage.redFlags.join(", ")}` : ""}${body.clientRef ? " (captured offline)" : ""}`,
      createdAt: demoNow(),
    })
    await logAudit({
      actor: "MediKiosk AI",
      actorRole: "AI_SERVICE",
      action: "TRIAGE_GENERATED",
      target: `${patientRow.mrn} ${patientRow.name}`,
      detail: `${triage.priority} priority — ${triage.engine}. AI-assisted flag only; human review required.`,
      createdAt: demoNow(),
    })

    const data = await getDemoData()
    const meta = {
      clientRef: body.clientRef ?? null,
      patientId: patientRow.id,
      visitId: visit.id,
      patient: mapPatient(patientRow),
      visit: mapVisit(visit),
      triage,
    }
    return NextResponse.json({ ok: true, data, meta })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "intake failed" },
      { status: 500 }
    )
  }
}
