"use client"

// ============================================================
// MediKiosk — Care Coordination Network map
// Visual continuity: 4-node facility ladder with animated
// referral flow + in-motion referral chips.
// ============================================================

import { ArrowRight, Building2, Cross, Hospital, Landmark } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { initials, statusLabel } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import { FACILITIES } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PatientAvatar, SectionTitle } from "@/components/medikiosk/shared"

const NODE_META: Record<string, { icon: LucideIcon; role: string }> = {
  "Rampur Sub-Centre": { icon: Cross, role: "Village health post" },
  "Rampur PHC": { icon: Building2, role: "Primary health centre" },
  "Siwan Rural Hospital": { icon: Hospital, role: "Rural hospital" },
  "Gopalganj District Hospital": { icon: Landmark, role: "District referral hub" },
}

const SHORT_NAME: Record<string, string> = {
  "Rampur Sub-Centre": "Sub-Centre",
  "Rampur PHC": "PHC",
  "Siwan Rural Hospital": "Rural Hospital",
  "Gopalganj District Hospital": "District Hospital",
}

const REFERRAL_PRIORITY_DOT: Record<string, string> = {
  ROUTINE: "bg-emerald-500",
  URGENT: "bg-amber-500",
  EMERGENCY: "bg-red-500",
}

const ACTIVE_REFERRAL_STATUSES = ["ACCEPTED", "IN_TRANSIT", "ARRIVED"]

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full max-w-md rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function FlowConnector({ index }: { index: number }) {
  return (
    <>
      {/* Desktop: horizontal connector */}
      <div className="hidden min-w-[3.5rem] flex-1 items-center px-1 lg:flex" aria-hidden>
        <div className="relative h-1 w-full rounded-full bg-teal-200">
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-teal-600"
            style={{ animation: `medikiosk-flow-x 2.4s linear infinite`, animationDelay: `${index * 0.6}s` }}
          />
        </div>
      </div>
      {/* Mobile: vertical connector */}
      <div className="flex justify-center py-1 lg:hidden" aria-hidden>
        <div className="relative h-10 w-1 rounded-full bg-teal-200">
          <span
            className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-teal-600"
            style={{ animation: `medikiosk-flow-y 2.4s linear infinite`, animationDelay: `${index * 0.6}s` }}
          />
        </div>
      </div>
    </>
  )
}

export default function NetworkMap() {
  const { data, navigate } = useAppStore()

  if (!data) return <DashboardSkeleton />

  const stats = FACILITIES.map((facility) => ({
    facility,
    originating: data.referrals.filter((r) => r.origin === facility).length,
    arriving: data.referrals.filter((r) => r.destination === facility).length,
    patients: new Set(data.visits.filter((v) => v.facility === facility).map((v) => v.patientId)).size,
  }))

  const inMotion = data.referrals
    .filter((r) => ACTIVE_REFERRAL_STATUSES.includes(r.status))
    .map((r) => ({
      referral: r,
      patient: data.patients.find((p) => p.id === r.patientId)?.name ?? "Unknown",
      originIdx: Math.max(0, FACILITIES.indexOf(r.origin as (typeof FACILITIES)[number])),
      destIdx: Math.max(0, FACILITIES.indexOf(r.destination as (typeof FACILITIES)[number])),
    }))
    .sort((a, b) => a.originIdx - b.originIdx || a.destIdx - b.destIdx)

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes medikiosk-flow-x {
          0% { left: 0; opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { left: calc(100% - 10px); opacity: 0; }
        }
        @keyframes medikiosk-flow-y {
          0% { top: 0; opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { top: calc(100% - 10px); opacity: 0; }
        }
      `}</style>

      <SectionTitle
        title="Care Coordination Network"
        subtitle="Continuity of care across the facility ladder"
      />

      {/* Ladder flow */}
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {stats.map((s, i) => {
          const meta = NODE_META[s.facility]
          const Icon = meta.icon
          return (
            <div key={s.facility} className="contents">
              <Card className="flex-1 gap-3 py-4">
                <CardContent className="flex h-full flex-col gap-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.facility}</p>
                      <p className="text-xs text-muted-foreground">{meta.role}</p>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <p className="text-sm font-bold text-teal-700">{s.originating}</p>
                      <p className="text-[10px] leading-tight text-muted-foreground">referred out</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <p className="text-sm font-bold text-teal-700">{s.arriving}</p>
                      <p className="text-[10px] leading-tight text-muted-foreground">received</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <p className="text-sm font-bold text-teal-700">{s.patients}</p>
                      <p className="text-[10px] leading-tight text-muted-foreground">patients</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {i < stats.length - 1 ? <FlowConnector index={i} /> : null}
            </div>
          )
        })}
      </div>

      {/* In-motion referrals */}
      <Card className="gap-3">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Referrals in motion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inMotion.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accepted referrals travelling right now.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inMotion.map(({ referral, patient }) => (
                <span
                  key={referral.id}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-sm"
                >
                  <PatientAvatar name={patient} size="sm" />
                  <span className="font-semibold text-foreground">{initials(patient)}</span>
                  <span className={cn("h-2 w-2 rounded-full", REFERRAL_PRIORITY_DOT[referral.priority] ?? "bg-teal-500")} aria-hidden />
                  <span className="text-muted-foreground">{statusLabel(referral.status)}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="font-medium text-teal-700">
                    {SHORT_NAME[referral.origin] ?? referral.origin} → {SHORT_NAME[referral.destination] ?? referral.destination}
                  </span>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Routine
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Urgent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Emergency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Patient in transit
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Caption */}
      <Card className="border-teal-200 bg-teal-50/40 py-4">
        <CardContent className="flex flex-wrap items-center gap-3 px-4">
          <Badge variant="outline" className="border-teal-300 bg-white text-teal-800">
            One patient · one record
          </Badge>
          <p className="flex-1 text-sm text-teal-900">
            Every referral keeps its history — one patient, one continuous record across facilities.
          </p>
          <Button size="sm" className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => navigate("referrals")}>
            Open referral tracker <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
