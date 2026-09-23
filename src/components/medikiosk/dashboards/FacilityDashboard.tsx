"use client"

// ============================================================
// MediKiosk — Facility Dashboard (admin / operational view)
// Metrics, weekly load, referral trend, priority mix,
// medicine stock alerts and the facility network strip.
// ============================================================

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Map as MapIcon,
  Pill,
  Send,
  Siren,
  Timer,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { FACILITIES } from "@/lib/types"
import { useAppStore } from "@/lib/store"
import { EmptyState, StatCard } from "@/components/medikiosk/shared"

const WEEK_PATIENTS = [
  { day: "Thu", patients: 18 },
  { day: "Fri", patients: 21 },
  { day: "Sat", patients: 26 },
  { day: "Sun", patients: 19 },
  { day: "Mon", patients: 31 },
  { day: "Tue", patients: 24 },
  { day: "Wed", patients: 38 },
]

const REFERRAL_TREND = [
  { week: "W1", rate: 62 },
  { week: "W2", rate: 68 },
  { week: "W3", rate: 74 },
  { week: "W4", rate: 79 },
  { week: "W5", rate: 86 },
  { week: "W6", rate: 92 },
]

const PRIORITY_MIX_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#ef4444",
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
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function FacilityDashboard() {
  const { data, navigate } = useAppStore()

  if (!data) return <DashboardSkeleton />

  const highVisits = data.visits.filter(
    (v) => v.triagePriority === "HIGH" && v.status !== "COMPLETED"
  )
  const pendingReferrals = data.referrals.filter(
    (r) => r.status === "PENDING" || r.status === "ACCEPTED"
  ).length
  const totalFollowUps = data.followUps.length
  const completedFollowUps = data.followUps.filter((f) => f.status === "COMPLETED").length
  const followUpCompletion = totalFollowUps > 0 ? Math.round((completedFollowUps / totalFollowUps) * 100) : 0
  const escalated = data.visits.filter((v) => v.status === "ESCALATED").length
  const alertMedicines = data.medicines.filter((m) => m.status === "LOW" || m.status === "OUT")
  const alertMedicineNames = new Set(alertMedicines.map((m) => m.medicine))

  const priorityMix = (["LOW", "MEDIUM", "HIGH"] as const).map((p) => ({
    name: p.charAt(0) + p.slice(1).toLowerCase(),
    value: data.visits.filter((v) => v.triagePriority === p).length,
  }))
  const priorityTotal = priorityMix.reduce((sum, e) => sum + e.value, 0)

  // Group low/out stock by medicine across facilities
  const medGroups = new Map<string, { facility: string; status: string }[]>()
  for (const m of alertMedicines) {
    const entries = medGroups.get(m.medicine) ?? []
    entries.push({ facility: m.facility, status: m.status })
    medGroups.set(m.medicine, entries)
  }
  const medGroupList = Array.from(medGroups.entries()).map(([medicine, entries]) => ({
    medicine,
    entries: [...entries].sort((a, b) => Number(b.status === "OUT") - Number(a.status === "OUT")),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center gap-4 px-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700 shadow-sm">
            <Building2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-foreground">Facility Dashboard</p>
            <p className="text-sm text-muted-foreground">Rampur PHC · Gopalganj district · Demo data</p>
          </div>
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">
            Admin view
          </Badge>
        </CardContent>
      </Card>

      {/* Urgent alert */}
      {highVisits.length > 0 ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <Siren className="h-5 w-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm font-semibold text-red-800">
              URGENT — {highVisits.length} red-flag case{highVisits.length === 1 ? "" : "s"} require{highVisits.length === 1 ? "s" : ""} attention
            </p>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => navigate("emergency")}
            >
              Review now <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 pl-8 text-xs text-red-700">
            {highVisits
              .map((v) => data.patients.find((p) => p.id === v.patientId)?.name ?? "Unknown")
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Patients served" value={data.patients.length} sub="registered in system" icon={<Users className="h-4 w-4" />} tone="teal" />
        <StatCard label="Pending referrals" value={pendingReferrals} sub="PENDING + ACCEPTED" icon={<Send className="h-4 w-4" />} tone="amber" />
        <StatCard label="Follow-up completion" value={`${followUpCompletion}%`} sub={`${completedFollowUps} of ${totalFollowUps}`} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <StatCard label="Avg intake time" value="18 min" sub="kiosk median" icon={<Timer className="h-4 w-4" />} tone="default" />
        <StatCard label="Red-flag escalations" value={escalated} sub="awaiting doctor" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Medicine alerts" value={alertMedicineNames.size} sub="LOW or OUT items" icon={<Pill className="h-4 w-4" />} tone="amber" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Patients served this week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEK_PATIENTS} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: "rgba(13, 148, 136, 0.08)" }} />
                  <Bar dataKey="patients" name="Patients" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Referral completion trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={REFERRAL_TREND} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Completion %"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={{ fill: "#10b981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3 lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Case priority mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {priorityTotal === 0 ? (
                <EmptyState title="No triaged visits yet" description="Priority mix appears once AI triage runs." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Pie
                      data={priorityMix}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {priorityMix.map((entry) => (
                        <Cell key={entry.name} fill={PRIORITY_MIX_COLORS[entry.name] ?? "#0d9488"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock + network strip */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4 text-amber-600" /> Low-stock alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {medGroupList.length === 0 ? (
              <p className="text-sm text-muted-foreground">All essential medicines are in good supply.</p>
            ) : (
              <ul className="space-y-2">
                {medGroupList.map(({ medicine, entries }) => (
                  <li key={medicine} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{medicine}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {entries.map((e) => (
                        <span key={`${medicine}-${e.facility}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={`h-2 w-2 rounded-full ${e.status === "OUT" ? "bg-red-500" : "bg-amber-500"}`}
                            aria-hidden
                          />
                          <span className={e.status === "OUT" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>
                            {e.status}
                          </span>{" "}
                          at {e.facility}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800 sm:w-auto"
              onClick={() => navigate("medicines")}
            >
              Check medicines <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Facility network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {FACILITIES.map((f) => {
                const count = data.referrals.filter((r) => r.destination === f).length
                return (
                  <div key={f} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <span className="truncate text-sm font-medium text-foreground">{f}</span>
                    <Badge variant="outline" className="shrink-0 border-teal-200 bg-teal-50 text-teal-700">
                      {count} referral{count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                )
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800 sm:w-auto"
              onClick={() => navigate("network")}
            >
              <MapIcon className="h-4 w-4" /> Open network map
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Operational metrics reflect the live demo dataset — reset from Demo Mode to restore the seeded state.
      </p>
    </div>
  )
}
