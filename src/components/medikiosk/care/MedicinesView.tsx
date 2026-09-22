"use client"

// ============================================================
// MediKiosk — Facility-level medicine availability for frontline workers
// ============================================================

import { useMemo, useState } from "react"
import { AlertTriangle, Building2, CheckCircle2, MapPin, Pill, Search, XCircle } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { FACILITIES, type DemoData, type MedicineStock } from "@/lib/types"
import { formatDate, formatTime } from "@/lib/format"
import { EmptyState, SafetyBanner, SectionTitle, StatCard } from "@/components/medikiosk/shared"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ---------- module-level constants ----------

/** Nearest-facility order used for the "alternative facility" hint */
const ALTERNATIVE_ORDER = ["Rampur PHC", "Siwan Rural Hospital", "Gopalganj District Hospital"]

const STOCK_STYLES: Record<MedicineStock["status"], string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOW: "border-amber-200 bg-amber-50 text-amber-700",
  OUT: "border-red-200 bg-red-50 text-red-700",
}

const STOCK_LABEL: Record<MedicineStock["status"], string> = {
  AVAILABLE: "Available",
  LOW: "Low stock",
  OUT: "Out of stock",
}

function alternativeHint(data: DemoData, row: MedicineStock): string | null {
  for (const facility of ALTERNATIVE_ORDER) {
    if (facility === row.facility) continue
    const found = data.medicines.find(
      (m) => m.medicine === row.medicine && m.facility === facility && m.status === "AVAILABLE"
    )
    if (found) {
      return `Available at ${found.facility} (${found.quantity.toLocaleString("en-IN")} ${found.unit})`
    }
  }
  return null
}

// ---------- main view ----------

export function MedicinesView() {
  const data = useAppStore((s) => s.data)
  const [query, setQuery] = useState("")
  const [facility, setFacility] = useState<string>("ALL")

  const medicines = useMemo(() => data?.medicines ?? [], [data])

  const stats = useMemo(() => {
    const available = medicines.filter((m) => m.status === "AVAILABLE").length
    const low = medicines.filter((m) => m.status === "LOW").length
    const out = medicines.filter((m) => m.status === "OUT").length
    const tracked = new Set(medicines.map((m) => m.medicine)).size
    return { available, low, out, tracked }
  }, [medicines])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return medicines.filter(
      (m) => m.medicine.toLowerCase().includes(q) && (facility === "ALL" || m.facility === facility)
    )
  }, [medicines, query, facility])

  const groups = useMemo(() => {
    const map = new Map<string, MedicineStock[]>()
    for (const row of filtered) {
      const list = map.get(row.medicine) ?? []
      list.push(row)
      map.set(row.medicine, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Medicine Availability"
        subtitle="Facility-level stock visibility for frontline workers"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Available"
          value={stats.available}
          sub="facility stock records"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
        />
        <StatCard
          label="Low stock"
          value={stats.low}
          sub="reorder soon"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Out of stock"
          value={stats.out}
          sub="needs escalation"
          icon={<XCircle className="h-4 w-4" />}
          tone="red"
        />
        <StatCard
          label="Medicines tracked"
          value={stats.tracked}
          sub="unique medicines"
          icon={<Pill className="h-4 w-4" />}
          tone="teal"
        />
      </div>

      {/* Search + facility filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicines by name…"
            className="h-10 pl-9"
            aria-label="Search medicines"
          />
        </div>
        <Select value={facility} onValueChange={setFacility}>
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Filter by facility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All facilities</SelectItem>
            {FACILITIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Showing {filtered.length} of {medicines.length} stock records
      </p>

      {/* Grouped results */}
      {groups.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="No medicines match your search"
          description="Try a different medicine name or clear the facility filter."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setFacility("ALL")
              }}
              className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {groups.map(([medicine, rows]) => (
            <div key={medicine} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{medicine}</p>
                {rows.length > 1 ? (
                  <span className="text-[11px] text-muted-foreground">
                    {rows.length} facility records
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {rows.map((row) => {
                  const alt = row.status === "AVAILABLE" ? null : alternativeHint(data, row)
                  return (
                    <div key={row.id} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {row.facility}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {row.quantity.toLocaleString("en-IN")} {row.unit}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              STOCK_STYLES[row.status]
                            )}
                          >
                            {STOCK_LABEL[row.status]}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Updated {formatDate(row.updatedAt)} {formatTime(row.updatedAt)}
                      </p>
                      {row.status !== "AVAILABLE" ? (
                        alt ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-teal-700">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {alt}
                          </p>
                        ) : (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            No alternative facility currently holds this medicine
                          </p>
                        )
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <SafetyBanner>
        Prototype shows visibility only — pharmacy ordering is not included in this demo.
      </SafetyBanner>
    </div>
  )
}
