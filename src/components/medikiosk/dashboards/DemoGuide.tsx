"use client"

// ============================================================
// MediKiosk — Floating demo guide (guided walkthrough HUD)
// Visible while a scenario is active; supports next / back /
// jump-to-step and a clean finish with toast.
// ============================================================

import { toast } from "sonner"
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, MapPin, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SCENARIOS } from "@/lib/demo-scenarios"
import { useAppStore } from "@/lib/store"
import { statusLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function DemoGuide() {
  const { scenario, setScenario, scenarioNext, navigate, guideOpen, setGuideOpen } = useAppStore()

  const current = SCENARIOS.find((s) => s.id === scenario.id)
  if (!current) return null

  const stepIdx = Math.min(scenario.step, current.steps.length - 1)
  const step = current.steps[stepIdx]
  const isLast = stepIdx >= current.steps.length - 1

  const goNext = () => {
    if (isLast) {
      setScenario(null)
      toast.success("Scenario complete", {
        description: "Nice walkthrough — reset anytime from Demo Mode.",
      })
      return
    }
    scenarioNext()
    navigate(current.steps[stepIdx + 1].view)
  }

  const goBack = () => {
    if (stepIdx <= 0) return
    setScenario(current.id, stepIdx - 1)
    navigate(current.steps[stepIdx - 1].view)
  }

  const jumpTo = (i: number) => {
    setScenario(current.id, i)
    navigate(current.steps[i].view)
  }

  return (
    <div
      role="complementary"
      aria-label="Demo guide"
      className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm animate-in fade-in slide-in-from-bottom-2 rounded-xl border bg-card shadow-xl duration-300"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="text-lg" aria-hidden>
          {current.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{current.title}</p>
          <p className="text-xs text-muted-foreground">
            Step {stepIdx + 1} of {current.steps.length}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={guideOpen ? "Collapse guide" : "Expand guide"}
          onClick={() => setGuideOpen(!guideOpen)}
        >
          {guideOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Exit scenario"
          onClick={() => setScenario(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body (collapsible) */}
      {guideOpen ? (
        <div className="space-y-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{step.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.hint}</p>
          </div>

          <Badge variant="outline" className="gap-1 border-teal-200 bg-teal-50 text-teal-700">
            <MapPin className="h-3 w-3" /> {statusLabel(step.view)} view
          </Badge>

          {/* Step dots */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Scenario steps">
            {current.steps.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === stepIdx}
                aria-label={`Step ${i + 1}: ${s.label}`}
                onClick={() => jumpTo(i)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  i === stepIdx
                    ? "bg-teal-600 text-white"
                    : i < stepIdx
                      ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {stepIdx > 0 ? (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              className={cn(
                "bg-teal-600 text-white hover:bg-teal-700",
                isLast && "bg-emerald-600 hover:bg-emerald-700"
              )}
              onClick={goNext}
            >
              {isLast ? "Finish scenario" : "Next step"}
              {isLast ? null : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
