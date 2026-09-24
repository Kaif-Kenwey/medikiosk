// ============================================================
// MediKiosk — Demo dataset seeder (SERVER ONLY)
// All data is FICTIONAL and synthetic. No real patient data.
// Demo clock: 23 Sep 2026, 09:00 IST (per SIH example dates).
// ============================================================

import { db } from "@/lib/db"

const D = (s: string) => new Date(s) // helper for readability

export async function seedDemoData() {
  // Wipe all collections (demo reset)
  await db.auditEvent.deleteMany()
  await db.documentRecord.deleteMany()
  await db.followUp.deleteMany()
  await db.medicineStock.deleteMany()
  await db.diagnosticRequest.deleteMany()
  await db.referral.deleteMany()
  await db.visit.deleteMany()
  await db.patient.deleteMany()

  // ---------------- Patients (fictional) ----------------
  const sita = await db.patient.create({
    data: {
      mrn: "MK-2026-0341",
      name: "Sita Devi",
      nameHi: "सीता देवी",
      age: 46,
      gender: "Female",
      phone: "98301 22114",
      village: "Rampur",
      district: "Gopalganj",
      language: "hi",
      allergies: JSON.stringify(["Sulfa drugs"]),
      conditions: JSON.stringify(["Anemia (mild)"]),
      medications: JSON.stringify(["Iron + Folic Acid tablet — once daily"]),
      createdAt: D("2026-06-03T10:12:00+05:30"),
    },
  })

  const rahul = await db.patient.create({
    data: {
      mrn: "MK-2026-0287",
      name: "Rahul Kumar",
      nameHi: "राहुल कुमार",
      age: 32,
      gender: "Male",
      phone: "98300 44192",
      village: "Bharwalia",
      district: "Gopalganj",
      language: "hi",
      allergies: JSON.stringify([]),
      conditions: JSON.stringify(["Hypertension (stage 1)"]),
      medications: JSON.stringify(["Amlodipine 5 mg — once daily"]),
      createdAt: D("2026-05-11T09:30:00+05:30"),
    },
  })

  const asha = await db.patient.create({
    data: {
      mrn: "MK-2026-0368",
      name: "Asha Kumari",
      nameHi: "आशा कुमारी",
      age: 28,
      gender: "Female",
      phone: "98391 77310",
      village: "Rampur",
      district: "Gopalganj",
      language: "hi",
      allergies: JSON.stringify([]),
      conditions: JSON.stringify(["Pregnancy — 2nd trimester (ANC)"]),
      medications: JSON.stringify(["Iron + Folic Acid", "Calcium tablet"]),
      createdAt: D("2026-07-19T11:00:00+05:30"),
    },
  })

  const ramesh = await db.patient.create({
    data: {
      mrn: "MK-2026-0193",
      name: "Ramesh Yadav",
      nameHi: "रमेश यादव",
      age: 58,
      gender: "Male",
      phone: "98011 51876",
      village: "Khajuri",
      district: "Gopalganj",
      language: "hi",
      allergies: JSON.stringify([]),
      conditions: JSON.stringify(["Type 2 Diabetes", "Hypertension"]),
      medications: JSON.stringify(["Metformin 500 mg — twice daily"]),
      createdAt: D("2026-03-02T10:00:00+05:30"),
    },
  })

  const lakshmi = await db.patient.create({
    data: {
      mrn: "MK-2026-0412",
      name: "Lakshmi Devi",
      nameHi: "लक्ष्मी देवी",
      age: 67,
      gender: "Female",
      phone: "98352 60241",
      village: "Siswani",
      district: "Gopalganj",
      language: "hi",
      allergies: JSON.stringify(["Penicillin"]),
      conditions: JSON.stringify(["Osteoarthritis (knees)"]),
      medications: JSON.stringify(["Calcium + Vitamin D3"]),
      createdAt: D("2026-04-22T12:20:00+05:30"),
    },
  })

  // ---------------- Visits (longitudinal history) ----------------
  await db.visit.createMany({
    data: [
      {
        patientId: sita.id,
        type: "HOSPITAL_VISIT",
        facility: "Gopalganj District Hospital",
        chiefComplaint: "Fever — treated as acute febrile illness",
        symptoms: JSON.stringify(["Fever", "Body ache"]),
        durationDays: 4,
        durationLabel: "4 days",
        severity: "MODERATE",
        triagePriority: "MEDIUM",
        redFlags: "[]",
        status: "COMPLETED",
        validatedBy: "Dr. A. Prasad",
        clinicalNote: "Treated for acute febrile illness. Advised CBC if fever recurs.",
        createdAt: D("2026-06-03T10:12:00+05:30"),
        updatedAt: D("2026-06-03T15:40:00+05:30"),
      },
      {
        patientId: sita.id,
        type: "PHC_VISIT",
        facility: "Rampur PHC",
        chiefComplaint: "Routine anemia review — lab sample collected",
        symptoms: JSON.stringify(["Fatigue"]),
        durationDays: null,
        durationLabel: null,
        severity: "MILD",
        triagePriority: "LOW",
        redFlags: "[]",
        status: "COMPLETED",
        validatedBy: "ANM Sunita Sharma",
        clinicalNote: "CBC ordered. Hemoglobin low — continue IFA, review in 4 weeks.",
        createdAt: D("2026-08-12T09:45:00+05:30"),
        updatedAt: D("2026-08-12T11:10:00+05:30"),
      },
      {
        patientId: rahul.id,
        type: "PHC_VISIT",
        facility: "Rampur PHC",
        chiefComplaint: "BP follow-up",
        symptoms: JSON.stringify([]),
        durationDays: null,
        durationLabel: null,
        severity: "MILD",
        triagePriority: "LOW",
        redFlags: "[]",
        status: "COMPLETED",
        validatedBy: "Dr. A. Prasad",
        clinicalNote: "BP 128/84 on Amlodipine 5 mg. Continue. Review 3 months.",
        createdAt: D("2026-05-11T09:30:00+05:30"),
        updatedAt: D("2026-05-11T10:05:00+05:30"),
      },
      {
        patientId: asha.id,
        type: "PHC_VISIT",
        facility: "Rampur Sub-Centre",
        chiefComplaint: "ANC registration — 2nd trimester",
        symptoms: JSON.stringify([]),
        durationDays: null,
        durationLabel: null,
        severity: "MILD",
        triagePriority: "LOW",
        redFlags: "[]",
        status: "COMPLETED",
        validatedBy: "ANM Sunita Sharma",
        clinicalNote: "ANC visit 1 complete. IFA + Calcium issued. Next ANC due 25 Sep.",
        createdAt: D("2026-07-19T11:00:00+05:30"),
        updatedAt: D("2026-07-19T11:35:00+05:30"),
      },
      {
        patientId: ramesh.id,
        type: "KIOSK_INTAKE",
        facility: "Rampur Sub-Centre",
        chiefComplaint: "Diabetes routine review",
        symptoms: JSON.stringify([]),
        durationDays: null,
        durationLabel: null,
        severity: "MILD",
        triagePriority: "LOW",
        redFlags: "[]",
        status: "COMPLETED",
        validatedBy: "Dr. A. Prasad",
        clinicalNote: "Continue Metformin. HbA1c ordered.",
        createdAt: D("2026-03-02T10:00:00+05:30"),
        updatedAt: D("2026-03-02T10:40:00+05:30"),
      },
    ],
  })

  // ---------------- Documents ----------------
  await db.documentRecord.createMany({
    data: [
      {
        patientId: sita.id,
        type: "LAB_REPORT",
        title: "Complete Blood Count (CBC)",
        fileName: "cbc_sita_aug.pdf",
        source: "Rampur PHC Laboratory",
        ocrText: "Hemoglobin: 10.2 g/dL | WBC: 9,800 /uL | Platelets: 2,30,000 /uL",
        extracted: JSON.stringify([
          { field: "Hemoglobin", value: "10.2", unit: "g/dL", confidence: 0.96, source: "Lab report — CBC panel", flag: "low" },
          { field: "Report Date", value: "12 Aug 2026", confidence: 0.97, source: "Lab report header", flag: "info" },
        ]),
        validationStatus: "VALIDATED",
        validatedBy: "ANM Sunita Sharma",
        createdAt: D("2026-08-12T10:30:00+05:30"),
        validatedAt: D("2026-08-12T10:42:00+05:30"),
      },
      {
        patientId: ramesh.id,
        type: "PRESCRIPTION",
        title: "Outpatient Prescription",
        fileName: "rx_ramesh_mar.jpg",
        source: "Siwan Rural Hospital — OPD",
        ocrText: "Rx: Metformin 500 mg BD — 30 days. Review after 30 days.",
        extracted: JSON.stringify([
          { field: "Medicine 1", value: "Metformin 500 mg — twice daily — 30 days", confidence: 0.93, source: "Prescription — Rx line 1", flag: "info" },
        ]),
        validationStatus: "VALIDATED",
        validatedBy: "Dr. A. Prasad",
        createdAt: D("2026-03-02T10:20:00+05:30"),
        validatedAt: D("2026-03-02T10:25:00+05:30"),
      },
      {
        patientId: asha.id,
        type: "MEDICAL_RECORD",
        title: "ANC Card — Visit 1",
        fileName: "anc_asha.jpg",
        source: "Rampur Sub-Centre",
        ocrText: "ANC Visit 1 — LMP 12 Mar 2026, EDD 17 Dec 2026. BP 112/74. Hb 11.4.",
        extracted: JSON.stringify([
          { field: "Hemoglobin", value: "11.4", unit: "g/dL", confidence: 0.9, source: "ANC card", flag: "normal" },
          { field: "Blood Pressure", value: "112/74", unit: "mmHg", confidence: 0.89, source: "ANC card", flag: "normal" },
          { field: "EDD", value: "17 Dec 2026", confidence: 0.92, source: "ANC card", flag: "info" },
        ]),
        validationStatus: "PENDING",
        createdAt: D("2026-09-20T14:10:00+05:30"),
      },
    ],
  })

  // ---------------- Referrals ----------------
  await db.referral.createMany({
    data: [
      {
        patientId: sita.id,
        reason: "Acute febrile illness — hospital consultation",
        origin: "Rampur PHC",
        destination: "Gopalganj District Hospital",
        priority: "URGENT",
        status: "COMPLETED",
        assignedTo: "Dr. A. Prasad",
        history: JSON.stringify([
          { status: "PENDING", at: "2026-06-03T10:30:00+05:30", by: "ANM Sunita Sharma" },
          { status: "ACCEPTED", at: "2026-06-03T11:02:00+05:30", by: "Dr. A. Prasad" },
          { status: "IN_TRANSIT", at: "2026-06-03T11:20:00+05:30", by: "ASHA Worker Meena" },
          { status: "ARRIVED", at: "2026-06-03T12:45:00+05:30", by: "Hospital Front Desk" },
          { status: "IN_CONSULTATION", at: "2026-06-03T13:10:00+05:30", by: "Dr. A. Prasad" },
          { status: "COMPLETED", at: "2026-06-03T15:40:00+05:30", by: "Dr. A. Prasad" },
        ]),
        createdAt: D("2026-06-03T10:30:00+05:30"),
        updatedAt: D("2026-06-03T15:40:00+05:30"),
      },
      {
        patientId: ramesh.id,
        reason: "Uncontrolled fasting sugars — physician review",
        origin: "Rampur Sub-Centre",
        destination: "Siwan Rural Hospital",
        priority: "ROUTINE",
        status: "ACCEPTED",
        assignedTo: "Dr. R. Mishra",
        appointmentAt: D("2026-09-25T10:30:00+05:30"),
        history: JSON.stringify([
          { status: "PENDING", at: "2026-09-22T09:15:00+05:30", by: "ASHA Worker Meena" },
          { status: "ACCEPTED", at: "2026-09-22T14:40:00+05:30", by: "Dr. R. Mishra" },
        ]),
        createdAt: D("2026-09-22T09:15:00+05:30"),
        updatedAt: D("2026-09-22T14:40:00+05:30"),
      },
      {
        patientId: lakshmi.id,
        reason: "Bilateral knee pain — orthopaedic opinion",
        origin: "Rampur PHC",
        destination: "Gopalganj District Hospital",
        priority: "ROUTINE",
        status: "PENDING",
        history: JSON.stringify([
          { status: "PENDING", at: "2026-09-21T16:05:00+05:30", by: "ANM Sunita Sharma" },
        ]),
        createdAt: D("2026-09-21T16:05:00+05:30"),
        updatedAt: D("2026-09-21T16:05:00+05:30"),
      },
    ],
  })

  // ---------------- Diagnostics ----------------
  await db.diagnosticRequest.createMany({
    data: [
      {
        patientId: ramesh.id,
        testType: "HBA1C",
        status: "PROCESSING",
        orderedBy: "Dr. A. Prasad",
        createdAt: D("2026-09-22T09:20:00+05:30"),
      },
      {
        patientId: rahul.id,
        testType: "BLOOD_GLUCOSE",
        status: "RESULT_READY",
        result: "Fasting: 104 mg/dL | Post-prandial: 138 mg/dL",
        resultSummary: "Values within acceptable range for stage-1 hypertension care plan.",
        orderedBy: "Dr. A. Prasad",
        createdAt: D("2026-09-20T10:00:00+05:30"),
        completedAt: D("2026-09-21T09:30:00+05:30"),
      },
    ],
  })

  // ---------------- Medicine stock ----------------
  const medicines: [string, string, "AVAILABLE" | "LOW" | "OUT", number, string][] = [
    ["Paracetamol 500 mg", "Rampur Sub-Centre", "AVAILABLE", 850, "tablets"],
    ["Paracetamol 500 mg", "Rampur PHC", "AVAILABLE", 2400, "tablets"],
    ["Paracetamol 500 mg", "Siwan Rural Hospital", "LOW", 120, "tablets"],
    ["Paracetamol 500 mg", "Gopalganj District Hospital", "AVAILABLE", 5200, "tablets"],
    ["Amoxicillin 500 mg", "Rampur Sub-Centre", "LOW", 40, "capsules"],
    ["Amoxicillin 500 mg", "Rampur PHC", "AVAILABLE", 600, "capsules"],
    ["Amoxicillin 500 mg", "Siwan Rural Hospital", "AVAILABLE", 900, "capsules"],
    ["ORS Sachet", "Rampur Sub-Centre", "AVAILABLE", 300, "sachets"],
    ["ORS Sachet", "Rampur PHC", "AVAILABLE", 750, "sachets"],
    ["ORS Sachet", "Siwan Rural Hospital", "AVAILABLE", 400, "sachets"],
    ["Iron + Folic Acid", "Rampur Sub-Centre", "AVAILABLE", 500, "tablets"],
    ["Iron + Folic Acid", "Rampur PHC", "AVAILABLE", 1200, "tablets"],
    ["Iron + Folic Acid", "Siwan Rural Hospital", "LOW", 90, "tablets"],
    ["Metformin 500 mg", "Rampur Sub-Centre", "OUT", 0, "tablets"],
    ["Metformin 500 mg", "Rampur PHC", "LOW", 60, "tablets"],
    ["Metformin 500 mg", "Siwan Rural Hospital", "AVAILABLE", 700, "tablets"],
    ["Metformin 500 mg", "Gopalganj District Hospital", "AVAILABLE", 1800, "tablets"],
    ["Amlodipine 5 mg", "Rampur Sub-Centre", "AVAILABLE", 220, "tablets"],
    ["Amlodipine 5 mg", "Rampur PHC", "AVAILABLE", 480, "tablets"],
    ["Salbutamol Inhaler", "Rampur PHC", "LOW", 6, "inhalers"],
    ["Salbutamol Inhaler", "Gopalganj District Hospital", "AVAILABLE", 35, "inhalers"],
    ["Cetirizine 10 mg", "Rampur Sub-Centre", "AVAILABLE", 400, "tablets"],
    ["Cetirizine 10 mg", "Rampur PHC", "AVAILABLE", 900, "tablets"],
  ]
  await db.medicineStock.createMany({
    data: medicines.map(([medicine, facility, status, quantity, unit]) => ({
      medicine,
      facility,
      status,
      quantity,
      unit,
      updatedAt: D("2026-09-22T18:00:00+05:30"),
    })),
  })

  // ---------------- Follow-ups ----------------
  await db.followUp.createMany({
    data: [
      {
        patientId: asha.id,
        category: "MATERNAL",
        risk: "HIGH",
        lastVisit: D("2026-07-19T11:00:00+05:30"),
        nextDue: D("2026-09-25T10:00:00+05:30"),
        assignedWorker: "ANM Sunita Sharma",
        status: "PENDING",
        notes: "ANC visit 2 due. Check BP, Hb, fetal movement.",
      },
      {
        patientId: ramesh.id,
        category: "CHRONIC",
        risk: "MEDIUM",
        lastVisit: D("2026-09-22T09:15:00+05:30"),
        nextDue: D("2026-09-30T09:00:00+05:30"),
        assignedWorker: "ASHA Worker Meena",
        status: "CONTACTED",
        notes: "Confirm fasting sugar before physician review.",
      },
      {
        patientId: lakshmi.id,
        category: "MISSED",
        risk: "MEDIUM",
        lastVisit: D("2026-08-28T10:00:00+05:30"),
        nextDue: D("2026-09-18T09:00:00+05:30"),
        assignedWorker: "ASHA Worker Meena",
        status: "PENDING",
        notes: "Missed September BP check — contact urgently.",
      },
      {
        patientId: rahul.id,
        category: "CHRONIC",
        risk: "LOW",
        lastVisit: D("2026-09-20T10:00:00+05:30"),
        nextDue: D("2026-10-20T09:00:00+05:30"),
        assignedWorker: "ASHA Worker Meena",
        status: "RESCHEDULED",
        notes: "Monthly BP check.",
      },
    ],
  })

  // ---------------- Audit seed ----------------
  await db.auditEvent.createMany({
    data: [
      { actor: "System", actorRole: "SYSTEM", action: "DEMO_SEED", target: "Database", detail: "Demo dataset initialized", createdAt: D("2026-09-23T08:55:00+05:30") },
      { actor: "ANM Sunita Sharma", actorRole: "FRONTLINE", action: "VIEW_PATIENT_RECORD", target: "MK-2026-0287 Rahul Kumar", detail: "Opened longitudinal record", createdAt: D("2026-09-23T09:01:00+05:30") },
      { actor: "MediKiosk AI", actorRole: "AI_SERVICE", action: "TRIAGE_GENERATED", target: "MK-2026-0193 Ramesh Yadav", detail: "Routine priority — deterministic rules", createdAt: D("2026-09-23T09:02:00+05:30") },
    ],
  })

  // ---------------- Security at rest + consent artifacts ----------------
  // All patient phones are stored AES-256-GCM encrypted with a blind index
  // for continuity match; each returning patient carries a consent artifact.
  const { encryptField, blindIndex } = await import("@/lib/crypto")
  const seededPatients = await db.patient.findMany()
  for (const p of seededPatients) {
    if (!p.phone.startsWith("enc.v1:")) {
      await db.patient.update({
        where: { id: p.id },
        data: { phone: encryptField(p.phone), phoneHash: blindIndex(p.phone) },
      })
    }
  }
  const consentSeed: { patientId: string; visitId: string | null; at: Date }[] = [
    { patientId: sita.id, visitId: null, at: D("2026-06-03T10:12:00+05:30") },
    { patientId: rahul.id, visitId: null, at: D("2026-05-11T09:30:00+05:30") },
    { patientId: asha.id, visitId: null, at: D("2026-07-19T11:00:00+05:30") },
    { patientId: ramesh.id, visitId: null, at: D("2026-03-02T10:00:00+05:30") },
    { patientId: lakshmi.id, visitId: null, at: D("2026-04-22T12:20:00+05:30") },
  ]
  await db.consentRecord.createMany({
    data: consentSeed.map((c) => ({
      patientId: c.patientId,
      visitId: c.visitId,
      scope: "KIOSK_INTAKE",
      granted: true,
      method: "KIOSK_CHECKBOX",
      language: "hi",
      at: c.at,
    })),
  })

  return { ok: true }
}
