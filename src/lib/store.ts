"use client"

// ============================================================
// MediKiosk — Client state (Zustand)
// One store for UI navigation, accessibility prefs, offline mode,
// demo dataset and domain mutations (optimistic when offline).
// ============================================================

import { create } from "zustand"
import { toast } from "sonner"
import { mutate, getQueue, replayQueue } from "@/lib/api-client"
import type {
  DemoData,
  DocumentRecord,
  Language,
  Referral,
  Role,
  TriageResult,
  View,
} from "@/lib/types"

type TextScale = "normal" | "large" | "xl"

interface IntakeForm {
  name: string
  nameHi?: string
  age: number
  gender: string
  phone: string
  village: string
  district: string
  language: Language
  chiefComplaint: string
  symptoms: string[]
  durationDays: number | null
  durationLabel: string
  severity: "MILD" | "MODERATE" | "SEVERE"
  conditions: string[]
  medications: string[]
  allergies: string[]
  transcript?: string
}

export interface IntakeOutcome {
  patientId: string
  visitId: string
  triage: TriageResult
  returningPatient: boolean
}

interface AppState {
  hydrated: boolean
  loading: boolean
  view: View
  role: Role
  language: Language
  textScale: TextScale
  highContrast: boolean
  audioGuide: boolean
  isOffline: boolean
  syncing: boolean
  data: DemoData | null
  activePatientId: string | null
  activeVisitId: string | null
  activeReferralId: string | null
  activeDocumentId: string | null
  lastTriage: TriageResult | null
  scenario: { id: string | null; step: number }
  guideOpen: boolean
  searchOpen: boolean

  navigate: (v: View) => void
  setRole: (r: Role) => void
  setLanguage: (l: Language) => void
  setTextScale: (t: TextScale) => void
  toggleContrast: () => void
  toggleAudioGuide: () => void
  toggleOffline: () => void
  syncNow: () => Promise<void>
  setData: (d: DemoData) => void
  bootstrap: () => Promise<void>
  resetDemo: () => Promise<void>
  setActivePatient: (patientId: string | null, visitId?: string | null) => void
  setActiveReferral: (id: string | null) => void
  setActiveDocument: (id: string | null) => void
  setLastTriage: (t: TriageResult | null) => void
  setScenario: (id: string | null, step?: number) => void
  scenarioNext: () => void
  setGuideOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void

  submitIntake: (form: IntakeForm, offlineRef?: string) => Promise<IntakeOutcome | null>
  updateVisit: (args: {
    id: string
    status?: string
    validatedBy?: string
    clinicalNote?: string
    by?: string
  }) => Promise<void>
  createReferral: (args: {
    patientId: string
    visitId?: string | null
    reason: string
    origin?: string
    destination: string
    priority: "ROUTINE" | "URGENT" | "EMERGENCY"
    createdBy?: string
  }) => Promise<void>
  updateReferralStatus: (args: {
    id: string
    status: string
    by?: string
    note?: string
  }) => Promise<void>
  createDiagnostic: (args: {
    patientId: string
    visitId?: string | null
    testType: string
    orderedBy?: string
  }) => Promise<void>
  updateDiagnostic: (args: { id: string; status: string; by?: string }) => Promise<void>
  updateFollowUp: (args: {
    id: string
    status: string
    nextDue?: string | null
    notes?: string
    by?: string
  }) => Promise<void>
  scanDocument: (args: {
    patientId: string
    kind: "LAB_REPORT" | "PRESCRIPTION" | "MEDICAL_RECORD"
    fileName?: string
  }) => Promise<DocumentRecord | null>
  validateDocument: (args: {
    id: string
    action: "ACCEPT" | "REJECT"
    editedExtracted?: DocumentRecord["extracted"]
    validatedBy?: string
  }) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  loading: true,
  view: "kiosk",
  role: "kiosk",
  language: "en",
  textScale: "normal",
  highContrast: false,
  audioGuide: false,
  isOffline: false,
  syncing: false,
  data: null,
  activePatientId: null,
  activeVisitId: null,
  activeReferralId: null,
  activeDocumentId: null,
  lastTriage: null,
  scenario: { id: null, step: 0 },
  guideOpen: false,
  searchOpen: false,

