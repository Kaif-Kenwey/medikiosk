"use client"

// ============================================================
// MediKiosk — EmergencyView (hero red-flag moment)
// High-priority alert + case detail grid + 5-stage escalation
// timeline + all actions wired (escalate, referral, record,
// simulated 108 ambulance). AI flags — humans verify and decide.
// ============================================================

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Ambulance, Check, FileText, Phone, Siren } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  EmptyState,
  InfoRow,
  PatientAvatar,
  RedFlagList,
  SectionTitle,
} from "@/components/medikiosk/shared"
import { useAppStore } from "@/lib/store"
import { makeT } from "@/lib/i18n"
import { formatTime } from "@/lib/format"
import type { Patient } from "@/lib/types"
import { cn } from "@/lib/utils"

const STAGES = [
  { key: "detected", label: "Detected" },
  { key: "verified", label: "Verified" },
  { key: "notified", label: "Healthcare Worker Notified" },
  { key: "referral", label: "Referral Initiated" },
  { key: "received", label: "Hospital Received" },
]

const WORKER = "ANM Sunita Sharma"
const DESTINATION = "Gopalganj District Hospital"

export default function EmergencyView() {
  const { data, activeVisitId, role, language, navigate, setActivePatient, updateVisit, createReferral } =
    useAppStore()
  const t = makeT(language)

  const [stage, setStage] = useState(1)
  const [stageTimes, setStageTimes] = useState<Record<number, string>>({})
  const [ambulanceOpen, setAmbulanceOpen] = useState(false)
  const busyRef = useRef(false)

  const visit = useMemo(
    () => data?.visits.find((v) => v.id === activeVisitId) ?? null,
    [data, activeVisitId]
  )
  const patient = useMemo<Patient | null>(
    () => (visit && data ? data.patients.find((p) => p.id === visit.patientId) ?? null : null),
    [data, visit]
  )
  const referralExists = useMemo(
    () => !!data?.referrals.some((r) => r.visitId === visit?.id),
    [data, visit]
  )

  // Derived baseline stage from server-side state (survives re-entry);
  // local `stage` can only advance beyond it.
  const baseStage = visit ? (referralExists ? 4 : visit.status === "ESCALATED" ? 3 : 1) : 1
  const currentStage = Math.max(stage, baseStage)

  // Stage 5 fires automatically 1.5s after the referral exists at stage >= 4.
  useEffect(() => {
    if (currentStage === 4 && referralExists) {
      const timer = window.setTimeout(() => {
        setStage(5)
        setStageTimes((prev) => ({ ...prev, 5: new Date().toISOString() }))
        toast.success("Hospital received — District Hospital OPD notified")
      }, 1500)
      return () => window.clearTimeout(timer)
    }
  }, [currentStage, referralExists])

  // Guard: dataset still bootstrapping
  if (!data) return <ViewSkeleton />

  // Guard: no active visit
  if (!visit) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmptyState
          icon={<Siren className="h-10 w-10" aria-hidden />}
          title="No active emergency case"
          description="Escalate a HIGH-priority patient from the AI triage screen to open the red-flag workflow."
          action={
            <Button
              className="h-12 bg-teal-600 px-6 text-base text-white hover:bg-teal-700"
              onClick={() => navigate("triage")}
            >
              Go to Triage
            </Button>
          }
        />
      </div>
    )
  }

  const stageTimeLabel = (n: number) => {
    if (n === 1) return formatTime(visit.createdAt)
    const ts = stageTimes[n]
    return ts ? formatTime(ts) : null
  }

  const onVerify = () => {
    setStage((s) => Math.max(s, 2))
    setStageTimes((prev) => ({ ...prev, 2: new Date().toISOString() }))
    toast.success(`Evidence verified by ${WORKER}`)
  }

  const onEscalate = async () => {
    if (busyRef.current || currentStage >= 3) return
    busyRef.current = true
    try {
      await updateVisit({ id: visit.id, status: "ESCALATED", by: WORKER })
      setStage((s) => Math.max(s, 3))
      setStageTimes((prev) => ({ ...prev, 3: new Date().toISOString() }))
      toast.success("Healthcare professional notified", {
        description: "Dr. A. Prasad has been alerted for immediate review.",
      })
    } finally {
      busyRef.current = false
    }
  }

  const onStartReferral = async () => {
    if (busyRef.current || currentStage >= 4) return
    busyRef.current = true
    try {
      await createReferral({
        patientId: visit.patientId,
        visitId: visit.id,
        reason: `Red-flag escalation — ${visit.chiefComplaint}`,
        destination: DESTINATION,
        priority: "EMERGENCY",
        createdBy: WORKER,
      })
      setStage((s) => Math.max(s, 4))
      setStageTimes((prev) => ({ ...prev, 4: new Date().toISOString() }))
      toast.success("Referral initiated", {
        description: `${DESTINATION} — EMERGENCY priority.`,
      })
    } finally {
      busyRef.current = false
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* TOP ALERT */}
      <section className="rounded-xl border border-red-300 bg-red-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-8 w-8" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-red-800 sm:text-2xl">{t("highPriorityCase")}</h1>
              <Badge className="border-transparent bg-red-600 text-white">
                Human review required
              </Badge>
            </div>
            <p className="mt-1 text-sm text-red-700 sm:text-base">{t("emergencyMsg")}</p>
          </div>
        </div>
      </section>

      {/* Doctor context note */}
      {role === "doctor" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-900">Reviewing as doctor</p>
          <Button
            size="sm"
            className="h-10 bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => navigate("doctor")}
          >
            Open Doctor Queue
          </Button>
        </div>
      )}

      {/* CASE DETAILS */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <SectionTitle title="Case details" subtitle="Everything a reviewer needs in one place" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Patient
            </p>
            <div className="mt-2 flex items-center gap-3">
              <PatientAvatar name={patient?.name ?? "Patient"} tone="red" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {patient?.name ?? "Unknown"}
                  {patient?.nameHi ? (
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      {patient.nameHi}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {patient ? `${patient.age} yrs · ${patient.gender}` : "—"}
                  {patient ? ` · ${patient.phone}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Location
            </p>
            <div className="mt-2 space-y-0.5">
              <InfoRow label="Village" value={patient?.village ?? "—"} />
              <InfoRow label="District" value={patient?.district ?? "—"} />
              <InfoRow label="Facility" value={visit.facility} />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Symptoms
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visit.symptoms.length === 0 && (
                <p className="text-sm text-muted-foreground">None recorded</p>
              )}
              {visit.symptoms.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </p>
            <div className="mt-2 space-y-0.5">
              <InfoRow label="Complaint" value={visit.chiefComplaint || "—"} />
              <InfoRow label="Duration" value={visit.durationLabel ?? "—"} />
              <InfoRow label="Reported at" value={formatTime(visit.createdAt)} />
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Red flags
            </p>
            <div className="mt-2">
              {visit.redFlags.length ? (
                <RedFlagList flags={visit.redFlags} />
              ) : (
                <p className="text-sm text-muted-foreground">None recorded</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Relevant history
            </p>
            <div className="mt-2 space-y-1.5">
              <HistoryLine label="Conditions" items={patient?.conditions ?? []} />
              <HistoryLine label="Medications" items={patient?.medications ?? []} />
              <HistoryLine label="Allergies" items={patient?.allergies ?? []} tone="amber" />
            </div>
          </div>
        </div>
      </section>

      {/* ESCALATION TIMELINE */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <SectionTitle
          title="Escalation timeline"
          subtitle="Live status of the red-flag workflow (demo)"
        />
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-[540px] items-start">
            {STAGES.map((s, i) => {
              const n = i + 1
              const completed = n < currentStage || n === 1 || (n === 5 && currentStage === 5)
              const current = n === currentStage && n > 1
              const time = stageTimeLabel(n)
              return (
                <Fragment key={s.key}>
                  <div className="flex w-20 shrink-0 flex-col items-center text-center sm:w-24">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
                        completed
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-gray-300 bg-white text-gray-400",
                        current && "animate-pulse border-red-500 bg-white text-red-600 ring-4 ring-red-200"
                      )}
                    >
                      {completed ? <Check className="h-5 w-5" aria-hidden /> : n}
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 text-[11px] font-medium leading-tight sm:text-xs",
                        current ? "text-red-700" : completed ? "text-teal-800" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </p>
                    {time ? <p className="text-[10px] text-muted-foreground">{time}</p> : null}
                    {s.key === "received" && currentStage === 5 && (
                      <p className="text-[10px] font-medium text-teal-700">
                        District Hospital OPD notified
                      </p>
                    )}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      aria-hidden
                      className={cn(
                        "mt-[18px] h-0.5 flex-1 rounded",
                        currentStage >= n + 1 ? "bg-teal-600" : "bg-gray-200"
                      )}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>

        {currentStage === 1 ? (
          <div className="mt-4">
            <Button
              type="button"
              className="h-12 bg-teal-600 text-base font-semibold text-white hover:bg-teal-700"
              onClick={onVerify}
            >
              <Check className="h-5 w-5" aria-hidden /> Verify Evidence
            </Button>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-teal-700">
            <Check className="h-4 w-4" aria-hidden /> Verified by {WORKER}
            {stageTimes[2] ? ` at ${formatTime(stageTimes[2])}` : ""}
          </p>
        )}
      </section>

      {/* ACTIONS */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <SectionTitle
          title="Actions"
          subtitle="Every action updates the shared record and audit trail"
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            className="h-14 bg-red-600 text-base font-semibold text-white hover:bg-red-700"
            disabled={currentStage >= 3}
            onClick={() => void onEscalate()}
          >
            <Siren className="h-5 w-5" aria-hidden /> {t("escalateToDoctor")}
          </Button>
          <Button
            variant="outline"
            className="h-14 border-teal-600 text-base font-semibold text-teal-700 hover:bg-teal-50"
            disabled={currentStage >= 4}
            onClick={() => void onStartReferral()}
          >
            <Ambulance className="h-5 w-5" aria-hidden /> {t("startReferral")}
          </Button>
          <Button
            variant="outline"
            className="h-14 text-base"
            onClick={() => {
              setActivePatient(visit.patientId, visit.id)
              navigate("record")
            }}
          >
            <FileText className="h-5 w-5" aria-hidden /> {t("viewRecord")}
          </Button>
          <Button variant="ghost" className="h-14 text-base" onClick={() => setAmbulanceOpen(true)}>
            <Phone className="h-5 w-5" aria-hidden /> Simulate 108 Ambulance
          </Button>
        </div>
      </section>

      {/* Simulated 108 dialog */}
      <Dialog open={ambulanceOpen} onOpenChange={setAmbulanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-red-600" aria-hidden /> Simulate 108 Ambulance
            </DialogTitle>
            <DialogDescription>
              SIMULATED FOR DEMO — 108 ambulance dispatch is mocked in this prototype. In
              production this would integrate with state emergency services.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="h-11 bg-teal-600 text-white hover:bg-teal-700">OK</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ------------------------------------------------------------
// Local sub-components
// ------------------------------------------------------------

function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function HistoryLine({
  label,
  items,
  tone = "teal",
}: {
  label: string
  items: string[]
  tone?: "teal" | "amber"
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
      {items.map((it) => (
        <span
          key={it}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium",
            tone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-teal-200 bg-teal-50 text-teal-900"
          )}
        >
          {it}
        </span>
      ))}
    </div>
  )
}
