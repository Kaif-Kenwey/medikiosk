"use client"

// ============================================================
// MediKiosk — Human Validation (dedicated screen)
// Every AI-extracted field stays "pending human validation"
// until a healthcare professional confirms or rejects it.
// ============================================================

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  Pill,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  User,
  WifiOff,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, SectionTitle, SourceChip } from "@/components/medikiosk/shared"
import { formatDate, formatTime } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ConsistencyFinding } from "@/lib/ai-engine"
import type { DocumentRecord, ExtractedField } from "@/lib/types"

// ---------- local constants & helpers ----------

const DOC_TYPE_META: Record<DocumentRecord["type"], { label: string; icon: LucideIcon; chip: string }> = {
  LAB_REPORT: { label: "Lab report", icon: FlaskConical, chip: "border-teal-200 bg-teal-50 text-teal-700" },
  PRESCRIPTION: { label: "Prescription", icon: Pill, chip: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  MEDICAL_RECORD: { label: "Medical record", icon: FileText, chip: "border-gray-200 bg-gray-50 text-gray-600" },
}

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

function ConfidenceCell({ confidence }: { confidence: number }) {
  const pct = Math.round((confidence ?? 0) * 100)
  return (
    <div className="flex items-center gap-2">
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
          className={cn("h-full rounded-full", pct >= 90 ? "bg-teal-500" : pct >= 75 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------- view ----------

export default function ValidationView() {
  const { data, navigate, validateDocument, activeDocumentId, role, isOffline } = useAppStore()

  // Local edit buffer: docId → edited ExtractedField[] (starts from doc.extracted)
  const [edits, setEdits] = useState<Record<string, ExtractedField[]>>({})
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // AI consistency checks: docId → findings | null (checked)
  const [consistency, setConsistency] = useState<Record<string, ConsistencyFinding[] | null>>({})
  const [checkingId, setCheckingId] = useState<string | null>(null)

  const validatorName = role === "doctor" ? "Dr. A. Prasad" : role === "admin" ? "Records Admin" : "ANM Sunita Sharma"

  const patientName = useMemo(() => {
    const map = new Map<string, string>()
    data?.patients.forEach((p) => map.set(p.id, p.name))
    return map
  }, [data])

  /** Pending queue — most recent first; the active document (if pending) is pinned on top */
  const pending = useMemo(() => {
    if (!data) return []
    const list = data.documents.filter((d) => d.validationStatus === "PENDING")
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (activeDocumentId) {
      const idx = list.findIndex((d) => d.id === activeDocumentId)
      if (idx > 0) {
        const [doc] = list.splice(idx, 1)
        list.unshift(doc)
      }
    }
    return list
  }, [data, activeDocumentId])

  const reviewed = useMemo(() => {
    if (!data) return []
    return data.documents
      .filter((d) => d.validationStatus === "VALIDATED" || d.validationStatus === "REJECTED")
      .sort((a, b) => ((a.validatedAt ?? a.createdAt) < (b.validatedAt ?? b.createdAt) ? 1 : -1))
  }, [data])

  function getEdits(doc: DocumentRecord): ExtractedField[] {
    return edits[doc.id] ?? doc.extracted
  }

  function handleEdit(doc: DocumentRecord, idx: number, value: string) {
    setEdits((prev) => {
      const base = prev[doc.id] ?? doc.extracted
      return { ...prev, [doc.id]: base.map((f, i) => (i === idx ? { ...f, value } : f)) }
    })
  }

  async function handleConfirm(doc: DocumentRecord) {
    if (busyId) return
    setBusyId(doc.id)
    await validateDocument({
      id: doc.id,
      action: "ACCEPT",
      editedExtracted: getEdits(doc),
      validatedBy: validatorName,
    })
    setBusyId(null)
    setEdits((prev) => {
      const next = { ...prev }
      delete next[doc.id]
      return next
    })
  }

  function handleSaveEdits(doc: DocumentRecord) {
    if (!edits[doc.id]) {
      toast.info("Nothing to save yet", { description: "Edit a field value first — edits are kept on this device." })
      return
    }
    toast.info("Edits saved locally", {
      description: "Field edits stay on this device until the document is confirmed or rejected.",
    })
  }

  async function handleReject() {
    if (!rejectId || busyId) return
    const id = rejectId
    setBusyId(id)
    await validateDocument({ id, action: "REJECT", validatedBy: validatorName })
    setBusyId(null)
    setRejectId(null)
    setEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function runConsistency(doc: DocumentRecord) {
    if (checkingId) return
    setCheckingId(doc.id)
    try {
      const res = await fetch("/api/ai/consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: doc.patientId, documentId: doc.id }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string; data?: { findings: ConsistencyFinding[] } }
      if (json.ok && json.data) {
        setConsistency((prev) => ({ ...prev, [doc.id]: json.data!.findings }))
      } else {
        toast.error("Consistency check failed", { description: json.error ?? "Try again" })
      }
    } catch {
      toast.error("Consistency check failed", {
        description: isOffline ? "The AI service needs a connection." : "Could not reach the AI service.",
      })
    } finally {
      setCheckingId(null)
    }
  }

  // Auto-run the consistency check for the freshly scanned document
  const pendingForAuto = useMemo(() => data?.documents ?? [], [data])
  useEffect(() => {
    if (!activeDocumentId) return
    const doc = pendingForAuto.find((d) => d.id === activeDocumentId)
    if (doc && consistency[doc.id] === undefined && checkingId === null) {
      void runConsistency(doc)
    }
  }, [activeDocumentId, pendingForAuto])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const rejectDoc = rejectId ? (data.documents.find((d) => d.id === rejectId) ?? null) : null

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Review AI-Extracted Information"
        subtitle="Confirm or correct each field before it enters the patient record"
      />

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <p className="font-medium text-emerald-900">
            AI-generated information requires healthcare professional validation.
          </p>
          <p className="text-sm text-emerald-800/80">
            OCR output is a draft until you confirm it. Validating as{" "}
            <span className="font-semibold">{validatorName}</span> ({role} role).
          </p>
        </div>
      </div>

      {isOffline ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Offline mode — validations captured now will sync to the facility server later.</span>
        </div>
      ) : null}

      {/* Pending queue */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pending validation ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title="Nothing pending validation"
            description="All AI-extracted documents have been reviewed. Scan a new paper record to keep the pipeline moving."
            action={
              <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => navigate("documents")}>
                <ScanSearch className="h-4 w-4" />
                Scan a document
              </Button>
            }
          />
        ) : (
          pending.map((doc) => {
            const meta = DOC_TYPE_META[doc.type]
            const fields = getEdits(doc)
            const dirty = edits[doc.id] !== undefined
            const isActive = doc.id === activeDocumentId
            const busy = busyId === doc.id
            return (
              <div key={doc.id} className={cn("rounded-xl border bg-card p-4 sm:p-6", isActive && "ring-2 ring-teal-500")}>
                {/* header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg border", meta.chip)}>
                      <meta.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold leading-tight text-foreground">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {meta.label} · {doc.source ?? "Unknown source"} · {doc.fileName ?? "—"} ·{" "}
                        {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {patientName.get(doc.patientId) ?? "Unknown patient"}
                  </div>
                </div>

                {/* two-column body: editable evidence + OCR evidence */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Extracted fields — check &amp; correct
                    </p>
                    {fields.map((f, i) => (
                      <div
                        key={`${f.field}-${i}`}
                        className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {f.field}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <SourceChip source={f.source} />
                            {f.flag ? <FlagChip flag={f.flag} /> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={f.value}
                            onChange={(e) => handleEdit(doc, i, e.target.value)}
                            className="h-9"
                            aria-label={`Edit ${f.field}`}
                            placeholder="Field value"
                          />
                          {f.unit ? (
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{f.unit}</span>
                          ) : null}
                        </div>
                        <div className="sm:justify-end">
                          <ConfidenceCell confidence={f.confidence ?? 0} />
                        </div>
                      </div>
                    ))}
                    {fields.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                        No fields were extracted from this document.
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <ScanSearch className="h-3.5 w-3.5" />
                      Source document (OCR)
                    </p>
                    <ScrollArea className="max-h-64">
                      <pre className="whitespace-pre-wrap px-1 font-mono text-xs leading-relaxed text-muted-foreground">
                        {doc.ocrText ?? "— no OCR text available —"}
                      </pre>
                    </ScrollArea>
                    <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
                      OCR text is raw machine output — treat it as evidence, not as verified clinical data.
                    </p>
                  </div>
                </div>

                {/* AI consistency panel */}
                <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-800">
                      <ScanSearch className="h-3.5 w-3.5" /> AI consistency check
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-teal-300 text-teal-800 hover:bg-teal-100"
                      disabled={checkingId === doc.id}
                      onClick={() => void runConsistency(doc)}
                    >
                      {checkingId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      {consistency[doc.id] === undefined ? "Run check" : "Re-run check"}
                    </Button>
                  </div>
                  {consistency[doc.id] !== undefined && consistency[doc.id] !== null && (
                    <div className="mt-2 space-y-2">
                      {(consistency[doc.id] ?? []).length === 0 ? (
                        <p className="flex items-center gap-1.5 text-sm text-emerald-800">
                          <CheckCircle2 className="h-4 w-4 shrink-0" /> No contradictions found between the document,
                          the stated symptoms and the patient record.
                        </p>
                      ) : (
                        (consistency[doc.id] ?? []).map((f) => (
                          <div
                            key={f.id}
                            className={cn(
                              "rounded-md border p-2.5 text-sm",
                              f.severity === "CRITICAL"
                                ? "border-red-300 bg-red-50 text-red-900"
                                : f.severity === "WARNING"
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : "border-gray-200 bg-white text-gray-700"
                            )}
                          >
                            <p className="flex items-center gap-1.5 font-semibold">
                              {f.severity === "CRITICAL" ? (
                                <XCircle className="h-4 w-4 shrink-0" />
                              ) : f.severity === "WARNING" ? (
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                              ) : (
                                <Info className="h-4 w-4 shrink-0" />
                              )}
                              {f.severity} — {f.title}
                            </p>
                            <p className="mt-1">{f.detail}</p>
                            <p className="mt-1 text-xs opacity-75">Sources: {f.sources.join(" · ")}</p>
                          </div>
                        ))
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Findings are advisory — resolution is always a human decision.
                      </p>
                    </div>
                  )}
                </div>

                {/* footer actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={busy || fields.length === 0}
                    onClick={() => void handleConfirm(doc)}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirm all
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => handleSaveEdits(doc)}>
                    Save edits
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={busy}
                    onClick={() => setRejectId(doc.id)}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  {dirty ? (
                    <span className="text-xs font-medium text-amber-700">Edits saved locally — confirm to validate.</span>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Recently validated / rejected */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recently validated
        </h3>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents have been validated yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-xl border bg-card [scrollbar-width:thin]">
            <div className="divide-y">
              {reviewed.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5">
                  {doc.validationStatus === "VALIDATED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
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
                      {patientName.get(doc.patientId) ?? "Unknown patient"} · {DOC_TYPE_META[doc.type].label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    {doc.validationStatus === "VALIDATED" ? (
                      <p className="font-medium text-emerald-700">{doc.validatedBy ?? "—"}</p>
                    ) : (
                      <p className="font-medium text-gray-500">Rejected</p>
                    )}
                    <p className="text-muted-foreground">
                      {formatDate(doc.validatedAt ?? doc.createdAt)} · {formatTime(doc.validatedAt ?? doc.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject confirmation dialog */}
      <Dialog
        open={rejectId !== null}
        onOpenChange={(open) => {
          if (!open) setRejectId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject AI extraction?</DialogTitle>
            <DialogDescription>
              {rejectDoc
                ? `“${rejectDoc.title}” — the extracted fields will be marked rejected and will NOT be added to the patient record. The source document stays on file.`
                : "The extracted fields will be marked rejected and will NOT be added to the patient record."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectId(null)} disabled={busyId === rejectId}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busyId === rejectId} onClick={() => void handleReject()}>
              {busyId === rejectId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject extraction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
