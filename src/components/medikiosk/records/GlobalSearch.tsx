"use client"

// ============================================================
// MediKiosk — Global patient search (mounted as a dialog by the shell)
// Searches patients by name / Hindi name / MRN / phone / village /
// patient ID, plus referral IDs mapped back to their patient.
// ============================================================

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Search, User } from "lucide-react"

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PatientAvatar } from "@/components/medikiosk/shared"
import { useAppStore } from "@/lib/store"
import type { Patient } from "@/lib/types"

/** Case-insensitive highlight of the first query occurrence */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  )
}

export default function GlobalSearch() {
  const { data, searchOpen, setSearchOpen, setActivePatient, navigate } = useAppStore()
  const [query, setQuery] = useState("")

  function onOpenChange(open: boolean) {
    setSearchOpen(open)
    if (!open) setQuery("") // clear on close so results don't go stale
  }

  const results = useMemo<Patient[]>(() => {
    if (!data) return []
    const q = query.trim()
    if (q.length < 1) return []
    const ql = q.toLowerCase()
    const seen = new Set<string>()
    const out: Patient[] = []

    for (const p of data.patients) {
      const haystacks = [p.name, p.nameHi ?? "", p.mrn, p.phone, p.village, p.id]
      if (haystacks.some((h) => h.toLowerCase().includes(ql)) && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }

    // Referral IDs map back to their patient
    for (const r of data.referrals) {
      if (r.id.toLowerCase().includes(ql)) {
        const p = data.patients.find((pp) => pp.id === r.patientId)
        if (p && !seen.has(p.id)) {
          seen.add(p.id)
          out.push(p)
        }
      }
    }

    return out.slice(0, 8)
  }, [data, query])

  function onSelect(patientId: string) {
    setActivePatient(patientId)
    onOpenChange(false)
    navigate("record")
  }

  return (
    <Dialog open={searchOpen} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search patients</DialogTitle>
        <DialogDescription>Find a patient by ID, name, phone or referral ID</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput autoFocus placeholder="Search patients…" value={query} onValueChange={setQuery} />
          <CommandList>
            {query.trim().length === 0 ? (
              <CommandEmpty>Start typing to search patients.</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No patients found for “{query.trim()}”.</CommandEmpty>
            ) : (
              <CommandGroup heading="Patients">
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.id} ${p.mrn} ${p.phone}`}
                    onSelect={() => onSelect(p.id)}
                    className="items-start gap-3 py-2.5"
                  >
                    <PatientAvatar name={p.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {highlight(p.name, query)}
                        </span>
                        {p.nameHi ? (
                          <span className="truncate text-xs text-muted-foreground">{highlight(p.nameHi, query)}</span>
                        ) : null}
                        <span className="rounded border border-teal-200 bg-teal-50 px-1 font-mono text-[10px] font-medium text-teal-700">
                          {highlight(p.mrn, query)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {p.age} yrs · {p.gender}
                        </span>
                        <span>{highlight(p.village, query)}</span>
                        <span className="font-mono">{highlight(p.phone, query)}</span>
                      </div>
                    </div>
                    <Search className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Search by Patient ID, name, phone, or referral ID
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
