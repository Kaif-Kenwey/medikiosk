"use client"

// ============================================================
// MediKiosk — Referral Management + visual referral tracker
// Continuity ladder: Sub-Centre → PHC → Rural Hospital → District Hospital
// ============================================================

import { useMemo, useState } from "react"
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Home,
  Hospital,
  Landmark,
  Plus,
  User,
  XCircle,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { FACILITIES, type DemoData, type Patient, type Referral, type ReferralPriority } from "@/lib/types"
import { formatDate, formatTime, statusLabel } from "@/lib/format"
import { EmptyState, PatientAvatar, SectionTitle, StatusBadge } from "@/components/medikiosk/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ---------- module-level constants (no Date.now in render) ----------

const TRACK_STEPS: { status: Referral["status"]; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "IN_TRANSIT", label: "In Transit" },
  { status: "ARRIVED", label: "Arrived" },
  { status: "IN_CONSULTATION", label: "Consultation" },
  { status: "COMPLETED", label: "Completed" },
]

const NEXT_ACTION: Partial<
  Record<Referral["status"], { label: string; next: Referral["status"]; by: string; note?: string }>
> = {
  PENDING: {
    label: "Accept referral",
    next: "ACCEPTED",
    by: "Dr. R. Mishra (Rural Hospital)",
    note: "Receiving facility accepted the referral",
  },
  ACCEPTED: {
    label: "Mark In Transit",
    next: "IN_TRANSIT",
    by: "ASHA Worker Meena",
    note: "Patient travelling with ASHA escort",
  },
  IN_TRANSIT: {
    label: "Mark Arrived",
    next: "ARRIVED",
    by: "Hospital Front Desk",
    note: "Patient arrived at receiving facility",
  },
  ARRIVED: {
    label: "Start Consultation",
    next: "IN_CONSULTATION",
    by: "Attending Doctor",
  },
  IN_CONSULTATION: {
    label: "Complete Referral",
    next: "COMPLETED",
    by: "Attending Doctor",
    note: "Consultation complete — summary shared with origin facility",
  },
}

const REFERRAL_PRIORITY_STYLES: Record<ReferralPriority, string> = {
  ROUTINE: "border-teal-200 bg-teal-50/70 text-teal-700",
  URGENT: "border-amber-200 bg-amber-50 text-amber-700",
  EMERGENCY: "border-red-200 bg-red-50 text-red-700",
}

const PRIORITY_CARDS: { value: ReferralPriority; label: string; hint: string; active: string }[] = [
  {
    value: "ROUTINE",
    label: "Routine",
    hint: "Schedule within days",
    active: "border-amber-400 bg-amber-50 text-amber-900",
  },
  {
    value: "URGENT",
    label: "Urgent",
    hint: "Same-day attention",
    active: "border-teal-500 bg-teal-50 text-teal-900",
  },
  {
    value: "EMERGENCY",
    label: "Emergency",
    hint: "Immediate transfer",
    active: "border-red-400 bg-red-50 text-red-900",
  },
]

function patientOf(data: DemoData, id: string): Patient | null {
  return data.patients.find((p) => p.id === id) ?? null
}

function FacilityIcon({ facility, className }: { facility: string; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0", className)
  if (facility.includes("Sub-Centre")) return <Home className={cls} />
  if (facility.includes("PHC")) return <Building2 className={cls} />
  if (facility.includes("Rural")) return <Hospital className={cls} />
  if (facility.includes("District")) return <Landmark className={cls} />
  return <Building2 className={cls} />
}

function PriorityPill({ priority }: { priority: ReferralPriority }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-semibold", REFERRAL_PRIORITY_STYLES[priority])}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(priority)}
    </Badge>
  )
}

// ---------- main view ----------

