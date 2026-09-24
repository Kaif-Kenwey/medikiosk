"use client"

// ============================================================
// MediKiosk — Audit Trail view
// Immutable log of every AI action and human validation.
// ============================================================

import { useMemo, useState } from "react"
import { ArrowRightLeft, BellRing, Bot, FileText, ShieldCheck, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatTime } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import type { AuditEvent } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmptyState, SafetyBanner, SectionTitle } from "@/components/medikiosk/shared"

const ROLE_FILTERS = ["AI_SERVICE", "FRONTLINE", "DOCTOR", "SYSTEM", "PATIENT_KIOSK", "ADMIN"] as const

const ROLE_BADGE_STYLES: Record<string, string> = {
  AI_SERVICE: "bg-teal-50 text-teal-700 border-teal-200",
  FRONTLINE: "bg-amber-50 text-amber-700 border-amber-200",
  DOCTOR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SYSTEM: "bg-gray-100 text-gray-600 border-gray-200",
  PATIENT_KIOSK: "bg-stone-100 text-stone-600 border-stone-200",
  ADMIN: "bg-gray-100 text-gray-700 border-gray-300",
}

function auditIcon(e: AuditEvent): LucideIcon {
  const action = e.action.toUpperCase()
  if (action.includes("VALIDAT")) return ShieldCheck
  if (action.includes("REFERRAL")) return ArrowRightLeft
  if (action.includes("DOCUMENT") || action.includes("OCR")) return FileText
  if (action.includes("FOLLOWUP") || action.includes("FOLLOW_UP")) return BellRing
  if (e.actorRole === "AI_SERVICE" || e.actorRole === "SYSTEM") return Bot
  return User
}

const ICON_STYLES: Record<string, string> = {
  AI_SERVICE: "bg-teal-100 text-teal-700",
  FRONTLINE: "bg-amber-100 text-amber-700",
  DOCTOR: "bg-emerald-100 text-emerald-700",
  SYSTEM: "bg-gray-100 text-gray-600",
  PATIENT_KIOSK: "bg-stone-100 text-stone-600",
  ADMIN: "bg-gray-200 text-gray-700",
}

function LogSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full max-w-md rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function AuditLogView() {
  const { data } = useAppStore()
  const [roleFilter, setRoleFilter] = useState<string>("ALL")

  const audits = data?.audits ?? []

  const filtered = useMemo(() => {
    const list = roleFilter === "ALL" ? audits : audits.filter((a) => a.actorRole === roleFilter)
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [audits, roleFilter])

  const aiEvents = audits.filter((a) => a.actorRole === "AI_SERVICE").length
  const humanValidations = audits.filter(
    (a) => a.action.toUpperCase().includes("VALIDAT") && a.actorRole !== "AI_SERVICE" && a.actorRole !== "SYSTEM"
  ).length

  if (!data) return <LogSkeleton />

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Audit Trail"
        subtitle="Every AI action and human validation is logged"
        actions={
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
            <SelectTrigger className="w-44" aria-label="Filter audit log by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {ROLE_FILTERS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="border-teal-200 bg-teal-50 px-3 py-1.5 text-teal-800">
          {audits.length} recent events
        </Badge>
        <Badge variant="outline" className="border-teal-200 bg-teal-50 px-3 py-1.5 text-teal-700">
          <Bot className="h-3.5 w-3.5" /> {aiEvents} AI events
        </Badge>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" /> {humanValidations} human validations
        </Badge>
        {roleFilter !== "ALL" ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">
            Filtered: {roleFilter.replace(/_/g, " ")} · {filtered.length}
          </Badge>
        ) : null}
      </div>

      {/* Log list */}
      <Card className="gap-3">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Session trail — newest first</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-8 w-8" />}
              title="No events for this role"
              description="Try another role filter, or interact with the kiosk to generate new audit events."
            />
          ) : (
            <>
              <style>{`
                .mk-audit-scroll::-webkit-scrollbar { width: 8px; }
                .mk-audit-scroll::-webkit-scrollbar-track { background: transparent; }
                .mk-audit-scroll::-webkit-scrollbar-thumb { background: #99f6e4; border-radius: 8px; }
                .mk-audit-scroll { scrollbar-width: thin; scrollbar-color: #99f6e4 transparent; }
              `}</style>
              <ul className="mk-audit-scroll max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {filtered.map((e) => {
                const Icon = auditIcon(e)
                return (
                  <li key={e.id} className="flex gap-3 rounded-xl border bg-card px-3 py-2.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        ICON_STYLES[e.actorRole] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTime(e.createdAt)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">{formatDate(e.createdAt)}</span>
                        <span className="text-sm font-semibold text-foreground">{e.actor}</span>
                        <Badge variant="outline" className={cn("text-[10px]", ROLE_BADGE_STYLES[e.actorRole] ?? "")}>
                          {e.actorRole.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-teal-800">{e.action}</p>
                      <p className="truncate text-sm text-foreground">→ {e.target}</p>
                      {e.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p> : null}
                    </div>
                  </li>
                )
              })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <SafetyBanner>
        Audit events are immutable in production; this demo shows the current session trail.
      </SafetyBanner>
    </div>
  )
}
