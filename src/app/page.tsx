"use client"

// ============================================================
// MediKiosk — Root application (single visible route `/`)
// Client-side view router driven by the Zustand store.
// An ErrorBoundary guarantees the user never sees a blank page:
// a rendering crash shows a recovery screen instead.
// ============================================================

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react"
import { useAppStore } from "@/lib/store"
import { AppHeader, AppFooter } from "@/components/medikiosk/AppShell"
import KioskHome from "@/components/medikiosk/journey/KioskHome"
import IntakeFlow from "@/components/medikiosk/journey/IntakeFlow"
import TriageView from "@/components/medikiosk/journey/TriageView"
import EmergencyView from "@/components/medikiosk/journey/EmergencyView"
import DocumentScanView from "@/components/medikiosk/records/DocumentScanView"
import ValidationView from "@/components/medikiosk/records/ValidationView"
import PatientRecordView from "@/components/medikiosk/records/PatientRecordView"
import GlobalSearch from "@/components/medikiosk/records/GlobalSearch"
import { ReferralsView } from "@/components/medikiosk/care/ReferralsView"
import { DiagnosticsView } from "@/components/medikiosk/care/DiagnosticsView"
import { MedicinesView } from "@/components/medikiosk/care/MedicinesView"
import { FollowUpsView } from "@/components/medikiosk/care/FollowUpsView"
import DoctorDashboard from "@/components/medikiosk/dashboards/DoctorDashboard"
import FacilityDashboard from "@/components/medikiosk/dashboards/FacilityDashboard"
import NetworkMap from "@/components/medikiosk/dashboards/NetworkMap"
import AuditLogView from "@/components/medikiosk/dashboards/AuditLogView"
import DemoModePanel from "@/components/medikiosk/dashboards/DemoModePanel"
import DemoGuide from "@/components/medikiosk/dashboards/DemoGuide"
import { Button } from "@/components/ui/button"
import { HeartPulse, RotateCcw, WifiOff } from "lucide-react"

function Splash() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-teal-600 text-white">
        <HeartPulse className="h-7 w-7" />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">MediKiosk</p>
        <p className="text-sm text-muted-foreground">Loading demo environment…</p>
      </div>
    </div>
  )
}

/** Shown when the facility server cannot be reached and no cached
 *  dataset exists on this device. Explicit recovery — never blank. */
function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <WifiOff className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">Cannot reach the facility server</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The kiosk will keep retrying automatically. Check the connection and try again —
          offline capture features resume as soon as a dataset is available.
        </p>
      </div>
      <Button className="h-11 bg-teal-600 px-6 text-white hover:bg-teal-700" onClick={onRetry}>
        <RotateCcw className="h-4 w-4" aria-hidden /> Retry connection
      </Button>
    </div>
  )
}

/** React error boundary — renders a recovery screen instead of a blank page */
class ViewErrorBoundary extends Component<
  { children: ReactNode; onHome: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in devtools; no patient data is included in the message
    console.error("MediKiosk view error:", error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <HeartPulse className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">This screen could not be displayed</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The rest of the kiosk is unaffected. Return to the kiosk home and retry — the
              demo data was not changed.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 px-5"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
            <Button
              className="h-11 bg-teal-600 px-5 text-white hover:bg-teal-700"
              onClick={() => {
                this.setState({ error: null })
                this.props.onHome()
              }}
            >
              Go to Kiosk home
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ViewRouter() {
  const view = useAppStore((s) => s.view)
  switch (view) {
    case "kiosk":
      return <KioskHome />
    case "intake":
      return <IntakeFlow />
    case "triage":
      return <TriageView />
    case "emergency":
      return <EmergencyView />
    case "documents":
      return <DocumentScanView />
    case "validation":
      return <ValidationView />
    case "record":
      return <PatientRecordView />
    case "referrals":
      return <ReferralsView />
    case "diagnostics":
      return <DiagnosticsView />
    case "medicines":
      return <MedicinesView />
    case "followups":
      return <FollowUpsView />
    case "doctor":
      return <DoctorDashboard />
    case "facility":
      return <FacilityDashboard />
    case "network":
      return <NetworkMap />
    case "audit":
      return <AuditLogView />
    case "demo":
      return <DemoModePanel />
    default:
      return <KioskHome />
  }
}

export default function Page() {
  const bootstrap = useAppStore((s) => s.bootstrap)
  const retryBootstrap = useAppStore((s) => s.retryBootstrap)
  const navigate = useAppStore((s) => s.navigate)
  const loading = useAppStore((s) => s.loading)
  const bootstrapError = useAppStore((s) => s.bootstrapError)
  const data = useAppStore((s) => s.data)
  const textScale = useAppStore((s) => s.textScale)
  const highContrast = useAppStore((s) => s.highContrast)
  const guideOpen = useAppStore((s) => s.guideOpen)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // Accessibility: text scale + high contrast via root element attributes
  useEffect(() => {
    document.documentElement.dataset.textscale = textScale
    document.documentElement.classList.toggle("hc", highContrast)
  }, [textScale, highContrast])

  return (
    <div className="flex min-h-screen flex-col bg-[#fafbfc]">
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
          {loading ? (
            <Splash />
          ) : bootstrapError || !data ? (
            <ConnectionError onRetry={() => void retryBootstrap()} />
          ) : (
            <ViewErrorBoundary onHome={() => navigate("kiosk")}>
              <ViewRouter />
            </ViewErrorBoundary>
          )}
        </div>
      </main>
      <AppFooter />
      <GlobalSearch />
      {guideOpen && <DemoGuide />}
    </div>
  )
}
