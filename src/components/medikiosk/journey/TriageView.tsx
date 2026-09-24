"use client"

// ============================================================
// MediKiosk — TriageView (AI-assisted triage, human-in-the-loop)
// Shows the active visit's AI risk flag with evidence, safety
// notices and next actions. HIGH → emergency, MEDIUM/LOW → doctor.
// ============================================================

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowRight, ChevronRight, ClipboardList, FileSearch, FileText, Siren } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AINote,
  EmptyState,
  InfoRow,
  PatientAvatar,
  PriorityBadge,
  RedFlagList,
  SafetyBanner,
  SectionTitle,
  SourceChip,
  SyncBadge,
} from "@/components/medikiosk/shared"
import { useAppStore } from "@/lib/store"
import { makeT } from "@/lib/i18n"
import { statusLabel } from "@/lib/format"
import type { Patient, TriagePriority } from "@/lib/types"
import { cn } from "@/lib/utils"

const PANEL_BORDER: Record<string, string> = {
  HIGH: "border-l-red-600",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-emerald-600",
}

const WORKFLOW: Record<TriagePriority, string[]> = {
  HIGH: ["RED-FLAG ESCALATION", "Doctor review", "Referral"],
  MEDIUM: ["Frontline review", "PHC consultation", "Follow-up"],
  LOW: ["Routine OPD", "Medicine dispensing", "Self-care"],
}

