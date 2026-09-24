"use client"

// ============================================================
// MediKiosk — Document Intelligence
// Scan paper records → simulated OCR extracts fields →
// human validation. AI output is NEVER presented as clinically
// verified until a healthcare professional validates it.
// ============================================================

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  FileUp,
  FlaskConical,
  Loader2,
  Pill,
  ScanSearch,
  WifiOff,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AINote, EmptyState, SectionTitle, SourceChip } from "@/components/medikiosk/shared"
import { formatDate } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { DocumentRecord, ExtractedField } from "@/lib/types"

// ---------- local constants & helpers ----------

type DocType = DocumentRecord["type"]

const DOC_TYPES: {
  kind: DocType
  label: string
  description: string
  icon: LucideIcon
  fileName: string
  iconClass: string
}[] = [
  {
    kind: "LAB_REPORT",
    label: "Lab report",
    description: "CBC, blood panels, vitals sheets",
    icon: FlaskConical,
    fileName: "lab-report-scan.jpg",
    iconClass: "bg-teal-100 text-teal-700",
  },
  {
    kind: "PRESCRIPTION",
    label: "Prescription",
    description: "Doctor-issued medicine slips",
    icon: Pill,
    fileName: "prescription-scan.jpg",
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  {
    kind: "MEDICAL_RECORD",
    label: "Previous medical record",
    description: "Discharge summaries, past history",
    icon: FileText,
    fileName: "medical-record-scan.jpg",
    iconClass: "bg-gray-100 text-gray-600",
  },
]

function docTypeMeta(type: DocType) {
  return DOC_TYPES.find((t) => t.kind === type) ?? DOC_TYPES[2]
}

const SCAN_STAGES = ["Uploading document…", "Running OCR…", "Extracting fields…"] as const

const FLAG_STYLES: Record<NonNullable<ExtractedField["flag"]>, string> = {
  low: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-300 bg-orange-50 text-orange-700",
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-gray-200 bg-gray-50 text-gray-600",
}

function FlagChip({ flag }: { flag: NonNullable<ExtractedField["flag"]> }) {
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium capitalize", FLAG_STYLES[flag])}>
      {flag}
    </Badge>
  )
}

export function ValidationStatusBadge({ status }: { status: DocumentRecord["validationStatus"] }) {
  if (status === "VALIDATED") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Validated
      </Badge>
    )
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="outline" className="border-gray-200 bg-gray-100 font-medium text-gray-500">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 font-medium text-amber-700">
      <Clock className="h-3 w-3" /> Pending validation
    </Badge>
  )
}

