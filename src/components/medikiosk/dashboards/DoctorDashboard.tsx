"use client"

// ============================================================
// MediKiosk — Doctor Dashboard (professional doctor workspace)
// Queue of today's patients, priority-sorted, with one-tap
// review / validate / refer / complete actions + review inbox.
// ============================================================

import { AlertTriangle, ArrowRight, ArrowRightLeft, BellRing, CalendarDays, CheckCircle2, ClipboardList, Eye, FlaskConical, Send, ShieldCheck, Siren, Stethoscope, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DEMO_NOW,
  formatDate,
  isToday,
  statusLabel,
  waitingLabel,
} from "@/lib/format"
import { useAppStore } from "@/lib/store"
import type { Visit } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmptyState, PatientAvatar, PriorityBadge, StatCard } from "@/components/medikiosk/shared"

const DOCTOR_NAME = "Dr. A. Prasad"
const DOCTOR_DATE_LABEL = "Wednesday, 23 Sep 2026"
const DEMO_WEEK_HORIZON = new Date(DEMO_NOW.getTime() + 7 * 24 * 60 * 60 * 1000)
const DEMO_TOMORROW_END = new Date(DEMO_NOW.getTime() + 2 * 24 * 60 * 60 * 1000)

const VISIT_STATUS_STYLES: Record<string, string> = {
  WAITING: "bg-amber-50 text-amber-700 border-amber-200",
  TRIAGED: "bg-teal-50 text-teal-700 border-teal-200",
  ESCALATED: "bg-red-50 text-red-700 border-red-200",
  IN_CONSULTATION: "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function VisitStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", VISIT_STATUS_STYLES[status] ?? "")}>
      {statusLabel(status)}
    </Badge>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}