export default function TriageView() {
  const { data, activeVisitId, language, navigate } = useAppStore()
  const t = makeT(language)

  const [showEvidence, setShowEvidence] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const visit = useMemo(
    () => data?.visits.find((v) => v.id === activeVisitId) ?? null,
    [data, activeVisitId]
  )
  const patient = useMemo<Patient | null>(
    () => (visit && data ? data.patients.find((p) => p.id === visit.patientId) ?? null : null),
    [data, visit]
  )

  // Guard: dataset still bootstrapping
  if (!data) return <ViewSkeleton />

  // Guard: no active visit yet
  if (!visit) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmptyState
          icon={<ClipboardList className="h-10 w-10" aria-hidden />}
          title="No active visit"
          description="Complete a patient intake to see the AI-assisted triage assessment here."
          action={
            <Button
              className="h-12 bg-teal-600 px-6 text-base text-white hover:bg-teal-700"
              onClick={() => navigate("intake")}
            >
              Start Intake
            </Button>
          }
        />
      </div>
    )
  }

  const priority: TriagePriority | null = visit.triagePriority
  const confidencePct = priority ? (priority === "HIGH" ? 93 : 88) : 50
  const workflow = WORKFLOW[priority ?? "MEDIUM"]

  const onContinue = () => {
    toast.success("Patient added to the care queue", {
      description: "The visit now appears in the doctor's OPD queue.",
    })
    navigate("doctor")
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <SectionTitle
        title={t("triageStatus")}
        subtitle="AI-assisted risk flag — requires human review"
        actions={<SyncBadge syncStatus={visit.syncStatus} />}
      />

      {/* Patient summary */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <PatientAvatar name={patient?.name ?? "Patient"} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-foreground">
              {patient?.name ?? "Unknown patient"}
            </p>
            {patient?.nameHi ? (
              <p className="text-sm text-muted-foreground">{patient.nameHi}</p>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-gray-200 bg-gray-50 text-xs text-gray-600"
          >
            {patient?.mrn ?? "—"}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <InfoRow
            label="Age / Gender"
            value={patient ? `${patient.age} · ${patient.gender}` : "—"}
          />
          <InfoRow label="Village" value={patient?.village ?? "—"} />
          <InfoRow label="Phone" value={patient?.phone ?? "—"} />
          <InfoRow label="Facility" value={visit.facility} />
        </div>
      </section>

      {/* Clinical information */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <SectionTitle title="Clinical information" subtitle="Captured at intake" />
        <div className="mt-3 space-y-1">
          <InfoRow label="Chief complaint" value={visit.chiefComplaint || "—"} />
          <InfoRow label="Duration" value={visit.durationLabel ?? "—"} />
          <InfoRow label="Severity" value={visit.severity ? statusLabel(visit.severity) : "—"} />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">{t("symptoms")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {visit.symptoms.length === 0 && (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
            {visit.symptoms.map((s) => (
              <span
                key={s}
                className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {patient && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Relevant history</p>
            <HistoryChips label="Conditions" items={patient.conditions} />
            <HistoryChips label="Medications" items={patient.medications} />
            <HistoryChips label="Allergies" items={patient.allergies} tone="amber" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {showTranscript ? "Hide recorded complaint" : "View recorded complaint (as captured)"}
        </button>
        {showTranscript && (
          <p className="mt-2 rounded-lg bg-muted/60 p-3 text-sm italic text-muted-foreground">
            “{visit.chiefComplaint}”
          </p>
        )}
      </section>

      {/* TRIAGE STATUS panel */}
      <section
        className={cn("rounded-xl border border-l-4 bg-card p-4 sm:p-6", PANEL_BORDER[priority ?? "MEDIUM"])}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PriorityBadge priority={priority} className="px-3 py-1 text-sm" />
          <SyncBadge syncStatus={visit.syncStatus} />
        </div>

        <div className="mt-3">
          <InfoRow label={t("reason")} value={visit.aiRecommendation ?? "Awaiting AI triage"} />
        </div>

        {visit.redFlags.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">{t("redFlags")}</p>
            <div className="mt-1.5">
              <RedFlagList flags={visit.redFlags} />
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">AI confidence</span>
            <span className="font-semibold text-foreground">{confidencePct}%</span>
          </div>
          <Progress value={confidencePct} className="mt-1.5 h-2" aria-label="AI confidence" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {workflow.map((w, i) => (
            <span key={w} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
              <span className="rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                {w}
              </span>
            </span>
          ))}
        </div>

        {visit.syncStatus === "PENDING" && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-800">
            Full AI triage will run automatically after sync.
          </p>
        )}
      </section>

      {/* Evidence panel (toggled) */}
      {showEvidence && (
        <section className="space-y-3 rounded-xl border border-dashed bg-muted/30 p-4 sm:p-6">
          <SectionTitle
            title="Evidence"
            subtitle="Why the AI flagged this case — verify before acting"
          />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Extracted symptoms</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {visit.symptoms.length === 0 && (
                <p className="text-sm text-muted-foreground">None</p>
              )}
              {visit.symptoms.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="border-teal-200 bg-white text-teal-900"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Red-flag rules matched</p>
            <div className="mt-1.5">
              {visit.redFlags.length ? (
                <RedFlagList flags={visit.redFlags} />
              ) : (
                <p className="text-sm text-muted-foreground">No red-flag rules matched.</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SourceChip source="Deterministic clinical rules engine v1 (demo)" />
            <SourceChip source="AI flag logged to audit trail" />
          </div>
          <AINote>
            This AI flag is advisory. A healthcare professional must confirm or override it
            before any clinical action.
          </AINote>
        </section>
      )}

      {/* Actions */}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {priority === "HIGH" && (
            <Button
              className="h-14 bg-red-600 text-base font-semibold text-white hover:bg-red-700"
              onClick={() => navigate("emergency")}
            >
              <Siren className="h-5 w-5" aria-hidden /> {t("escalate")}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-14 text-base"
            onClick={() => setShowEvidence((v) => !v)}
          >
            <FileSearch className="h-5 w-5" aria-hidden /> {t("reviewEvidence")}
          </Button>
          {priority !== "HIGH" && (
            <Button
              className="h-14 bg-teal-600 text-base font-semibold text-white hover:bg-teal-700"
              onClick={onContinue}
            >
              <ArrowRight className="h-5 w-5" aria-hidden /> {t("continueAssessment")}
            </Button>
          )}
        </div>
      </section>

      <SafetyBanner />
    </div>
  )
}

// ------------------------------------------------------------
// Local sub-components
// ------------------------------------------------------------

function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function HistoryChips({
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

