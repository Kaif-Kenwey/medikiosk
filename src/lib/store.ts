"use client"

// ============================================================
// MediKiosk — Client state (Zustand)
// One store for UI navigation, accessibility prefs, offline mode,
// JWT session, demo dataset and domain mutations (optimistic when offline).
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

/** Last-good dataset cache — backs the "cached demo data" promise when the
 *  facility server is unreachable at load time (prevents blank screens). */
const CACHE_KEY = "medikiosk.last-good-data.v1"

function readCache(): DemoData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoData
    return parsed && Array.isArray(parsed.patients) ? parsed : null
  } catch {
    return null
  }
}

function writeCache(d: DemoData) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(d))
  } catch {
    // storage full/unavailable — cache is best-effort
  }
}

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
  consent: boolean
  interviewAnswers?: { question: string; answer: string; at: string }[]
  abhaId?: string
}

export interface IntakeOutcome {
  patientId: string
  visitId: string
  triage: TriageResult
  returningPatient: boolean
}

/** Client view of the JWT session (httpOnly cookie holds the token itself) */
export interface ClientSession {
  role: Role
  name: string
  facility?: string | null
  expiresAt?: string
}

interface AppState {
  hydrated: boolean
  loading: boolean
  /** True when bootstrap failed AND no cached dataset is available */
  bootstrapError: boolean
  view: View
  role: Role
  session: ClientSession | null
  authDialogOpen: boolean
  authDialogPreset: Role | null
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
  retryBootstrap: () => Promise<void>
  /** Auto-authenticate the kiosk device (KIOSK role) if no session exists */
  ensureSession: () => Promise<void>
  openAuthDialog: (preset?: Role | null) => void
  closeAuthDialog: () => void
  /** Sign in with a facility identity. Returns true on success. */
  signIn: (role: Role, pin?: string) => Promise<boolean>
  signOut: () => Promise<void>
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
    imageDataUrl?: string
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
  bootstrapError: false,
  view: "kiosk",
  role: "kiosk",
  session: null,
  authDialogOpen: false,
  authDialogPreset: null,
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
    if (get().syncing) return // double-tap guard — never replay the same record twice
    const q = getQueue()
    if (!q.length) {
      toast.info("Nothing to sync", { description: "No pending offline records." })
      return
    }
    set({ syncing: true })
    try {
      const result = await replayQueue()
      await get().bootstrap()
      // Reconcile active selections: offline captures used local temp ids
      // that no longer exist once the server dataset replaces them.
      const d = get().data
      const stalePatient = get().activePatientId
        ? !d?.patients.some((p) => p.id === get().activePatientId)
        : false
      const staleVisit = get().activeVisitId
        ? !d?.visits.some((v) => v.id === get().activeVisitId)
        : false
      if (stalePatient || staleVisit) {
        set({ activePatientId: null, activeVisitId: null, lastTriage: null })
      }
      if (result.synced > 0 && result.failed === 0) {
        toast.success(`✓ ${result.synced} record${result.synced === 1 ? "" : "s"} synchronized`, {
          description: "Offline-captured data is now on the facility server.",
        })
      } else if (result.synced > 0 && result.failed > 0) {
        toast.warning(`✓ ${result.synced} synced · ${result.failed} could not be accepted`, {
          description: `${result.failedLabels.slice(0, 2).join(", ")}${result.failedLabels.length > 2 ? "…" : ""} — the server rejected ${result.failed === 1 ? "it" : "them"}. Nothing was lost; review the records.`,
        })
      } else if (result.failed > 0 && result.remaining === 0) {
        toast.error(`${result.failed} record${result.failed === 1 ? "" : "s"} not accepted by the server`, {
          description: `${result.failedLabels.slice(0, 2).join(", ")}${result.failedLabels.length > 2 ? "…" : ""} — please re-enter or correct ${result.failed === 1 ? "it" : "them"}.`,
        })
      }
    } catch {
      toast.error("Sync failed", { description: "Records stay safely queued. Will retry on next sync attempt." })
    } finally {
      set({ syncing: false })
    }
  },

  setData: (d) => set({ data: d, loading: false }),

  bootstrap: async () => {
    // Try the server up to 3 times (transient hiccups happen right after a
    // server restart). Never leave the UI rendering views with no dataset.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/bootstrap", { cache: "no-store" })
        const json = await res.json()
        if (json.ok && json.data) {
          const d = json.data as DemoData
          writeCache(d)
          set({ data: d, loading: false, hydrated: true, bootstrapError: false })
          return
        }
      } catch {
        // network error — retry below
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
    // All attempts failed — fall back to the last-good cached dataset
    const cached = readCache()
    if (cached) {
      set({ data: cached, loading: false, hydrated: true, bootstrapError: false })
      toast.error("Could not reach facility server", {
        description: "Showing the last data loaded on this device. Offline features remain available.",
      })
      return
    }
    // No cache either — show the explicit error screen (never a blank page)
    set({ loading: false, hydrated: true, bootstrapError: true })
  },

  retryBootstrap: async () => {
    set({ loading: true, bootstrapError: false })
    await get().bootstrap()
  },

  // ---------- auth (JWT session) ----------

  ensureSession: async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        const s = (json.meta as { session?: ClientSession })?.session
        if (s) {
          set({ session: s, role: s.role })
          return
        }
      }
    } catch {
      // server unreachable — stay signed out; offline queue still works
    }
    // No valid session — auto-authenticate as the patient-facing kiosk device
    try {
      await get().signIn("kiosk")
    } catch {
      // non-fatal: kiosk keeps working read-only until server returns
    }
  },

  openAuthDialog: (preset = null) => set({ authDialogOpen: true, authDialogPreset: preset }),
  closeAuthDialog: () => set({ authDialogOpen: false, authDialogPreset: null }),

  signIn: async (role, pin) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, pin }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error("Sign in failed", { description: json.error ?? "Try again" })
        return false
      }
      const s = (json.meta as { session?: ClientSession })?.session
      set({ session: s ?? { role, name: role }, role, authDialogOpen: false, authDialogPreset: null })
      if (role !== "kiosk") {
        toast.success(`Signed in as ${s?.name ?? role}`, {
          description: "JWT session issued — actions are now attributed in the audit trail.",
        })
      }
      return true
    } catch {
      toast.error("Sign in failed", { description: "Could not reach the facility server." })
      return false
    }
  },

  signOut: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // cookie clear is best-effort
    }
    set({ session: null, role: "kiosk" })
    toast.info("Signed out", { description: "Kiosk device session ended." })
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
      } else if (res.status === 401 || res.status === 403) {
        set({ authDialogOpen: true, authDialogPreset: "admin" })
        toast.error("Administrator sign-in required", {
          description: "Demo reset is restricted to the Facility Administrator role.",
        })
      } else {
        toast.error("Reset failed", { description: json.error ?? "Try again" })
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
          phoneHash: null,
          abhaId: null,
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
          interviewAnswers: (form.interviewAnswers ?? []) as never,
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
        const tempConsent = {
          id: `local-c-${clientRef}`,
          patientId: tempPatient.id,
          visitId: tempVisit.id,
          scope: "KIOSK_INTAKE" as const,
          granted: true,
          method: "KIOSK_CHECKBOX" as const,
          language: form.language,
          at: now,
          withdrawnAt: null,
        }
        if (d) {
          set({
            data: {
              ...d,
              patients: [tempPatient, ...d.patients],
              visits: [tempVisit, ...d.visits],
              consents: [tempConsent, ...d.consents],
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
      const engine = (res!.meta as { engine?: string }).engine ?? "simulated-template"
      toast.success(`OCR complete — ${doc.extracted.length} fields extracted`, {
        description:
          engine === "vision-ocr"
            ? "Read from the uploaded image by the vision model. Not clinically verified until a human validates them."
            : "Fields are not clinically verified until a human validates them.",
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
