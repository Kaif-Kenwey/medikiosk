// ============================================================
// MediKiosk — FHIR R4 / ABDM interoperability mapping (server)
//
// This is an ABDM-ALIGNED ABSTRACTION for the prototype.
// It demonstrates how MediKiosk's internal records map to FHIR R4
// resources. It is NOT a live ABDM/HIP connection and must not be
// presented as one.
// ============================================================

import type { DemoData, Patient } from "@/lib/types"

const FACILITY_ID: Record<string, string> = {
  "Rampur Sub-Centre": "facility-rampur-sc",
  "Rampur PHC": "facility-rampur-phc",
  "Siwan Rural Hospital": "facility-siwan-rh",
  "Gopalganj District Hospital": "facility-gopalganj-dh",
}

const STATUS_MAP_REFERRAL: Record<string, string> = {
  PENDING: "requested",
  ACCEPTED: "accepted",
  IN_TRANSIT: "in-progress",
  ARRIVED: "in-progress",
  IN_CONSULTATION: "in-progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
}

/**
 * Maps a MediKiosk patient (with visits, labs, referrals, diagnostics,
 * documents, medications) to a FHIR R4 Bundle.
 */
export function buildFhirBundle(patient: Patient, data: DemoData) {
  const pid = `patient/${patient.id}`
  const entries: { fullUrl?: string; resource: Record<string, unknown> }[] = []

  // ---- Composition (required first entry for Bundle.type = "document") ----
  entries.push({
    fullUrl: `composition/${patient.id}`,
    resource: {
      resourceType: "Composition",
      id: `comp-${patient.id}`,
      status: "final",
      type: { text: "Patient record extract (demo abstraction)" },
      title: `MediKiosk record — ${patient.name} (${patient.mrn})`,
      date: new Date().toISOString(),
      // ABDM-aligned demo subject/custodian — not a registered HIP
      subject: { reference: pid, display: patient.name },
      author: [{ display: "MediKiosk (SIH26133 prototype)" }],
      custodian: { display: "MediKiosk demo facility network" },
      section: [
        {
          title: "Encounters, observations, medications, requests and documents",
          code: { text: "Continuity of care record" },
          text: {
            status: "generated",
            div: '<div xmlns="http://www.w3.org/1999/xhtml">Demo export — ABDM-aligned abstraction, not a live integration.</div>',
          },
        },
      ],
    },
  })

  // ---- Patient ----
  entries.push({
    fullUrl: pid,
    resource: {
      resourceType: "Patient",
      id: patient.id,
      identifier: [
        { system: "https://medikiosk.demo/mrn", value: patient.mrn },
        { system: "https://healthid.abdm.gov.in", value: `demo-${patient.phone.replace(/\s/g, "")}@abdm` },
      ],
      name: [{ text: patient.name }],
      gender: patient.gender.toLowerCase(),
      birthDate: String(2026 - patient.age),
      telecom: [{ system: "phone", value: patient.phone }],
      address: [{ village: patient.village, district: patient.district, country: "IN" }],
    },
  })

  // ---- Encounters (visits) ----
  for (const v of data.visits.filter((x) => x.patientId === patient.id)) {
    entries.push({
      resource: {
        resourceType: "Encounter",
        id: v.id,
        status: v.status === "COMPLETED" ? "finished" : "in-progress",
        class: { code: v.type === "KIOSK_INTAKE" ? "EMER" : "AMB", display: v.type },
        subject: { reference: pid },
        participant: [{ individual: { display: v.validatedBy ?? v.frontlineWorker ?? "Unassigned" } }],
        period: { start: v.createdAt },
        reasonCode: [{ text: v.chiefComplaint }],
        serviceProvider: { display: v.facility },
      },
    })
  }

  // ---- Observations (symptoms + red flags + lab values from documents) ----
  for (const v of data.visits.filter((x) => x.patientId === patient.id)) {
    for (const s of v.symptoms) {
      entries.push({
        resource: {
          resourceType: "Observation",
          id: `${v.id}-symptom-${entries.length}`,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
          code: { text: `Reported symptom: ${s}` },
          subject: { reference: pid },
          effectiveDateTime: v.createdAt,
          valueString: s,
        },
      })
    }
  }
  for (const d of data.documents.filter((x) => x.patientId === patient.id && x.validationStatus === "VALIDATED")) {
    for (const f of d.extracted) {
      if (f.flag === "info") continue
      // Numeric values → valueQuantity; composite/non-numeric values
      // (e.g. BP "138/88") → valueString so no data is silently dropped
      const numeric = f.value.includes("/") ? NaN : Number(f.value.replace(/,/g, ""))
      const valueQuantity =
        Number.isFinite(numeric)
          ? { value: numeric, unit: f.unit ?? "" }
          : undefined
      entries.push({
        resource: {
          resourceType: "Observation",
          id: `${d.id}-${f.field.replace(/\s/g, "-").toLowerCase()}`,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
          code: { text: f.field },
          subject: { reference: pid },
          effectiveDateTime: d.createdAt,
          ...(valueQuantity ? { valueQuantity } : { valueString: f.value + (f.unit ? ` ${f.unit}` : "") }),
          note: [{ text: `Human-validated from ${f.source}` }],
        },
      })
    }
  }

  // ---- MedicationRequest ----
  for (const m of patient.medications) {
    entries.push({
      resource: {
        resourceType: "MedicationRequest",
        id: `med-${patient.id}-${entries.length}`,
        status: "active",
        intent: "order",
        medicationCodeableConcept: { text: m },
        subject: { reference: pid },
        authoredOn: patient.createdAt,
      },
    })
  }

  // ---- ServiceRequest (diagnostics) ----
  for (const d of data.diagnostics.filter((x) => x.patientId === patient.id)) {
    entries.push({
      resource: {
        resourceType: "ServiceRequest",
        id: d.id,
        status: d.status === "REVIEWED" ? "completed" : "active",
        intent: "order",
        code: { text: d.testType },
        subject: { reference: pid },
        authoredOn: d.createdAt,
        requester: { display: d.orderedBy ?? "Unknown" },
      },
    })
  }

  // ---- ReferralRequest (Task used for facility workflow status) ----
  for (const r of data.referrals.filter((x) => x.patientId === patient.id)) {
    entries.push({
      resource: {
        resourceType: "Task",
        id: r.id,
        status: (STATUS_MAP_REFERRAL[r.status] ?? "requested") as string,
        intent: "order",
        code: { text: `Referral: ${r.reason}` },
        for: { reference: pid },
        authoredOn: r.createdAt,
        owner: { display: r.destination, identifier: FACILITY_ID[r.destination] },
        note: [{ text: `${r.origin} → ${r.destination} (${r.priority})` }],
      },
    })
  }

  // ---- DocumentReference ----
  for (const d of data.documents.filter((x) => x.patientId === patient.id)) {
    entries.push({
      resource: {
        resourceType: "DocumentReference",
        id: d.id,
        status: d.validationStatus === "REJECTED" ? "entered-in-error" : "current",
        type: { text: d.title },
        subject: { reference: pid },
        date: d.createdAt,
        description: `${d.type} — ${d.source ?? "unknown source"} — ${d.validationStatus.toLowerCase()}`,
      },
    })
  }

  return {
    resourceType: "Bundle",
    id: `medikiosk-bundle-${patient.id}`,
    meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"] },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: entries,
  }
}
