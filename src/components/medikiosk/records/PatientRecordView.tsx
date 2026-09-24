"use client"

// ============================================================
// MediKiosk — Patient Record (longitudinal "showpiece" view)
// One patient. One continuous healthcare history: visits,
// documents, referrals, diagnostics and follow-ups — connected.
// ============================================================

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Ambulance,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Copy,
  FileJson,
  FileText,
  FileUp,
  FlaskConical,
  History,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  Pill,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AINote,
  EmptyState,
  PriorityBadge,
  PatientAvatar,
  SectionTitle,
  StatusBadge,
  SyncBadge,
} from "@/components/medikiosk/shared"
import { formatDate, formatTime, isToday, statusLabel } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type {
  DiagnosticRequest,
  DocumentRecord,
  FollowUp,
  Patient,
  Referral,
  Visit,
} from "@/lib/types"

// ---------- local constants & helpers ----------

const DOC_TYPE_LABEL: Record<DocumentRecord["type"], string> = {
  LAB_REPORT: "Lab report",
  PRESCRIPTION: "Prescription",
  MEDICAL_RECORD: "Medical record",
}

const VISIT_STATUS_STYLES: Record<Visit["status"], string> = {
  WAITING: "border-amber-200 bg-amber-50 text-amber-700",
  TRIAGED: "border-teal-200 bg-teal-50 text-teal-700",
  ESCALATED: "border-red-200 bg-red-50 text-red-700",
  IN_CONSULTATION: "border-teal-200 bg-teal-50 text-teal-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

const REFERRAL_PRIORITY_STYLES: Record<Referral["priority"], string> = {
  ROUTINE: "border-gray-200 bg-gray-50 text-gray-600",
  URGENT: "border-amber-200 bg-amber-50 text-amber-700",
  EMERGENCY: "border-red-200 bg-red-50 text-red-700",
}

const FOLLOWUP_CATEGORY_STYLES: Record<FollowUp["category"], string> = {
  MATERNAL: "border-teal-200 bg-teal-50 text-teal-700",
  CHILD: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CHRONIC: "border-amber-200 bg-amber-50 text-amber-700",
  HIGH_RISK: "border-red-200 bg-red-50 text-red-700",
  MISSED: "border-gray-200 bg-gray-50 text-gray-600",
}

const TIMELINE_LIMIT = 12

type TimelineEvent =
  | { key: string; kind: "visit"; date: string; visit: Visit }
  | { key: string; kind: "document"; date: string; doc: DocumentRecord }
  | { key: string; kind: "referral"; date: string; ref: Referral }
  | { key: string; kind: "diagnostic"; date: string; diag: DiagnosticRequest }
  | { key: string; kind: "followup"; date: string; followUp: FollowUp }

function timelineDot(ev: TimelineEvent): string {
  switch (ev.kind) {
    case "visit":
      return ev.visit.redFlags.length > 0 ? "bg-red-500" : "bg-teal-500"
    case "document":
      return "bg-gray-400"
    case "referral":
      if (ev.ref.status === "COMPLETED") return "bg-emerald-500"
      if (ev.ref.status === "CANCELLED") return "bg-gray-400"
      return "bg-amber-500"
    case "diagnostic":
      return ev.diag.status === "REVIEWED" ? "bg-emerald-500" : "bg-teal-400"
    case "followup":
      return ev.followUp.status === "COMPLETED" ? "bg-emerald-500" : "bg-amber-400"
  }
}

// ---------- FHIR types (minimal client-side shape) ----------

interface FhirBundle {
  resourceType: string
  type?: string
  total?: number
  entry?: { resource?: { resourceType?: string } }[]
}

// ---------- view ----------

export default function PatientRecordView() {
  const { data, activePatientId, navigate, setActiveDocument, isOffline } = useAppStore()

  const [showAllEvents, setShowAllEvents] = useState(false)
  const [bundle, setBundle] = useState<FhirBundle | null>(null)
  const [fhirLoading, setFhirLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [aiSummary, setAiSummary] = useState<{ summary: string; engine: string; disclaimer: string } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [withdrawingConsent, setWithdrawingConsent] = useState(false)

  const patient = useMemo<Patient | null>(() => {
    if (!data) return null
    return data.patients.find((p) => p.id === activePatientId) ?? null
  }, [data, activePatientId])

  const visits = useMemo(() => (data ? data.visits.filter((v) => v.patientId === patient?.id) : []), [data, patient])

  const documents = useMemo(
    () =>
      data
        ? data.documents.filter((d) => d.patientId === patient?.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [data, patient]
  )

  const referrals = useMemo(
    () => (data ? data.referrals.filter((r) => r.patientId === patient?.id) : []),
    [data, patient]
  )

  const diagnostics = useMemo(
    () => (data ? data.diagnostics.filter((d) => d.patientId === patient?.id) : []),
    [data, patient]
  )

  const followUps = useMemo(
    () => (data ? data.followUps.filter((f) => f.patientId === patient?.id) : []),
    [data, patient]
  )

  const todayVisit = useMemo(() => visits.find((v) => isToday(v.createdAt)), [visits])

  /** Merged, date-descending timeline of every event type */
  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = [
      ...visits.map<TimelineEvent>((v) => ({ key: `v-${v.id}`, kind: "visit", date: v.createdAt, visit: v })),
      ...documents.map<TimelineEvent>((d) => ({ key: `d-${d.id}`, kind: "document", date: d.createdAt, doc: d })),
      ...referrals.map<TimelineEvent>((r) => ({ key: `r-${r.id}`, kind: "referral", date: r.createdAt, ref: r })),
      ...diagnostics.map<TimelineEvent>((d) => ({ key: `x-${d.id}`, kind: "diagnostic", date: d.createdAt, diag: d })),
      ...followUps.map<TimelineEvent>((f) => ({ key: `f-${f.id}`, kind: "followup", date: f.createdAt, followUp: f })),
    ]
    all.sort((a, b) => (a.date < b.date ? 1 : -1))
    return all
  }, [visits, documents, referrals, diagnostics, followUps])

  /** Validated lab-style fields (flag low/high/normal) from VALIDATED documents */
  const labValues = useMemo(() => {
    return documents
      .filter((d) => d.validationStatus === "VALIDATED")
      .flatMap((d) =>
        d.extracted
          .filter((f) => f.flag === "low" || f.flag === "high" || f.flag === "normal")
          .map((f) => ({ doc: d, field: f }))
      )
  }, [documents])

  /** Medication rows: profile medications + validated prescription extractions */
  const medicationRows = useMemo(() => {
    if (!patient) return []
    const rows: { name: string; schedule: string; source: string }[] = patient.medications.map((m) => ({
      name: m,
      schedule: "As prescribed",
      source: "Patient record",
    }))
    documents
      .filter((d) => d.validationStatus === "VALIDATED" && d.type === "PRESCRIPTION")
      .forEach((d) => {
        d.extracted
          .filter((f) => /^medicine\b/i.test(f.field))
          .forEach((f) => {
            const [name, ...rest] = f.value.split(" — ")
            rows.push({
              name: name ?? f.value,
              schedule: rest.join(" — ") || "As prescribed",
              source: d.title,
            })
          })
      })
    return rows
  }, [patient, documents])

  const resourceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of bundle?.entry ?? []) {
      const rt = entry.resource?.resourceType
      if (rt) counts[rt] = (counts[rt] ?? 0) + 1
    }
    return counts
  }, [bundle])

  const patientConsents = useMemo(
    () => (data ? data.consents.filter((c) => c.patientId === patient?.id) : []),
    [data, patient]
  )

  async function generateFhir() {
    if (!patient || fhirLoading) return
    setFhirLoading(true)
    try {
      const res = await fetch(`/api/fhir?patientId=${encodeURIComponent(patient.id)}`)
      const json: unknown = await res.json()
      if (!res.ok || typeof json !== "object" || json === null || !("resourceType" in json)) {
        throw new Error("Unexpected FHIR response from server")
      }
      setBundle(json as FhirBundle)
      toast.success("FHIR bundle generated", { description: "ABDM-aligned R4 abstraction (demo)." })
    } catch (e) {
      toast.error("FHIR export failed", { description: e instanceof Error ? e.message : "Try again" })
    } finally {
      setFhirLoading(false)
    }
  }

  async function copyFhir() {
    if (!bundle || copying) return
    setCopying(true)
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))
      toast.success("FHIR bundle copied to clipboard")
    } catch {
      toast.error("Copy failed", { description: "Clipboard is unavailable in this context." })
    } finally {
      setCopying(false)
    }
  }

  async function generateSummary() {
    if (!patient || summaryLoading) return
    setSummaryLoading(true)
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id }),
      })
      const json = (await res.json()) as {
        ok: boolean
        error?: string
        data?: { summary: string; engine: string; disclaimer: string }
      }
      if (json.ok && json.data) {
        setAiSummary(json.data)
        toast.success("Clinical summary generated", {
          description: "AI-assisted — for professional review, not a diagnosis.",
        })
      } else {
        toast.error("Summary failed", { description: json.error ?? "Try again" })
      }
    } catch {
      toast.error("Summary failed", { description: "Could not reach the AI service." })
    } finally {
      setSummaryLoading(false)
    }
  }

  async function withdrawConsent() {
    if (!patient || withdrawingConsent) return
    setWithdrawingConsent(true)
    try {
      const res = await fetch("/api/consent/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id }),
      })
      const json = await res.json()
      if (json.ok) {
        useAppStore.getState().setData(json.data)
        toast.success("Consent withdrawn", {
          description: "Recorded in the consent register and audit trail.",
        })
      } else {
        toast.error("Could not withdraw consent", {
          description:
            res.status === 401 || res.status === 403
              ? "Frontline or administrator sign-in required."
              : json.error ?? "Try again",
        })
      }
    } catch {
      toast.error("Could not withdraw consent", { description: "Try again." })
    } finally {
      setWithdrawingConsent(false)
    }
  }

  // ---------- guards ----------

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <EmptyState
        icon={<Search className="h-8 w-8" />}
        title="No patient selected"
        description="Search for a patient using the global search (magnifier in the header) or start a new kiosk intake."
        action={
          <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => navigate("kiosk")}>
            Go to Kiosk
          </Button>
        }
      />
    )
  }

  const visibleEvents = showAllEvents ? events : events.slice(0, TIMELINE_LIMIT)

  const activeConsent = patientConsents.find((c) => c.granted && !c.withdrawnAt) ?? null
  const withdrawnConsent = patientConsents.find((c) => c.withdrawnAt) ?? null

  // ---------- render ----------

  return (
    <div className="space-y-6">
      {/* Patient header card */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <PatientAvatar name={patient.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{patient.name}</h2>
                <Badge variant="outline" className="border-teal-200 bg-teal-50 font-mono text-xs text-teal-700">
                  {patient.mrn}
                </Badge>
                {patient.abhaId ? (
                  <Badge
                    variant="outline"
                    className="border-indigo-200 bg-indigo-50 font-mono text-xs text-indigo-700"
                    title="Ayushman Bharat Health Account (ABDM)"
                  >
                    <IdCard className="mr-1 h-3 w-3" /> ABHA: {patient.abhaId}
                  </Badge>
                ) : null}
                {todayVisit && todayVisit.syncStatus === "PENDING" ? (
                  <SyncBadge syncStatus={todayVisit.syncStatus} />
                ) : null}
              </div>
              {patient.nameHi ? <p className="text-sm text-muted-foreground">{patient.nameHi}</p> : null}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {patient.age} yrs · {patient.gender}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {patient.village}, {patient.district}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5" />
                  {patient.phone}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {patient.conditions.map((c) => (
                  <Badge key={c} variant="outline" className="border-teal-200 bg-teal-50 text-xs text-teal-700">
                    {c}
                  </Badge>
                ))}
                {patient.medications.map((m) => (
                  <Badge key={m} variant="outline" className="border-gray-200 bg-gray-50 text-xs text-gray-600">
                    {m}
                  </Badge>
                ))}
                {patient.allergies.map((a) => (
                  <Badge key={a} variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700">
                    ⚠ {a}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
              onClick={() => navigate("documents")}
            >
              <FileUp className="h-4 w-4" />
              Scan document
            </Button>
            <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => navigate("referrals")}>
              <Ambulance className="h-4 w-4" />
              Create referral
            </Button>
          </div>
        </div>
      </div>

      {/* Continuity banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <p className="font-medium text-emerald-900">One patient. One continuous healthcare history.</p>
          <p className="text-sm text-emerald-800/80">
            Every visit, document and referral — connected across facilities.
            {isOffline ? " (Offline: pending items sync later.)" : ""}
          </p>
        </div>
      </div>

      {/* AI clinical summary */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold text-teal-900">
            <Sparkles className="h-4 w-4 text-teal-600" /> AI clinical summary
          </p>
          <Button
            size="sm"
            className="bg-teal-600 text-white hover:bg-teal-700"
            disabled={summaryLoading}
            onClick={() => void generateSummary()}
          >
            {summaryLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Summarizing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {aiSummary ? "Regenerate" : "Generate"}
              </>
            )}
          </Button>
        </div>
        {aiSummary ? (
          <div className="mt-3 space-y-2">
            <pre className="whitespace-pre-wrap rounded-lg border bg-white p-3 font-sans text-sm leading-relaxed text-foreground">
              {aiSummary.summary}
            </pre>
            <p className="text-xs text-muted-foreground">
              Engine: {aiSummary.engine} · {aiSummary.disclaimer}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a fact-only summary of this record for the reviewing healthcare professional —
            conditions, allergies, latest visit, active referrals, pending diagnostics and follow-ups in one read.
          </p>
        )}
      </div>

      {/* Consent register */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              activeConsent ? "text-emerald-600" : "text-red-500"
            )}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Consent: {activeConsent ? "GRANTED" : withdrawnConsent ? "WITHDRAWN" : "NOT RECORDED"}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeConsent
                ? `Kiosk intake consent on record — ${formatDate(activeConsent.at)} (${activeConsent.method.replace(/_/g, " ").toLowerCase()}).`
                : withdrawnConsent
                  ? `Withdrawn ${formatDate(withdrawnConsent.withdrawnAt ?? withdrawnConsent.at)} — future kiosk intake requires fresh consent.`
                  : "No consent artifact found — kiosk intake will capture one."}
              {" "}Full register in the audit trail.
            </p>
          </div>
        </div>
        {activeConsent ? (
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            disabled={withdrawingConsent}
            onClick={() => void withdrawConsent()}
          >
            {withdrawingConsent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Withdraw consent
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="timeline" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="timeline">
            <History className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="visits">
            <Stethoscope className="h-4 w-4" />
            Visits
          </TabsTrigger>
          <TabsTrigger value="labs">
            <FlaskConical className="h-4 w-4" />
            Lab results
          </TabsTrigger>
          <TabsTrigger value="medications">
            <Pill className="h-4 w-4" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <Ambulance className="h-4 w-4" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="followups">
            <BellRing className="h-4 w-4" />
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="fhir">
            <FileJson className="h-4 w-4" />
            FHIR Export
          </TabsTrigger>
        </TabsList>

        {/* 1 — Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          {events.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title="No history yet"
              description="Visits, documents, referrals and follow-ups will appear here as a single continuous timeline."
            />
          ) : (
            <>
              <div className="relative">
                <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
                <div className="space-y-4">
                  {visibleEvents.map((ev) => (
                    <div key={ev.key} className="relative pl-8">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-5 h-3.5 w-3.5 rounded-full ring-4 ring-background",
                          timelineDot(ev)
                        )}
                      />
                      {ev.kind === "visit" ? <VisitCard visit={ev.visit} /> : null}
                      {ev.kind === "document" ? <DocumentCard doc={ev.doc} /> : null}
                      {ev.kind === "referral" ? <ReferralCard ref_={ev.ref} /> : null}
                      {ev.kind === "diagnostic" ? <DiagnosticCard diag={ev.diag} /> : null}
                      {ev.kind === "followup" ? <FollowUpCard followUp={ev.followUp} /> : null}
                    </div>
                  ))}
                </div>
              </div>
              {events.length > TIMELINE_LIMIT ? (
                <Button variant="ghost" size="sm" className="ml-8 text-teal-700" onClick={() => setShowAllEvents((s) => !s)}>
                  {showAllEvents ? "Show less" : `Show all ${events.length} events`}
                </Button>
              ) : null}
            </>
          )}
        </TabsContent>

        {/* 2 — Visits & AI triage */}
        <TabsContent value="visits" className="space-y-4">
          {visits.length === 0 ? (
            <EmptyState
              icon={<Stethoscope className="h-8 w-8" />}
              title="No visits recorded"
              description="Kiosk intakes and facility visits will appear here with AI-assisted triage."
            />
          ) : (
            visits.map((v) => (
              <div key={v.id} className="rounded-xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {statusLabel(v.type)} · {v.facility}
                    </p>
                    <p className="text-sm font-medium text-foreground/90">{v.chiefComplaint}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(v.createdAt)} · {formatTime(v.createdAt)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={v.triagePriority} />
                  {v.redFlags.length > 0 ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> {v.redFlags.length} red flag
                      {v.redFlags.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className={VISIT_STATUS_STYLES[v.status]}>
                    {statusLabel(v.status)}
                  </Badge>
                  <SyncBadge syncStatus={v.syncStatus} />
                  {v.severity ? (
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
                      Severity: {statusLabel(v.severity)}
                    </Badge>
                  ) : null}
                  {v.durationLabel ? (
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
                      {v.durationLabel}
                    </Badge>
                  ) : null}
                </div>
                {v.symptoms.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {v.symptoms.map((s) => (
                      <Badge key={s} variant="outline" className="border-teal-200 bg-teal-50/60 text-xs text-teal-800">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {v.aiSummary ? (
                  <div className="mt-3">
                    <AINote>{v.aiSummary}</AINote>
                  </div>
                ) : null}
                {v.aiRecommendation ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Recommended workflow:</span> {v.aiRecommendation}
                  </p>
                ) : null}
                {v.redFlags.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {v.redFlags.map((rf) => (
                      <li key={rf} className="flex items-center gap-2 text-sm font-medium text-red-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> {rf}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {v.clinicalNote ? (
                  <p className="mt-3 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Clinical note:</span> {v.clinicalNote}
                  </p>
                ) : null}
                {v.validatedBy ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">✓ Validated by {v.validatedBy}</p>
                ) : null}
              </div>
            ))
          )}
        </TabsContent>

        {/* 3 — Lab results */}
        <TabsContent value="labs" className="space-y-4">
          {labValues.length === 0 ? (
            <EmptyState
              icon={<FlaskConical className="h-8 w-8" />}
              title="No validated lab values yet"
              description="Values appear here after a healthcare professional validates a scanned lab report — AI extraction alone never adds them."
              action={
                <Button
                  variant="outline"
                  className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                  onClick={() => navigate("documents")}
                >
                  <ScanSearch className="h-4 w-4" />
                  Scan a lab report
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {labValues.map(({ doc, field }) => (
                <div
                  key={`${doc.id}-${field.field}`}
                  className={cn(
                    "rounded-xl border bg-card p-4",
                    field.flag === "low" && "border-amber-200",
                    field.flag === "high" && "border-orange-300"
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.field}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {field.value}
                    {field.unit ? <span className="ml-1 text-sm font-medium text-muted-foreground">{field.unit}</span> : null}
                  </p>
                  {field.flag ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-2 text-[11px] font-medium capitalize",
                        field.flag === "low" && "border-amber-200 bg-amber-50 text-amber-700",
                        field.flag === "high" && "border-orange-300 bg-orange-50 text-orange-700",
                        field.flag === "normal" && "border-emerald-200 bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {field.flag}
                    </Badge>
                  ) : null}
                  <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
                    {field.source} · {formatDate(doc.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 4 — Medications */}
        <TabsContent value="medications" className="space-y-4">
          {medicationRows.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-8 w-8" />}
              title="No medications recorded"
              description="Profile medications and validated prescription extracts will be listed here."
            />
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              <div className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-4">
                <span>Medicine</span>
                <span>Schedule</span>
                <span>Source</span>
              </div>
              {medicationRows.map((row, i) => (
                <div
                  key={`${row.name}-${i}`}
                  className="grid gap-1.5 px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Pill className="h-4 w-4 shrink-0 text-teal-600" />
                    {row.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{row.schedule}</span>
                  <Badge
                    variant="outline"
                    className="w-fit border-gray-200 bg-gray-50 text-[11px] font-normal text-gray-600"
                  >
                    {row.source}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 5 — Documents */}
        <TabsContent value="documents" className="space-y-4">
          <SectionTitle
            title="Documents"
            subtitle="Scanned paper records — AI extraction with human validation"
            actions={
              <Button
                size="sm"
                className="bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => navigate("documents")}
              >
                <FileUp className="h-4 w-4" />
                Scan document
              </Button>
            }
          />
          {documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No documents on record"
              description="Scan lab reports, prescriptions or previous records to build the longitudinal file."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex flex-col rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                      <FileText className="h-4 w-4" />
                    </span>
                    <ValidationStatusChip status={doc.validationStatus} />
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-sm font-medium leading-snug text-foreground",
                      doc.validationStatus === "REJECTED" && "text-gray-400 line-through"
                    )}
                  >
                    {doc.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {DOC_TYPE_LABEL[doc.type]} · {doc.extracted.length} field
                    {doc.extracted.length === 1 ? "" : "s"} · {formatDate(doc.createdAt)}
                  </p>
                  {doc.validationStatus === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                      onClick={() => {
                        setActiveDocument(doc.id)
                        navigate("validation")
                      }}
                    >
                      <ScanSearch className="h-4 w-4" />
                      Validate
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 6 — Referrals */}
        <TabsContent value="referrals" className="space-y-4">
          {referrals.length === 0 ? (
            <EmptyState
              icon={<Ambulance className="h-8 w-8" />}
              title="No referrals"
              description="Referrals to higher facilities — with live transport status — will appear here."
              action={
                <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => navigate("referrals")}>
                  <Ambulance className="h-4 w-4" />
                  Create referral
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {referrals.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <Ambulance className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">{r.origin}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate font-semibold">{r.destination}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("font-medium", REFERRAL_PRIORITY_STYLES[r.priority])}>
                      {statusLabel(r.priority)}
                    </Badge>
                    <StatusBadge status={r.status} kind="referral" />
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => navigate("referrals")}>
                      Open tracker
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 7 — Follow-ups */}
        <TabsContent value="followups" className="space-y-4">
          {followUps.length === 0 ? (
            <EmptyState
              icon={<BellRing className="h-8 w-8" />}
              title="No follow-ups scheduled"
              description="Maternal, child, chronic-care and high-risk follow-up tasks will appear here."
              action={
                <Button variant="outline" onClick={() => navigate("followups")}>
                  <BellRing className="h-4 w-4" />
                  Open board
                </Button>
              }
            />
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {followUps.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 px-4 py-3 sm:gap-3">
                  <Badge variant="outline" className={cn("font-medium", FOLLOWUP_CATEGORY_STYLES[f.category])}>
                    {statusLabel(f.category)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Next due <span className="font-medium text-foreground">{formatDate(f.nextDue)}</span>
                  </span>
                  <StatusBadge status={f.status} kind="followup" />
                  {f.syncStatus === "PENDING" ? <SyncBadge syncStatus={f.syncStatus} /> : null}
                  <div className="ml-auto">
                    <Button size="sm" variant="ghost" className="text-teal-700" onClick={() => navigate("followups")}>
                      Open board
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 8 — FHIR Export */}
        <TabsContent value="fhir" className="space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <SectionTitle
              title="FHIR R4 Bundle Export"
              subtitle="ABDM-aligned FHIR R4 abstraction (demo)"
            />
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Maps MediKiosk records to standardized FHIR resources:{" "}
              <span className="font-mono text-xs text-foreground">
                Patient, Encounter, Observation, MedicationRequest, ServiceRequest, Task, DocumentReference
              </span>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="bg-teal-600 text-white hover:bg-teal-700"
                disabled={fhirLoading}
                onClick={() => void generateFhir()}
              >
                {fhirLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                Generate FHIR Bundle
              </Button>
              {bundle ? (
                <Button variant="outline" disabled={copying} onClick={() => void copyFhir()}>
                  {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copy JSON
                </Button>
              ) : null}
            </div>

            {bundle ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resourceCounts).map(([type, count]) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="border-teal-200 bg-teal-50 font-mono text-xs text-teal-700"
                    >
                      {type} × {count}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 font-mono text-xs text-gray-600">
                    {bundle.resourceType} · {bundle.entry?.length ?? 0} entries
                  </Badge>
                </div>
                <ScrollArea className="max-h-96 rounded-lg border bg-muted/40">
                  <pre className="p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                    {JSON.stringify(bundle, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Prototype abstraction — not a live ABDM/HIP integration.</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------- timeline card renderers ----------

function VisitCard({ visit: v }: { visit: Visit }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Stethoscope className="h-4 w-4 shrink-0 text-teal-700" />
          {statusLabel(v.type)} · {v.facility}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(v.createdAt)} · {formatTime(v.createdAt)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{v.chiefComplaint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={v.triagePriority} />
        {v.redFlags.length > 0 ? (
          <Badge variant="outline" className="border-red-200 bg-red-50 font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" /> {v.redFlags.length} red flag{v.redFlags.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
        <Badge variant="outline" className={VISIT_STATUS_STYLES[v.status]}>
          {statusLabel(v.status)}
        </Badge>
        <SyncBadge syncStatus={v.syncStatus} />
      </div>
      {v.aiSummary ? (
        <div className="mt-2">
          <AINote>{v.aiSummary}</AINote>
        </div>
      ) : null}
      {v.clinicalNote ? (
        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Clinical note:</span> {v.clinicalNote}
        </p>
      ) : null}
      {v.validatedBy ? <p className="mt-2 text-xs font-medium text-emerald-700">✓ Validated by {v.validatedBy}</p> : null}
    </div>
  )
}

function DocumentCard({ doc }: { doc: DocumentRecord }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 shrink-0 text-gray-500" />
          <span className={cn(doc.validationStatus === "REJECTED" && "text-gray-400 line-through")}>{doc.title}</span>
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-[11px] text-gray-600">
          {DOC_TYPE_LABEL[doc.type]}
        </Badge>
        <ValidationStatusChip status={doc.validationStatus} />
        <span className="text-xs text-muted-foreground">
          {doc.extracted.length} field{doc.extracted.length === 1 ? "" : "s"}
        </span>
      </div>
      {doc.validationStatus === "VALIDATED" && doc.validatedBy ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">✓ Validated by {doc.validatedBy}</p>
      ) : null}
    </div>
  )
}

function ReferralCard({ ref_ }: { ref_: Referral }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          <Ambulance className="h-4 w-4 shrink-0 text-teal-600" />
          {ref_.origin}
          <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="font-semibold">{ref_.destination}</span>
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(ref_.createdAt)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("font-medium", REFERRAL_PRIORITY_STYLES[ref_.priority])}>
          {statusLabel(ref_.priority)}
        </Badge>
        <StatusBadge status={ref_.status} kind="referral" />
      </div>
    </div>
  )
}

function DiagnosticCard({ diag }: { diag: DiagnosticRequest }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FlaskConical className="h-4 w-4 shrink-0 text-teal-600" />
          {diag.testType}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(diag.createdAt)}</p>
      </div>
      <div className="mt-2">
        <StatusBadge status={diag.status} kind="diagnostic" />
      </div>
      {diag.resultSummary ? <p className="mt-2 text-xs text-muted-foreground">{diag.resultSummary}</p> : null}
    </div>
  )
}

function FollowUpCard({ followUp: f }: { followUp: FollowUp }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellRing className="h-4 w-4 shrink-0 text-amber-500" />
          {statusLabel(f.category)} follow-up
        </p>
        <p className="text-xs text-muted-foreground">Next due {formatDate(f.nextDue)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("font-medium", FOLLOWUP_CATEGORY_STYLES[f.category])}>
          {statusLabel(f.category)}
        </Badge>
        <StatusBadge status={f.status} kind="followup" />
        <SyncBadge syncStatus={f.syncStatus} />
      </div>
    </div>
  )
}

function ValidationStatusChip({ status }: { status: DocumentRecord["validationStatus"] }) {
  if (status === "VALIDATED") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Validated
      </Badge>
    )
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="outline" className="border-gray-200 bg-gray-100 text-[11px] font-medium text-gray-500">
        Rejected
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-700">
      Pending validation
    </Badge>
  )
}
