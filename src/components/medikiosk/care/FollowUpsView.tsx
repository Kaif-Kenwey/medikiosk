"use client"

// ============================================================
// MediKiosk — High-risk follow-up board ("no patient falls through the cracks")
// ============================================================

import { useMemo, useState } from "react"
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  HandHeart,
  PhoneCall,
  User,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { DEMO_NOW_ISO, type FollowUp } from "@/lib/types"
import { formatDate } from "@/lib/format"
import {
  EmptyState,
  PatientAvatar,
  SectionTitle,
  StatusBadge,
  SyncBadge,
} from "@/components/medikiosk/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ---------- module-level constants (fixed demo clock — no Date.now in render) ----------

const DEMO_NOW = new Date(DEMO_NOW_ISO)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WORKER = "ANM Sunita Sharma"

type TabValue = "ALL" | FollowUp["category"]

const CATEGORY_TABS: { value: TabValue; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "MATERNAL", label: "Maternal" },
  { value: "CHILD", label: "Child" },
  { value: "CHRONIC", label: "Chronic" },
  { value: "HIGH_RISK", label: "High-risk" },
  { value: "MISSED", label: "Missed" },
]

const CATEGORY_CHIP: Record<FollowUp["category"], string> = {
  MATERNAL: "border-rose-200 bg-rose-50 text-rose-700",
  CHILD: "border-teal-200 bg-teal-50 text-teal-700",
  CHRONIC: "border-gray-200 bg-gray-50 text-gray-600",
  HIGH_RISK: "border-red-200 bg-red-50 text-red-700",
  MISSED: "border-amber-200 bg-amber-50 text-amber-700",
}

const CATEGORY_LABEL: Record<FollowUp["category"], string> = {
  MATERNAL: "Maternal",
  CHILD: "Child",
  CHRONIC: "Chronic",
  HIGH_RISK: "High-risk",
  MISSED: "Missed",
}

const RISK_STYLES: Record<FollowUp["risk"], string> = {
  HIGH: "border-red-200 bg-red-50 text-red-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  LOW: "border-gray-200 bg-gray-100 text-gray-600",
}

const RISK_LABEL: Record<FollowUp["risk"], string> = {
  HIGH: "High risk",
  MEDIUM: "Medium risk",
  LOW: "Low risk",
}

function isOverdue(f: FollowUp): boolean {
  return f.status !== "COMPLETED" && new Date(f.nextDue).getTime() < DEMO_NOW.getTime()
}

function isDueThisWeek(f: FollowUp): boolean {
  if (f.status === "COMPLETED") return false
  const t = new Date(f.nextDue).getTime()
  return t >= DEMO_NOW.getTime() && t <= DEMO_NOW.getTime() + WEEK_MS
}

// ---------- main view ----------