/** Read-only extracted-fields table shared by the result panel and expanded list items */
function FieldRows({ fields }: { fields: ExtractedField[] }) {
  return (
    <div className="divide-y rounded-lg border">
      {fields.map((f, i) => {
        const pct = Math.round((f.confidence ?? 0) * 100)
        return (
          <div
            key={`${f.field}-${i}`}
            className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{f.field}</p>
              <p className="text-sm text-muted-foreground">
                {f.value}
                {f.unit ? <span className="ml-1 text-xs text-muted-foreground/80">{f.unit}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  pct >= 90 ? "text-teal-700" : pct >= 75 ? "text-amber-700" : "text-red-700"
                )}
              >
                {pct}%
              </span>
              <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className={cn(
                    "h-full rounded-full",
                    pct >= 90 ? "bg-teal-500" : pct >= 75 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <SourceChip source={f.source} />
              {f.flag ? <FlagChip flag={f.flag} /> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- view ----------

export default function DocumentScanView() {
  const {
    data,
    activePatientId,
    activeDocumentId,
    setActivePatient,
    setActiveDocument,
    scanDocument,
    validateDocument,
    navigate,
    isOffline,
  } = useAppStore()

  const [scanKind, setScanKind] = useState<DocType | null>(null)
  const [stage, setStage] = useState(0)
  const [queuedOffline, setQueuedOffline] = useState(false)
  const [validating, setValidating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const patient = useMemo(() => {
    if (!data) return null
    return data.patients.find((p) => p.id === activePatientId) ?? data.patients[0] ?? null
  }, [data, activePatientId])

  const patientDocs = useMemo(() => {
    if (!data || !patient) return []
    return data.documents.filter((d) => d.patientId === patient.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [data, patient])

  const activeDoc = useMemo(() => {
    if (!data || !patient || !activeDocumentId) return null
    const doc = data.documents.find((d) => d.id === activeDocumentId)
    return doc && doc.patientId === patient.id ? doc : null
  }, [data, patient, activeDocumentId])

  /** Runs the server OCR call in parallel with the local stage stepper */
  async function handleScan(kind: DocType) {
    if (!patient || scanKind) return
    setQueuedOffline(false)
    setScanKind(kind)
    setStage(0)
    const startedAt = Date.now()
    const timers = [1, 2].map((i) => window.setTimeout(() => setStage(i), i * 600))
    const doc = await scanDocument({ patientId: patient.id, kind, fileName: docTypeMeta(kind).fileName })
    // Keep the stepper visible for its full simulated duration
    const remaining = Math.max(0, 1800 - (Date.now() - startedAt))
    await new Promise((resolve) => window.setTimeout(resolve, remaining))
    timers.forEach((t) => window.clearTimeout(t))
    setStage(3)
    setScanKind(null)
    if (!doc) setQueuedOffline(true)
  }

  async function handleAccept() {
    if (!activeDoc || validating) return
    setValidating(true)
    await validateDocument({ id: activeDoc.id, action: "ACCEPT", validatedBy: "Kiosk Operator" })
    setValidating(false)
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Document Intelligence" subtitle="Scan paper records — AI extracts, human validates" />

      {isOffline ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Offline mode — scans captured offline will sync later.</span>
        </div>
      ) : null}

      {queuedOffline ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Scan captured offline — queued for sync. OCR extraction will complete when the device reconnects and the
            record syncs.
          </span>
        </div>
      ) : null}

      {/* Patient selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Patient</span>
        <Select
          value={patient?.id ?? ""}
          onValueChange={(v) => {
            setQueuedOffline(false)
            setExpandedId(null)
            setActivePatient(v)
          }}
        >
          <SelectTrigger className="w-full sm:w-80" aria-label="Select patient">
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {data.patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {p.mrn} · {p.village}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload dropzone + document type cards */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/50 p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <FileUp className="h-6 w-6" />
          </div>
          <p className="font-medium text-foreground">Scan / Upload document</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Place the paper record on the kiosk scanner or capture a photo, then choose a document type to simulate a
            scan.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {DOC_TYPES.map(({ kind, label, description, icon: Icon, iconClass }) => (
            <div key={kind} className="flex flex-col rounded-xl border bg-card p-4">
              <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-lg", iconClass)}>
                <Icon className="h-5 w-5" />
              </span>
              <p className="font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              <Button
                size="sm"
                className="mt-4 w-full bg-teal-600 text-white hover:bg-teal-700"
                disabled={scanKind !== null || !patient}
                onClick={() => void handleScan(kind)}
              >
                {scanKind === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                Scan
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Processing stepper (local simulation runs in parallel with the server call) */}
      {scanKind ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
            <div>
              <p className="font-medium text-foreground">Processing {docTypeMeta(scanKind).label.toLowerCase()}…</p>
              <p className="text-sm text-muted-foreground">
                Simulated OCR pipeline — extraction runs server-side while stages complete.
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-500"
              style={{ width: `${((Math.min(stage, 2) + 1) / SCAN_STAGES.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {SCAN_STAGES.map((label, i) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                {i < stage ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : i === stage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                ) : (
                  <span className="mx-1.5 h-2 w-2 rounded-full bg-muted-foreground/25" />
                )}
                <span className={cn(i <= stage ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Extracted result for the newly scanned document */}
      {activeDoc && !scanKind ? (
        <div
          className={cn(
            "rounded-xl border bg-card p-4 sm:p-6",
            activeDoc.validationStatus === "PENDING" && "border-amber-200"
          )}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  docTypeMeta(activeDoc.type).iconClass
                )}
              >
                {(() => {
                  const Icon = docTypeMeta(activeDoc.type).icon
                  return <Icon className="h-5 w-5" />
                })()}
              </span>
              <div>
                <p className="font-semibold leading-tight text-foreground">{activeDoc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {activeDoc.fileName ?? "—"} · {activeDoc.source ?? "Unknown source"} ·{" "}
                  {formatDate(activeDoc.createdAt)}
                </p>
              </div>
            </div>
            <ValidationStatusBadge status={activeDoc.validationStatus} />
          </div>

          {activeDoc.validationStatus === "PENDING" ? (
            <>
              <FieldRows fields={activeDoc.extracted} />
              <div className="mt-3">
                <AINote>Fields extracted by simulated OCR — not clinically verified until human validation.</AINote>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={validating}
                  onClick={() => void handleAccept()}
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Accept document
                </Button>
                <Button
                  className="bg-teal-600 text-white hover:bg-teal-700"
                  onClick={() => {
                    setActiveDocument(activeDoc.id)
                    navigate("validation")
                  }}
                >
                  <ScanSearch className="h-4 w-4" />
                  Continue to Human Validation
                </Button>
              </div>
            </>
          ) : activeDoc.validationStatus === "VALIDATED" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <span className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Validated by {activeDoc.validatedBy ?? "a healthcare professional"} — fields were added to the patient
                  record.
                </span>
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
              <span className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Extraction rejected — nothing was added to the patient record.</span>
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Existing documents for the selected patient */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Documents on record ({patientDocs.length})
        </h3>
        {patientDocs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No documents yet"
            description="Scan a lab report, prescription or previous record to start building this patient's history."
          />
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {patientDocs.map((doc) => {
              const meta = docTypeMeta(doc.type)
              const open = expandedId === doc.id
              return (
                <div key={doc.id} className="overflow-hidden rounded-xl border bg-card">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : doc.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    aria-expanded={open}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.iconClass)}>
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          doc.validationStatus === "REJECTED" && "text-gray-400 line-through"
                        )}
                      >
                        {doc.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.fileName ?? "—"} · {formatDate(doc.createdAt)} · {doc.extracted.length} field
                        {doc.extracted.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ValidationStatusBadge status={doc.validationStatus} />
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </button>
                  {open ? (
                    <div className="border-t bg-muted/20 p-4">
                      <FieldRows fields={doc.extracted} />
                      {doc.validationStatus === "VALIDATED" && doc.validatedBy ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          ✓ Validated by {doc.validatedBy}
                          {doc.validatedAt ? ` · ${formatDate(doc.validatedAt)}` : ""}
                        </p>
                      ) : null}
                      {doc.validationStatus === "PENDING" ? (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                            onClick={() => {
                              setActiveDocument(doc.id)
                              navigate("validation")
                            }}
                          >
                            <ScanSearch className="h-4 w-4" />
                            Review in validation queue
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