  navigate: (v) => set({ view: v }),
  setRole: (r) => set({ role: r }),
  setLanguage: (l) => set({ language: l }),
  setTextScale: (t) => set({ textScale: t }),
  toggleContrast: () => set({ highContrast: !get().highContrast }),
  toggleAudioGuide: () => set({ audioGuide: !get().audioGuide }),

  toggleOffline: () => {
    const next = !get().isOffline
    set({ isOffline: next })
    toast(next ? "📴 Offline mode — changes will be queued locally" : "🌐 Back online", {
      description: next
        ? "Patient intake and records keep working. Pending changes sync when reconnected."
        : "Tap Sync Now to push queued records.",
    })
  },

  syncNow: async () => {
    const q = getQueue()
    if (!q.length) {
      toast.info("Nothing to sync", { description: "No pending offline records." })
      return
    }
    set({ syncing: true })
    try {
      const synced = await replayQueue()
      await get().bootstrap()
      toast.success(`✓ ${synced} record${synced === 1 ? "" : "s"} synchronized`, {
        description: "Offline-captured data is now on the facility server.",
      })
    } catch {
      toast.error("Sync failed", { description: "Will retry on next sync attempt." })
    } finally {
      set({ syncing: false })
    }
  },

  setData: (d) => set({ data: d, loading: false }),

