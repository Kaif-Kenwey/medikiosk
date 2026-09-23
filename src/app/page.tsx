"use client"

// ============================================================
// MediKiosk — Root application (single visible route `/`)
// Client-side view router driven by the Zustand store.
// ============================================================

import { useEffect } from "react"
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
import { HeartPulse } from "lucide-react"

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
  const loading = useAppStore((s) => s.loading)
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
          {loading ? <Splash /> : <ViewRouter />}
        </div>
      </main>
      <AppFooter />
      <GlobalSearch />
      {guideOpen && <DemoGuide />}
    </div>
  )
}
