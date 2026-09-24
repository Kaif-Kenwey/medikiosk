"use client"

// ============================================================
// MediKiosk — Diagnostic coordination (order → collect → lab → result → record)
// ============================================================

import { useMemo, useState } from "react"
import { CheckCircle2, FlaskConical } from "lucide-react"
import { useAppStore } from "@/lib/store"
import type { DemoData, DiagnosticRequest } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { SectionTitle, StatusBadge } from "@/components/medikiosk/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ---------- module-level constants ----------

const TEST_TYPES = ["CBC", "Blood Glucose", "Chest X-Ray", "HbA1c", "Urine Test"] as const
const ORDERED_BY = "Dr. A. Prasad"

const DIAG_COLUMNS: { status: DiagnosticRequest["status"]; label: string; hint: string }[] = [
  { status: "REQUESTED", label: "Requested", hint: "Awaiting sample collection" },
  { status: "SAMPLE_COLLECTED", label: "Sample Collected", hint: "Ready for lab dispatch" },
  { status: "PROCESSING", label: "Processing", hint: "Lab is analysing the sample" },
  { status: "RESULT_READY", label: "Result Available", hint: "Awaiting doctor review" },
  { status: "REVIEWED", label: "Reviewed", hint: "Added to longitudinal record" },
]

const NEXT_ACTION: Partial<
  Record<DiagnosticRequest["status"], { label: string; next: DiagnosticRequest["status"] }>
> = {
  REQUESTED: { label: "Collect sample", next: "SAMPLE_COLLECTED" },
  SAMPLE_COLLECTED: { label: "Send to lab", next: "PROCESSING" },
  PROCESSING: { label: "Attach result", next: "RESULT_READY" },
  RESULT_READY: { label: "Mark Reviewed & Add to Record", next: "REVIEWED" },
}

const PROGRESS_PCT: Record<DiagnosticRequest["status"], number> = {
  REQUESTED: 20,
  SAMPLE_COLLECTED: 40,
  PROCESSING: 60,
  RESULT_READY: 80,
  REVIEWED: 100,
}

function patientName(data: DemoData, id: string): string {
  return data.patients.find((p) => p.id === id)?.name ?? "Unknown"
}

// ---------- main view ----------

export function DiagnosticsView() {
  const data = useAppStore((s) => s.data)
  const activePatientId = useAppStore((s) => s.activePatientId)
  const activeVisitId = useAppStore((s) => s.activeVisitId)
  const createDiagnostic = useAppStore((s) => s.createDiagnostic)
  const updateDiagnostic = useAppStore((s) => s.updateDiagnostic)

  const [orderOpen, setOrderOpen] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [testType, setTestType] = useState<string>(TEST_TYPES[0])
  const [submitting, setSubmitting] = useState(false)
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  function openOrder() {
    setPatientId(activePatientId ?? data?.patients[0]?.id ?? "")
    setTestType(TEST_TYPES[0])
    setOrderOpen(true)
  }

  async function submitOrder() {
    if (!patientId || !testType) return
    setSubmitting(true)
    try {
      await createDiagnostic({
        patientId,
        visitId: patientId === activePatientId ? (activeVisitId ?? null) : null,
        testType,
        orderedBy: ORDERED_BY,
      })
      setOrderOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function advance(id: string, next: DiagnosticRequest["status"]) {
    setAdvancingId(id)
    try {
      await updateDiagnostic({ id, status: next })
    } finally {
      setAdvancingId(null)
    }
  }

  const columns = useMemo(() => {
    const map = new Map<DiagnosticRequest["status"], DiagnosticRequest[]>()
    for (const col of DIAG_COLUMNS) map.set(col.status, [])
    if (data) {
      for (const d of data.diagnostics) {
        map.get(d.status)?.push(d)
      }
    }
    for (const [, list] of map) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [data])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          {DIAG_COLUMNS.map((c) => (
            <Skeleton key={c.status} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Diagnostic Coordination"
        subtitle="Order tests, track results into the record"
        actions={
          <Button onClick={openOrder}>
            <FlaskConical className="h-4 w-4" /> Order test
          </Button>
        }
      />

      {/* Workflow board */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
        {DIAG_COLUMNS.map((col) => {
          const items = columns.get(col.status) ?? []
          return (
            <div key={col.status} className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </p>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-100 px-1.5 text-[11px] font-semibold text-teal-700">
                  {items.length}
                </span>
              </div>

              <div className="max-h-96 space-y-3 overflow-y-auto pr-0.5">
                {items.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">—</p>
                ) : (
                  items.map((d) => {
                    const next = NEXT_ACTION[d.status]
                    return (
                      <div key={d.id} className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {d.testType}
                          </p>
                          <StatusBadge status={d.status} kind="diagnostic" />
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {patientName(data, d.patientId)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {d.orderedBy ? `Ordered by ${d.orderedBy}` : "Order source unrecorded"} ·{" "}
                          {formatDate(d.createdAt)}
                        </p>

                        <div className="mt-2.5 space-y-1">
                          <Progress value={PROGRESS_PCT[d.status]} className="h-1.5" aria-label={`${col.label} progress`} />
                          <p className="text-[11px] text-muted-foreground">{col.hint}</p>
                        </div>

                        {(d.status === "RESULT_READY" || d.status === "REVIEWED") &&
                        (d.resultSummary || d.result) ? (
                          <div className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                            {d.resultSummary ? (
                              <p className="text-xs font-semibold text-emerald-800">
                                {d.resultSummary}
                              </p>
                            ) : null}
                            {d.result ? (
                              <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-emerald-700">
                                {d.result}
                              </p>
                            ) : null}
                            {d.status === "REVIEWED" ? (
                              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                Added to longitudinal record ✓
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {next ? (
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => advance(d.id, next.next)}
                            disabled={advancingId === d.id}
                          >
                            {next.label}
                          </Button>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order test dialog */}
      <Dialog
        open={orderOpen}
        onOpenChange={(open) => {
          if (!open) setOrderOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order diagnostic test</DialogTitle>
            <DialogDescription>
              The request flows through sample collection, lab processing and doctor review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="diag-patient">Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="diag-patient" className="w-full">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {data.patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diag-test">Test type</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger id="diag-test" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className={cn("text-[11px] text-muted-foreground")}>
              Ordered by {ORDERED_BY} — results land in the patient’s longitudinal record after review.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitOrder} disabled={!patientId || submitting}>
              <FlaskConical className="h-4 w-4" /> Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