  bootstrap: async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" })
      const json = await res.json()
      if (json.ok) set({ data: json.data as DemoData, loading: false, hydrated: true })
      else set({ loading: false, hydrated: true })
    } catch {
      set({ loading: false, hydrated: true })
      toast.error("Could not reach facility server", {
        description: "Showing cached demo data. Offline features remain available.",
      })
    }
  },

  resetDemo: async () => {
    set({ loading: true })
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" })
      const json = await res.json()
      if (json.ok) {
        set({
          data: json.data as DemoData,
          activePatientId: null,
          activeVisitId: null,
          activeReferralId: null,
          activeDocumentId: null,
          lastTriage: null,
          scenario: { id: null, step: 0 },
          view: "kiosk",
          role: "kiosk",
        })
        toast.success("Demo reset complete", { description: "Environment restored to the starting state." })
      }
    } catch {
      toast.error("Reset failed")
    } finally {
      set({ loading: false })
    }
  },

  setActivePatient: (patientId, visitId = null) =>
    set({ activePatientId: patientId, activeVisitId: visitId ?? null }),
  setActiveReferral: (id) => set({ activeReferralId: id }),
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  setLastTriage: (t) => set({ lastTriage: t }),
  setScenario: (id, step = 0) => set({ scenario: { id, step }, guideOpen: id !== null }),
  scenarioNext: () => set({ scenario: { ...get().scenario, step: get().scenario.step + 1 } }),
  setGuideOpen: (open) => set({ guideOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),

  // ---------- domain ----------

  submitIntake: async (form, offlineRef) => {
    const clientRef = offlineRef ?? `local-${Date.now()}`
    // clientRef marks the record as offline-captured ONLY when actually offline
    const payload = {
      ...form,
      actor: get().role === "frontline" ? "frontline" : "kiosk",
      ...(get().isOffline ? { clientRef } : {}),
    }
    try {
      const { queued, res } = await mutate(
        "POST",
        "/api/intake",
        payload,
        { offline: get().isOffline, label: `Intake — ${form.name}` }
      )
      if (queued) {
        // Optimistic local insert (offline)
        const d = get().data
        const now = new Date().toISOString()
        const tempPatient = {
          id: `local-p-${clientRef}`,
          mrn: "MK-2026-LOCAL",
          name: form.name,
          nameHi: form.nameHi ?? null,
          age: form.age,
          gender: form.gender,
          phone: form.phone,
          village: form.village,
          district: form.district,
          language: form.language,
          allergies: form.allergies,
          conditions: form.conditions,
          medications: form.medications,
          createdAt: now,
        }
        const tempVisit = {
          id: `local-v-${clientRef}`,
          patientId: tempPatient.id,
          type: "KIOSK_INTAKE" as const,
          facility: "Rampur Sub-Centre",
          chiefComplaint: form.chiefComplaint,
          symptoms: form.symptoms,
          durationDays: form.durationDays,
          durationLabel: form.durationLabel,
          severity: form.severity,
          triagePriority: null,
          redFlags: [] as string[],
          aiSummary: null,
          aiRecommendation: null,
          status: "TRIAGED" as const,
          frontlineWorker: null,
          validatedBy: null,
          clinicalNote: null,
          syncStatus: "PENDING" as const,
          createdAt: now,
          updatedAt: now,
        }
        const tempAudit = {
          id: `local-a-${clientRef}`,
          actor: get().role === "frontline" ? "ANM Sunita Sharma" : "Patient (Kiosk self-service)",
          actorRole: "FRONTLINE" as const,
          action: "INTAKE_CREATED",
          target: `${form.name} (offline)`,
          detail: "Captured offline — pending sync",
          createdAt: now,
        }
        if (d) {
          set({
            data: {
              ...d,
              patients: [tempPatient, ...d.patients],
              visits: [tempVisit, ...d.visits],
              audits: [tempAudit, ...d.audits],
            },
          })
        }
        set({
          activePatientId: tempPatient.id,
          activeVisitId: tempVisit.id,
        })
        toast.info("📴 Saved offline — pending sync", {
          description: "This record is stored on this device and will sync automatically.",
        })
        return {
          patientId: tempPatient.id,
          visitId: tempVisit.id,
          triage: {
            priority: "MEDIUM",
            reason: "Offline capture — full triage runs on sync.",
            redFlags: [],
            summary: "Captured offline. AI triage will complete when the device reconnects.",
            recommendation: "Sync when back online to complete AI triage.",
            suggestedWorkflow: "OFFLINE CAPTURE → SYNC → TRIAGE",
            confidence: 0.5,
            engine: "deterministic-rules",
            disclaimer: "AI-assisted risk flag only — not a diagnosis. Requires human review.",
          },
          returningPatient: false,
        }
      }
      const json = res!
      set({ data: json.data })
      const meta = json.meta as {
        patientId: string
        visitId: string
        patient: { id: string }
        triage: TriageResult
      }
      set({
        activePatientId: meta.patientId,
        activeVisitId: meta.visitId,
        lastTriage: meta.triage,
      })
      return {
        patientId: meta.patientId,
        visitId: meta.visitId,
        triage: meta.triage,
        returningPatient: (json.meta as { returningPatient?: boolean }).returningPatient ?? false,
      }
    } catch (e) {
      toast.error("Intake failed", {
        description: e instanceof Error ? e.message : "Try again",
      })
      return null
    }
  },

  updateVisit: async ({ id, status, validatedBy, clinicalNote, by }) => {
    try {
      const { queued, res } = await mutate(
        "PATCH",
        "/api/visits",
        { id, status, validatedBy, clinicalNote, by },
        { offline: get().isOffline, label: `Visit update — ${status ?? "note"}` }
      )
      if (queued) {
        const d = get().data
        if (d) {
          set({
            data: {
              ...d,
              visits: d.visits.map((v) =>
                v.id === id
                  ? {
                      ...v,
                      ...(status ? { status: status as never } : {}),
                      ...(validatedBy ? { validatedBy } : {}),
                      ...(clinicalNote !== undefined ? { clinicalNote } : {}),
                      syncStatus: "PENDING" as const,
                    }
                  : v
              ),
            },
          })
        }
        toast.info("📴 Change saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(status === "COMPLETED" ? "Consultation completed" : "Visit updated")
    } catch (e) {
      toast.error("Update failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  createReferral: async (args) => {
    try {
      const { queued, res } = await mutate(
        "POST",
        "/api/referrals",
        { ...args, createdBy: args.createdBy ?? "ANM Sunita Sharma" },
        { offline: get().isOffline, label: `Referral — ${args.destination}` }
      )
      if (queued) {
        toast.info("📴 Referral saved offline — pending sync")
        await get().bootstrap().catch(() => {})
        return
      }
      set({ data: res!.data })
      const ref = (res!.meta as { referral: Referral }).referral
      set({ activeReferralId: ref.id })
      toast.success(`Referral created → ${args.destination}`, {
        description: `${args.priority} priority — facility has been notified.`,
      })
    } catch (e) {
      toast.error("Referral failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  updateReferralStatus: async ({ id, status, by, note }) => {
    try {
      const { queued, res } = await mutate(
        "PATCH",
        "/api/referrals",
        { id, status, by, note },
        { offline: get().isOffline, label: `Referral → ${status}` }
      )
      if (queued) {
        const d = get().data
        if (d) {
          set({
            data: {
              ...d,
              referrals: d.referrals.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      status: status as Referral["status"],
                      history: [
                        ...r.history,
                        { status, at: new Date().toISOString(), by: by ?? "Facility (offline)", note },
                      ],
                      syncStatus: "PENDING" as never,
                    }
                  : r
              ),
            },
          })
        }
        toast.info("📴 Status saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(`Referral status → ${status.replace("_", " ")}`)
    } catch (e) {
      toast.error("Status update failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  createDiagnostic: async (args) => {
    try {
      const { queued, res } = await mutate(
        "POST",
        "/api/diagnostics",
        { ...args, orderedBy: args.orderedBy ?? "Dr. A. Prasad" },
        { offline: get().isOffline, label: `Diagnostic — ${args.testType}` }
      )
      if (queued) {
        toast.info("📴 Diagnostic order saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(`${args.testType} requested`, {
        description: "Diagnostic workflow started — sample collection pending.",
      })
    } catch (e) {
      toast.error("Diagnostic request failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  updateDiagnostic: async ({ id, status, by }) => {
    try {
      const { queued, res } = await mutate(
        "PATCH",
        "/api/diagnostics",
        { id, status, by },
        { offline: get().isOffline, label: `Diagnostic → ${status}` }
      )
      if (queued) {
        toast.info("📴 Saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(
        status === "RESULT_READY"
          ? "Result available — awaiting doctor review"
          : `Diagnostic status → ${status.replace(/_/g, " ")}`
      )
    } catch (e) {
      toast.error("Update failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  updateFollowUp: async ({ id, status, nextDue, notes, by }) => {
    try {
      const { queued, res } = await mutate(
        "PATCH",
        "/api/followups",
        { id, status, nextDue, notes, by },
        { offline: get().isOffline, label: `Follow-up → ${status}` }
      )
      if (queued) {
        const d = get().data
        if (d) {
          set({
            data: {
              ...d,
              followUps: d.followUps.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      status: status as never,
                      ...(nextDue !== undefined && nextDue ? { nextDue } : {}),
                      ...(notes ? { notes } : {}),
                      syncStatus: "PENDING" as const,
                    }
                  : f
              ),
            },
          })
        }
        toast.info("📴 Follow-up saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(`Follow-up ${status.toLowerCase()}`)
    } catch (e) {
      toast.error("Follow-up update failed", { description: e instanceof Error ? e.message : undefined })
    }
  },

  scanDocument: async (args) => {
    try {
      const { queued, res } = await mutate(
        "POST",
        "/api/documents",
        { ...args, actor: get().role === "frontline" ? "ANM Sunita Sharma" : "Kiosk Operator" },
        { offline: get().isOffline, label: `Document scan — ${args.kind}` }
      )
      if (queued) {
        toast.info("📴 Scan saved offline — pending sync")
        return null
      }
      set({ data: res!.data })
      const doc = (res!.meta as { document: DocumentRecord }).document
      toast.success(`OCR complete — ${doc.extracted.length} fields extracted`, {
        description: "Fields are not clinically verified until a human validates them.",
      })
      set({ activeDocumentId: doc.id })
      return doc
    } catch (e) {
      toast.error("Scan failed", { description: e instanceof Error ? e.message : undefined })
      return null
    }
  },

  validateDocument: async ({ id, action, editedExtracted, validatedBy }) => {
    try {
      const { queued, res } = await mutate(
        "POST",
        "/api/documents/validate",
        { id, action, editedExtracted, validatedBy },
        { offline: get().isOffline, label: `Document ${action.toLowerCase()}` }
      )
      if (queued) {
        const d = get().data
        if (d) {
          set({
            data: {
              ...d,
              documents: d.documents.map((doc) =>
                doc.id === id
                  ? {
                      ...doc,
                      validationStatus: action === "ACCEPT" ? "VALIDATED" : "REJECTED",
                      ...(editedExtracted ? { extracted: editedExtracted } : {}),
                      validatedBy: validatedBy ?? "ANM Sunita Sharma",
                      syncStatus: "PENDING" as never,
                    }
                  : doc
              ),
            },
          })
        }
        toast.info("📴 Validation saved offline — pending sync")
        return
      }
      set({ data: res!.data })
      toast.success(
        action === "ACCEPT"
          ? "✓ Information validated — added to patient record"
          : "✕ Extraction rejected — not added to record"
      )
    } catch (e) {
      toast.error("Validation failed", { description: e instanceof Error ? e.message : undefined })
    }
  },
}))