export function FollowUpsView() {
  const data = useAppStore((s) => s.data)
  const updateFollowUp = useAppStore((s) => s.updateFollowUp)

  const [tab, setTab] = useState<TabValue>("ALL")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<FollowUp | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState("")

  const followUps = useMemo(() => data?.followUps ?? [], [data])

  const chips = useMemo(() => {
    const overdue = followUps.filter(isOverdue).length
    const week = followUps.filter(isDueThisWeek).length
    const pending = followUps.filter((f) => f.status === "PENDING").length
    const completed = followUps.filter((f) => f.status === "COMPLETED").length
    return { overdue, week, pending, completed }
  }, [followUps])

  const visible = useMemo(() => {
    const list = tab === "ALL" ? followUps : followUps.filter((f) => f.category === tab)
    return [...list].sort((a, b) => a.nextDue.localeCompare(b.nextDue))
  }, [followUps, tab])

  async function act(
    f: FollowUp,
    status: FollowUp["status"],
    extra?: { nextDue?: string; notes?: string }
  ) {
    setBusyId(f.id)
    try {
      await updateFollowUp({ id: f.id, status, nextDue: extra?.nextDue, notes: extra?.notes, by: WORKER })
    } finally {
      setBusyId(null)
    }
  }

  function openReschedule(f: FollowUp) {
    setRescheduleFor(f)
    setRescheduleDate(f.nextDue.slice(0, 10))
  }

  async function confirmReschedule() {
    if (!rescheduleFor || !rescheduleDate) return
    const iso = new Date(`${rescheduleDate}T09:00:00+05:30`).toISOString()
    await act(rescheduleFor, "RESCHEDULED", {
      nextDue: iso,
      notes: `Rescheduled by ${WORKER} to ${formatDate(iso)}`,
    })
    setRescheduleFor(null)
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="High-Risk Follow-up" subtitle="No patient falls through the cracks" />

      {/* Stat chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {chips.overdue} overdue
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {chips.week} due this week
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> {chips.pending} pending
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {chips.completed} completed
        </span>
      </div>

      {/* Category filter */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="h-auto min-h-9 flex-wrap">
          {CATEGORY_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Follow-up cards */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<HandHeart className="h-10 w-10" />}
          title="No follow-ups in this category"
          description="Nothing needs attention here right now — every patient in this group is on track."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((f) => {
            const patient = data.patients.find((p) => p.id === f.patientId)
            const overdue = isOverdue(f)
            const busy = busyId === f.id
            return (
              <article
                key={f.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm",
                  overdue && "border-l-4 border-l-red-400"
                )}
              >
                <div className="flex items-start gap-3">
                  <PatientAvatar
                    name={patient?.name ?? "Unknown"}
                    size="sm"
                    tone={f.risk === "HIGH" ? "red" : "teal"}
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-medium", CATEGORY_CHIP[f.category])}
                      >
                        {CATEGORY_LABEL[f.category]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-semibold", RISK_STYLES[f.risk])}
                      >
                        {RISK_LABEL[f.risk]}
                      </Badge>
                      <SyncBadge syncStatus={f.syncStatus} />
                    </div>

                    <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        Last visit: {formatDate(f.lastVisit)}
                      </p>
                      <p
                        className={cn(
                          "flex items-center gap-1.5",
                          overdue ? "font-semibold text-red-600" : ""
                        )}
                      >
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        Next follow-up: {formatDate(f.nextDue)}
                        {overdue ? (
                          <Badge
                            variant="outline"
                            className="ml-1 border-red-200 bg-red-50 text-[10px] font-semibold text-red-700"
                          >
                            Overdue
                          </Badge>
                        ) : null}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {f.assignedWorker ?? "Unassigned"}
                      </p>
                    </div>

                    {f.notes ? (
                      <p className="mt-2 line-clamp-2 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                        {f.notes}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                      <StatusBadge status={f.status} kind="followup" />
                    </div>

                    {f.status !== "COMPLETED" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => act(f, "CONTACTED")} disabled={busy}>
                          <PhoneCall className="h-3.5 w-3.5" /> Contact
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReschedule(f)}
                          disabled={busy}
                        >
                          <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => act(f, "ESCALATED")}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" /> Escalate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => act(f, "COMPLETED")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Reschedule dialog */}
      <Dialog
        open={rescheduleFor !== null}
        onOpenChange={(open) => {
          if (!open) setRescheduleFor(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule follow-up</DialogTitle>
            <DialogDescription>
              {rescheduleFor
                ? `Pick a new due date for ${data.patients.find((p) => p.id === rescheduleFor.patientId)?.name ?? "this patient"}.`
                : "Pick a new due date."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="followup-date">New due date</Label>
            <Input
              id="followup-date"
              type="date"
              value={rescheduleDate}
              min={DEMO_NOW.toISOString().slice(0, 10)}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleFor(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReschedule} disabled={!rescheduleDate || busyId !== null}>
              <CalendarClock className="h-4 w-4" /> Confirm reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
