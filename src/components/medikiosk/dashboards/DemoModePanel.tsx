"use client"

// ============================================================
// MediKiosk — Demo Mode panel (judges' cockpit)
// Guided scenarios, offline simulator and one-tap reset.
// ============================================================

import { CheckCircle2, Play, RotateCcw, ShieldCheck, Users, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { HERO_SCENARIO, SCENARIOS } from "@/lib/demo-scenarios"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { SectionTitle } from "@/components/medikiosk/shared"

const JUDGE_FACTS = [
  "Continuity of Care for Rural India — one patient, one continuous history",
  "AI assists → AI verifies → Human validates → Professional decides",
  "Offline-tolerant: capture without connectivity, sync later",
  "ABDM-aligned FHIR R4 export (abstraction)",
]

const DEMO_ROLES = [
  { role: "Kiosk Patient", who: "Self-service intake — voice in Hindi / Bengali", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  { role: "Frontline", who: "ANM Sunita Sharma — triage review, escalation, follow-up", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { role: "Doctor", who: "Dr. A. Prasad — validation, consultation, diagnostics", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { role: "Admin", who: "Facility oversight — stock, metrics, audit trail", tone: "bg-gray-100 text-gray-700 border-gray-300" },
]

export default function DemoModePanel() {
  const { resetDemo, isOffline, toggleOffline, setScenario, navigate } = useAppStore()

  const startScenario = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)
    if (!s) return
    setScenario(id, 0)
    navigate(s.steps[0].view)
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Demo Mode"
        subtitle="Guided scenarios + instant reset for judging"
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <RotateCcw className="h-4 w-4" /> Reset Demo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset demo environment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This restores the seeded demo dataset and returns to the kiosk home. Any records captured
                  during judging are discarded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    void resetDemo()
                  }}
                >
                  Reset Demo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* Connection simulator */}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center gap-4 px-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <WifiOff className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Simulate Offline Mode</p>
            <p className="text-sm text-muted-foreground">
              Queue intake and records locally, then sync. Use <span className="font-medium text-foreground">Sync Now</span> in
              the header to replay queued records when back online.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOffline ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                Offline — changes queued
              </Badge>
            ) : (
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                Online
              </Badge>
            )}
            <Switch checked={isOffline} onCheckedChange={toggleOffline} aria-label="Simulate offline mode" />
          </div>
        </CardContent>
      </Card>

      {/* Scenario grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => {
          const isHero = s.id === HERO_SCENARIO
          return (
            <Card
              key={s.id}
              className={cn(
                "gap-3",
                isHero && "border-red-300 shadow-md ring-1 ring-red-200 sm:col-span-2 xl:col-span-1"
              )}
            >
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {isHero ? (
                    <Badge className="bg-red-600 font-bold tracking-wide text-white">HERO</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-3">
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                    {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                  </Badge>
                  <Button
                    size="sm"
                    className={cn(
                      "bg-teal-600 text-white hover:bg-teal-700",
                      isHero && "bg-red-600 hover:bg-red-700"
                    )}
                    onClick={() => startScenario(s.id)}
                  >
                    <Play className="h-3.5 w-3.5" /> Start scenario
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Judge quick facts + roles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-teal-700" /> Judge quick facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {JUDGE_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-teal-700" /> Demo roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {DEMO_ROLES.map((r) => (
              <div key={r.role} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <Badge variant="outline" className={cn("shrink-0 font-semibold", r.tone)}>
                  {r.role}
                </Badge>
                <span className="text-sm text-muted-foreground">{r.who}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Roles are switched via the header menu — no passwords in demo mode.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