export default function DoctorDashboard() {
  const { data, navigate, setActivePatient, updateVisit } = useAppStore()

  if (!data) return <DashboardSkeleton />

  const patients = data.patients
  const patientName = (id: string) => patients.find((p) => p.id === id)?.name ?? "Unknown"
  const patientMrn = (id: string) => patients.find((p) => p.id === id)?.mrn ?? "—"

  const urgentVisits = data.visits.filter(
    (v) => v.triagePriority === "HIGH" && v.status !== "COMPLETED"
  )

  const todaysVisits = data.visits.filter((v) => isToday(v.createdAt))
  const pendingReviews = data.visits.filter((v) => v.status === "TRIAGED" || v.status === "ESCALATED")
  const pendingReferrals = data.referrals.filter((r) => r.status === "PENDING" || r.status === "ACCEPTED")
  const diagnosticsReady = data.diagnostics.filter((d) => d.status === "RESULT_READY")
  const followUpsDue = data.followUps.filter(
    (f) => f.status === "PENDING" && new Date(f.nextDue).getTime() <= DEMO_WEEK_HORIZON.getTime()
  )
  const followUpsSoon = data.followUps
    .filter((f) => f.status === "PENDING" && new Date(f.nextDue).getTime() <= DEMO_TOMORROW_END.getTime())
    .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime())

  const queue: Visit[] = [...data.visits].sort((a, b) => {
    const pa = PRIORITY_RANK[a.triagePriority ?? "LOW"] ?? 2
    const pb = PRIORITY_RANK[b.triagePriority ?? "LOW"] ?? 2
    if (pa !== pb) return pa - pb
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return (
    <div className="space-y-6">
      {/* Doctor identity strip */}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center gap-4 px-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
            <Stethoscope className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-foreground">{DOCTOR_NAME}, MBBS</p>
            <p className="text-sm text-muted-foreground">General Physician · Gopalganj District Hospital</p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-teal-200 bg-teal-50 px-3 py-1.5 text-teal-800">
            <CalendarDays className="h-3.5 w-3.5" /> {DOCTOR_DATE_LABEL}
          </Badge>
        </CardContent>
      </Card>

      {/* Urgent banner */}
      {urgentVisits.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <Siren className="h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 text-sm font-semibold text-red-800">
            URGENT — {urgentVisits.length} high-priority case{urgentVisits.length === 1 ? "" : "s"} require{urgentVisits.length === 1 ? "s" : ""} attention
          </p>
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              const first = urgentVisits[0]
              setActivePatient(first.patientId, first.id)
              navigate("emergency")
            }}
          >
            <Siren className="h-4 w-4" /> Open red-flag console
          </Button>
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's patients" value={todaysVisits.length} sub="kiosk intakes" icon={<Users className="h-4 w-4" />} tone="teal" />
        <StatCard label="Pending reviews" value={pendingReviews.length} sub="triaged / escalated" icon={<ClipboardList className="h-4 w-4" />} tone="amber" />
        <StatCard label="High-priority" value={urgentVisits.length} sub="not completed" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Pending referrals" value={pendingReferrals.length} sub="awaiting facility" icon={<Send className="h-4 w-4" />} tone="default" />
        <StatCard label="Diagnostics ready" value={diagnosticsReady.length} sub="awaiting review" icon={<FlaskConical className="h-4 w-4" />} tone="green" />
        <StatCard label="Follow-ups due" value={followUpsDue.length} sub="within 7 days" icon={<BellRing className="h-4 w-4" />} tone="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main queue */}
        <Card className="gap-4 lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Patient queue — today</span>
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                {queue.length} visit{queue.length === 1 ? "" : "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="pl-4">Patient</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState title="Queue is clear" description="No patient visits in the system yet." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    queue.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2.5">
                            <PatientAvatar name={patientName(v.patientId)} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{patientName(v.patientId)}</p>
                              <p className="text-xs text-muted-foreground">{patientMrn(v.patientId)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.triagePriority ? (
                            <PriorityBadge priority={v.triagePriority} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-44 truncate text-sm text-foreground" title={v.chiefComplaint}>
                            {v.chiefComplaint}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {isToday(v.createdAt) && v.status !== "COMPLETED" ? (
                            waitingLabel(v.createdAt)
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <VisitStatusBadge status={v.status} />
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-teal-300 px-2.5 text-xs text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                              onClick={() => {
                                setActivePatient(v.patientId, v.id)
                                navigate("record")
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </Button>
                            {v.status === "TRIAGED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-emerald-300 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                onClick={() => {
                                  void updateVisit({
                                    id: v.id,
                                    status: "IN_CONSULTATION",
                                    validatedBy: DOCTOR_NAME,
                                    by: DOCTOR_NAME,
                                  })
                                }}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" /> Validate
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5 text-xs text-muted-foreground"
                              onClick={() => {
                                setActivePatient(v.patientId, v.id)
                                navigate("referrals")
                              }}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" /> Refer
                            </Button>
                            {v.status === "IN_CONSULTATION" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-emerald-300 bg-emerald-50 px-2.5 text-xs text-emerald-800 hover:bg-emerald-100"
                                onClick={() => {
                                  void updateVisit({ id: v.id, status: "COMPLETED", by: DOCTOR_NAME })
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="gap-3">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-teal-700" /> Awaiting my review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {diagnosticsReady.length === 0 ? (
                <p className="text-sm text-muted-foreground">No diagnostic results pending review.</p>
              ) : (
                diagnosticsReady.map((d) => (
                  <div key={d.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{d.testType}</p>
                    <p className="text-xs text-muted-foreground">
                      {patientName(d.patientId)} · collected {formatDate(d.createdAt)}
                    </p>
                  </div>
                ))
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                onClick={() => navigate("diagnostics")}
              >
                Open diagnostics <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-amber-600" /> Follow-ups due today / tomorrow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {followUpsSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-ups due in the next two days.</p>
              ) : (
                followUpsSoon.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{patientName(f.patientId)}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(f.nextDue)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-teal-200 bg-teal-50 text-[11px] text-teal-700">
                      {statusLabel(f.category)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