export function ReferralsView() {
  const data = useAppStore((s) => s.data)
  const activePatientId = useAppStore((s) => s.activePatientId)
  const activeVisitId = useAppStore((s) => s.activeVisitId)
  const activeReferralId = useAppStore((s) => s.activeReferralId)
  const setActiveReferral = useAppStore((s) => s.setActiveReferral)
  const createReferral = useAppStore((s) => s.createReferral)

  const [createOpen, setCreateOpen] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [reason, setReason] = useState("")
  const [origin, setOrigin] = useState<string>(FACILITIES[0])
  const [destination, setDestination] = useState<string>("")
  const [priority, setPriority] = useState<ReferralPriority>("ROUTINE")
  const [submitting, setSubmitting] = useState(false)

  const referrals = useMemo(
    () => (data ? [...data.referrals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [data]
  )
  // Selection is derived from the store, so the active referral (e.g. set by
  // triage escalation) is automatically highlighted when this view mounts.
  const selected = referrals.find((r) => r.id === activeReferralId) ?? null

  function openCreate() {
    setPatientId(activePatientId ?? data?.patients[0]?.id ?? "")
    setReason("")
    setOrigin(FACILITIES[0])
    setDestination("")
    setPriority("ROUTINE")
    setCreateOpen(true)
  }

  const canSubmit = Boolean(patientId && reason.trim() && destination)

  async function submitCreate() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await createReferral({
        patientId,
        visitId: patientId === activePatientId ? (activeVisitId ?? null) : null,
        reason: reason.trim(),
        origin,
        destination,
        priority,
        createdBy: "ANM Sunita Sharma",
      })
      setCreateOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="space-y-3 xl:col-span-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl xl:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Referral Management"
        subtitle="Sub-Centre → PHC → Rural Hospital → District Hospital"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create referral
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Referral list */}
        <section className="space-y-3 xl:col-span-2">
          {referrals.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-10 w-10" />}
              title="No referrals yet"
              description="Create a referral to move a patient up the facility ladder with full continuity of care."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Create referral
                </Button>
              }
            />
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {referrals.map((r) => {
                const patient = patientOf(data, r.patientId)
                const last = r.history[r.history.length - 1]
                const isSelected = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReferral(r.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-teal-300",
                      isSelected && "border-transparent ring-2 ring-teal-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <PatientAvatar
                        name={patient?.name ?? "Unknown"}
                        size="sm"
                        tone={r.priority === "EMERGENCY" ? "red" : "teal"}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {patient?.name ?? "Unknown"}
                          </p>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {patient?.mrn ?? "—"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.reason}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <FacilityIcon facility={r.origin} />
                          <span className="max-w-36 truncate">{r.origin}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          <FacilityIcon facility={r.destination} />
                          <span className="max-w-36 truncate font-medium text-foreground">
                            {r.destination}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <PriorityPill priority={r.priority} />
                          <StatusBadge status={r.status} kind="referral" />
                          <span className="text-[11px] text-muted-foreground">
                            Created {formatDate(r.createdAt)}
                          </span>
                        </div>
                        {last ? (
                          <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
                            Last update: {statusLabel(last.status)} · {last.by} ·{" "}
                            {formatTime(last.at)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Tracker panel */}
        <section className="xl:col-span-3">
          {selected ? (
            <ReferralTracker referral={selected} patient={patientOf(data, selected.patientId)} />
          ) : (
            <EmptyState
              icon={<ArrowRight className="h-10 w-10" />}
              title="Select a referral"
              description="Pick a referral from the list to open the live tracking timeline and take the next action."
            />
          )}
        </section>
      </div>

      {/* Create referral dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create referral</DialogTitle>
            <DialogDescription>
              Refer the patient up the facility ladder — the receiving facility is notified instantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-patient">Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="ref-patient" className="w-full">
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
              <Label htmlFor="ref-reason">Reason for referral</Label>
              <Textarea
                id="ref-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Persistent fever 7 days — needs physician evaluation and blood work"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ref-origin">Origin facility</Label>
                <Select
                  value={origin}
                  onValueChange={(v) => {
                    setOrigin(v)
                    if (v === destination) setDestination("")
                  }}
                >
                  <SelectTrigger id="ref-origin" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-destination">Destination facility</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger id="ref-destination" className="w-full">
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITIES.filter((f) => f !== origin).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div role="radiogroup" aria-label="Referral priority" className="grid grid-cols-3 gap-2">
                {PRIORITY_CARDS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={priority === p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors",
                      priority === p.value
                        ? cn(p.active, "font-medium")
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight opacity-80">
                      {p.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={!canSubmit || submitting}>
              <Plus className="h-4 w-4" /> Create referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------- referral tracker (key visual) ----------

function ReferralTracker({ referral, patient }: { referral: Referral; patient: Patient | null }) {
  const updateReferralStatus = useAppStore((s) => s.updateReferralStatus)
  const [busy, setBusy] = useState(false)

  const cancelled = referral.status === "CANCELLED"
  const currentIdx = TRACK_STEPS.findIndex((s) => s.status === referral.status)
  const next = NEXT_ACTION[referral.status]
  const terminal = cancelled || referral.status === "COMPLETED"

  async function advance() {
    if (!next) return
    setBusy(true)
    try {
      await updateReferralStatus({
        id: referral.id,
        status: next.next,
        by: next.by,
        note: next.note,
      })
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    try {
      await updateReferralStatus({
        id: referral.id,
        status: "CANCELLED",
        by: "ANM Sunita Sharma",
        note: "Cancelled at origin facility",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <PatientAvatar
            name={patient?.name ?? "Unknown"}
            tone={referral.priority === "EMERGENCY" ? "red" : "teal"}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{patient?.name ?? "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {patient?.mrn ?? "—"} · {referral.reason}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityPill priority={referral.priority} />
          <StatusBadge status={referral.status} kind="referral" />
        </div>
      </div>

      {/* Route + meta */}
      <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          <FacilityIcon facility={referral.origin} />
          <span>{referral.origin}</span>
          <ArrowRight className="h-3.5 w-3.5 text-teal-600" />
          <FacilityIcon facility={referral.destination} />
          <span className="font-medium text-foreground">{referral.destination}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Referred {formatDate(referral.createdAt)}</span>
          {referral.assignedTo ? (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {referral.assignedTo}
            </span>
          ) : null}
        </div>
        {referral.appointmentAt ? (
          <p className="flex items-center gap-1.5 font-medium text-teal-700">
            <CalendarDays className="h-3.5 w-3.5" />
            Appointment: {formatDate(referral.appointmentAt)} at{" "}
            {formatTime(referral.appointmentAt)}
          </p>
        ) : null}
      </div>

      {/* Horizontal stepper */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Referral tracker
        </p>
        <div className="mt-3 flex items-start">
          {TRACK_STEPS.map((step, i) => {
            const done = !cancelled && currentIdx > i
            const current = !cancelled && currentIdx === i
            return (
              <div key={step.status} className="contents">
                <div className="flex w-14 flex-col items-center gap-1.5 sm:w-20">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                      done && "border-teal-600 bg-teal-600 text-white",
                      current && "animate-pulse border-teal-600 bg-white text-teal-700 ring-4 ring-teal-500/25",
                      !done && !current && "border-gray-200 bg-white text-gray-400"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-center text-[10px] leading-tight",
                      (done || current) && "font-medium text-teal-700",
                      !done && !current && "text-gray-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < TRACK_STEPS.length - 1 ? (
                  <div
                    className={cn("mt-4 h-0.5 min-w-2 flex-1 rounded", currentIdx > i && !cancelled ? "bg-teal-500" : "bg-gray-200")}
                    aria-hidden
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        {cancelled ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>This referral was cancelled — no further tracking steps apply.</span>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {next ? (
          <Button onClick={advance} disabled={busy}>
            <ArrowRight className="h-4 w-4" /> {next.label}
          </Button>
        ) : !cancelled ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" /> Referral journey completed
          </span>
        ) : null}
        {!terminal ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={busy}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <XCircle className="h-4 w-4" /> Cancel referral
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this referral?</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Referral to ${referral.destination} will be marked cancelled and tracking will stop. This is logged in the referral history.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep referral</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={cancel}
                >
                  Yes, cancel referral
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {/* History log */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          History log
        </p>
        {referral.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        ) : (
          <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
            {[...referral.history].reverse().map((h, i) => (
              <li
                key={`${h.at}-${i}`}
                className="flex items-start gap-2.5 rounded-lg border bg-muted/20 px-3 py-2"
              >
                <StatusBadge status={h.status} kind="referral" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{h.by}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(h.at)} · {formatTime(h.at)}
                  </p>
                  {h.note ? (
                    <p className="mt-0.5 text-[11px] italic text-muted-foreground">“{h.note}”</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
