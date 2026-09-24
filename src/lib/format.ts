// ============================================================
// MediKiosk — Client-side formatting helpers (demo clock: 23 Sep 2026)
// ============================================================

import { DEMO_NOW_ISO } from "@/lib/types"

export const DEMO_NOW = new Date(DEMO_NOW_ISO)

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/** Same-day check against the demo clock (23 Sep 2026) */
export function isToday(iso: string): boolean {
  const d = new Date(iso)
  return (
    d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 23
  )
}

/** Waiting time label for visits created "today" (demo clock) */
export function waitingLabel(iso: string): string {
  const d = new Date(iso)
  const diffMin = Math.max(0, Math.round((DEMO_NOW.getTime() - d.getTime()) / 60000))
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} min`
  const h = Math.floor(diffMin / 60)
  return `${h}h ${diffMin % 60}m`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

export const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
}

export const REFERRAL_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  ACCEPTED: "bg-teal-50 text-teal-700 border-teal-200",
  IN_TRANSIT: "bg-teal-50 text-teal-700 border-teal-200",
  ARRIVED: "bg-teal-100 text-teal-800 border-teal-300",
  IN_CONSULTATION: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
}

export const DIAG_STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  SAMPLE_COLLECTED: "bg-teal-50 text-teal-700 border-teal-200",
  PROCESSING: "bg-teal-50 text-teal-700 border-teal-200",
  RESULT_READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVIEWED: "bg-gray-100 text-gray-600 border-gray-200",
}

export const FOLLOWUP_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONTACTED: "bg-teal-50 text-teal-700 border-teal-200",
  RESCHEDULED: "bg-teal-50 text-teal-700 border-teal-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ESCALATED: "bg-red-50 text-red-700 border-red-200",
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
