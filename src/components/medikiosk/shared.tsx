"use client"

// ============================================================
// MediKiosk — Shared UI primitives (single source of visual truth)
// ============================================================

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  DIAG_STATUS_STYLES,
  FOLLOWUP_STATUS_STYLES,
  PRIORITY_STYLES,
  REFERRAL_STATUS_STYLES,
  initials,
  statusLabel,
} from "@/lib/format"
import { AlertTriangle, Bot, Info, ShieldCheck } from "lucide-react"

export function SectionTitle({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PriorityBadge({ priority, className }: { priority: string | null; className?: string }) {
  if (!priority) return null
  return (
    <Badge variant="outline" className={cn("font-semibold", PRIORITY_STYLES[priority] ?? "", className)}>
      {priority === "HIGH" ? "● " : ""}Priority: {statusLabel(priority)}
    </Badge>
  )
}

export function StatusBadge({
  status,
  kind,
  className,
}: {
  status: string
  kind: "referral" | "diagnostic" | "followup"
  className?: string
}) {
  const styles =
    kind === "referral"
      ? REFERRAL_STATUS_STYLES
      : kind === "diagnostic"
        ? DIAG_STATUS_STYLES
        : FOLLOWUP_STATUS_STYLES
  return (
    <Badge variant="outline" className={cn("font-medium", styles[status] ?? "", className)}>
      {statusLabel(status)}
    </Badge>
  )
}

export function SyncBadge({ syncStatus }: { syncStatus: string }) {
  if (syncStatus !== "PENDING") return null
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 font-medium text-amber-700">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending sync
    </Badge>
  )
}

export function PatientAvatar({
  name,
  size = "md",
  tone = "teal",
}: {
  name: string
  size?: "sm" | "md" | "lg"
  tone?: "teal" | "red"
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-14 w-14 text-lg",
        tone === "teal" ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700"
      )}
    >
      {initials(name)}
    </div>
  )
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string
  value: ReactNode
  sub?: string
  icon?: ReactNode
  tone?: "default" | "teal" | "amber" | "red" | "green"
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              tone === "teal" && "bg-teal-100 text-teal-700",
              tone === "amber" && "bg-amber-100 text-amber-700",
              tone === "red" && "bg-red-100 text-red-700",
              tone === "green" && "bg-emerald-100 text-emerald-700",
              tone === "default" && "bg-muted text-muted-foreground"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Small AI transparency note used across screens */
export function AINote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs text-teal-900">
      <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children ?? "AI-assisted information — requires human validation by a healthcare professional."}</span>
    </div>
  )
}

export function SafetyBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
      style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
      <span className="text-muted-foreground">
        {children ??
          "Prototype notice: AI-assisted workflow support only. It does not replace professional medical judgment, diagnosis, or treatment."}
      </span>
    </div>
  )
}

export function RedFlagList({ flags }: { flags: string[] }) {
  if (!flags.length) return null
  return (
    <ul className="space-y-1.5">
      {flags.map((f) => (
        <li key={f} className="flex items-center gap-2 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {f}
        </li>
      ))}
    </ul>
  )
}

export function SourceChip({ source }: { source: string }) {
  return (
    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-[11px] font-normal text-gray-600">
      <Info className="mr-1 h-3 w-3" /> {source}
    </Badge>
  )
}
