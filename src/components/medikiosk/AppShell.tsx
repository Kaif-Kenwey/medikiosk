"use client"

// ============================================================
// MediKiosk — App Shell: header (role, language, search, offline,
// demo, accessibility) + sticky footer with medical disclaimer.
// ============================================================

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { getQueue } from "@/lib/api-client"
import { makeT, LANGUAGES } from "@/lib/i18n"
import type { Role, View } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  HeartPulse,
  Search,
  Languages,
  ShieldCheck,
  Gamepad2,
  RotateCcw,
  Accessibility,
  Wifi,
  WifiOff,
  RefreshCw,
  Menu,
  Stethoscope,
  User,
  Building2,
  CloudUpload,
  Loader2,
  LayoutGrid,
  ClipboardList,
  Bot,
  Siren,
  FileText,
  FolderOpen,
  Ambulance,
  FlaskConical,
  Pill,
  BellRing,
  Network,
  ScrollText,
  KeyRound,
  LogOut,
} from "lucide-react"

const ROLE_OPTIONS: { value: Role; label: string; icon: React.ReactNode }[] = [
  { value: "kiosk", label: "Kiosk · Patient", icon: <User className="h-4 w-4" /> },
  { value: "frontline", label: "Frontline Worker (ANM/ASHA)", icon: <HeartPulse className="h-4 w-4" /> },
  { value: "doctor", label: "Doctor (Dr. A. Prasad)", icon: <Stethoscope className="h-4 w-4" /> },
  { value: "admin", label: "Facility Administrator", icon: <Building2 className="h-4 w-4" /> },
]

export function AppHeader() {
  const {
    role,
    setRole,
    session,
    ensureSession,
    openAuthDialog,
    signOut,
    language,
    setLanguage,
    navigate,
    view,
    isOffline,
    toggleOffline,
    syncNow,
    syncing,
    resetDemo,
    setSearchOpen,
    textScale,
    setTextScale,
    highContrast,
    toggleContrast,
    audioGuide,
    toggleAudioGuide,
    activePatientId,
  } = useAppStore()
  const t = makeT(language)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const update = () => setPending(getQueue().length)
    const t0 = setTimeout(update, 250)
    const iv = setInterval(update, 1200)
    return () => {
      clearTimeout(t0)
      clearInterval(iv)
    }
  }, [view, isOffline])

  // Command palette shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setSearchOpen])

  // Re-check the JWT session whenever the browser regains focus
  // (cheap, catches 8h expiry and cookie clears without a reload)
  useEffect(() => {
    const onFocus = () => void ensureSession()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [ensureSession])

  const goRoleHome = (r: Role) => {
    if (session?.role === r) {
      setRole(r)
    } else if (r === "kiosk") {
      // Kiosk role needs no credentials — restore the device session
      void useAppStore.getState().signIn("kiosk")
    } else {
      // Elevated roles require a facility PIN (RBAC)
      openAuthDialog(r)
      return
    }
    if (r === "kiosk") navigate("kiosk")
    else if (r === "frontline") navigate("intake")
    else if (r === "doctor") navigate("doctor")
    else navigate("facility")
    setRole(r)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <button
          onClick={() => navigate("kiosk")}
          className="flex items-center gap-2 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-teal-600"
          aria-label="MediKiosk home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-base font-bold tracking-tight text-foreground">MediKiosk</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-teal-700">
              Rural Health · Continuity
            </span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Global search */}
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 gap-2 text-muted-foreground xl:flex xl:w-64 xl:justify-start"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left text-sm">{t("searchPatients")}</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

          {/* Modules */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-1.5" aria-label="Modules">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden text-sm md:inline">Modules</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>All modules</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { v: "kiosk" as View, label: "Kiosk home", icon: <HeartPulse className="h-4 w-4" /> },
                { v: "intake" as View, label: "Patient intake", icon: <ClipboardList className="h-4 w-4" /> },
                { v: "triage" as View, label: "AI triage", icon: <Bot className="h-4 w-4" /> },
                { v: "emergency" as View, label: "Red-flag console", icon: <Siren className="h-4 w-4" /> },
                { v: "documents" as View, label: "Document intelligence", icon: <FileText className="h-4 w-4" /> },
                { v: "validation" as View, label: "Human validation", icon: <ShieldCheck className="h-4 w-4" /> },
                { v: "record" as View, label: "Patient record", icon: <FolderOpen className="h-4 w-4" /> },
                { v: "referrals" as View, label: "Referrals", icon: <Ambulance className="h-4 w-4" /> },
                { v: "diagnostics" as View, label: "Diagnostics", icon: <FlaskConical className="h-4 w-4" /> },
                { v: "medicines" as View, label: "Medicine availability", icon: <Pill className="h-4 w-4" /> },
                { v: "followups" as View, label: "Follow-ups", icon: <BellRing className="h-4 w-4" /> },
                { v: "doctor" as View, label: "Doctor dashboard", icon: <Stethoscope className="h-4 w-4" /> },
                { v: "facility" as View, label: "Facility dashboard", icon: <Building2 className="h-4 w-4" /> },
                { v: "network" as View, label: "Care network map", icon: <Network className="h-4 w-4" /> },
                { v: "audit" as View, label: "Audit trail", icon: <ScrollText className="h-4 w-4" /> },
                { v: "demo" as View, label: "Demo mode", icon: <Gamepad2 className="h-4 w-4" /> },
              ].map((item) => (
                <DropdownMenuItem key={item.v} onClick={() => navigate(item.v)} className="gap-2">
                  {item.icon}
                  {item.label}
                  {view === item.v && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-600" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-1.5" aria-label={t("language")}>
                <Languages className="h-4 w-4" />
                <span className="hidden text-sm sm:inline">
                  {LANGUAGES.find((l) => l.code === language)?.native}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("selectLanguage")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={language === l.code ? "bg-teal-50 font-medium text-teal-800" : ""}
                >
                  {l.native} · {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connection / offline */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 gap-1.5 ${isOffline ? "border-amber-300 bg-amber-50" : ""}`}
                aria-label={isOffline ? t("offline") : t("online")}
              >
                {isOffline ? (
                  <WifiOff className="h-4 w-4 text-amber-600" />
                ) : (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                )}
                <span className="hidden text-sm lg:inline">{isOffline ? t("offline") : t("online")}</span>
                {pending > 0 && (
                  <Badge className="h-5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{pending}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isOffline ? "bg-amber-500" : "bg-emerald-500"}`} />
                {isOffline ? "Offline mode — changes queue locally" : "Connected to facility server"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <Label htmlFor="offline-switch" className="text-sm">
                  {t("simulateOffline")}
                </Label>
                <Switch id="offline-switch" checked={isOffline} onCheckedChange={toggleOffline} />
              </div>
              {pending > 0 && (
                <DropdownMenuItem onClick={() => syncNow()} disabled={syncing} className="gap-2 font-medium text-teal-700">
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                  {syncing ? "Syncing…" : `${t("syncNow")} (${pending})`}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Accessibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("accessibility")}>
                <Accessibility className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>{t("accessibility")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("textSize")}</DropdownMenuLabel>
              <div className="flex gap-1 px-2 pb-2">
                {(["normal", "large", "xl"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setTextScale(s)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                      textScale === s ? "border-teal-600 bg-teal-50 text-teal-800" : "text-muted-foreground"
                    }`}
                  >
                    {s === "normal" ? "A" : s === "large" ? "A+" : "A++"}
                  </button>
                ))}
              </div>
              <DropdownMenuItem onClick={toggleAudioGuide} className="gap-2">
                <span className={`h-2 w-2 rounded-full ${audioGuide ? "bg-teal-600" : "bg-gray-300"}`} />
                {t("audioGuide")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleContrast} className="gap-2">
                <span className={`h-2 w-2 rounded-full ${highContrast ? "bg-teal-600" : "bg-gray-300"}`} />
                {t("highContrast")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Demo mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-1.5" aria-label={t("demoMode")}>
                <Gamepad2 className="h-4 w-4" />
                <span className="hidden text-sm sm:inline">{t("demoMode")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Demo controls</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("demo")} className="gap-2">
                <Gamepad2 className="h-4 w-4" /> Guided scenarios
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="gap-2 text-red-700 focus:text-red-700"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <RotateCcw className="h-4 w-4" /> {t("resetDemo")}
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset demo environment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This restores the seeded demo dataset and returns to the kiosk home screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resetDemo()} className="bg-red-600 hover:bg-red-700">
                      Reset demo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Role switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" aria-label="Switch role">
                <Menu className="h-4 w-4" />
                <span className="hidden max-w-28 text-sm lg:inline">
                  {ROLE_OPTIONS.find((r) => r.value === role)?.label.split(" (")[0]}
                </span>
                {session && (
                  <span
                    className={`h-2 w-2 rounded-full ${session.role === "kiosk" ? "bg-teal-500" : "bg-emerald-500"}`}
                    title={`Signed in as ${session.name}`}
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span>Session (JWT · RBAC)</span>
                {session && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                    {session.role === "kiosk" ? "KIOSK" : session.role.toUpperCase()}
                  </span>
                )}
              </DropdownMenuLabel>
              {session && (
                <div className="px-2 pb-1.5 text-xs text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{session.name}</span>
                  {session.role !== "kiosk" && " — actions are attributed in the audit trail"}
                </div>
              )}
              <DropdownMenuSeparator />
              {ROLE_OPTIONS.map((r) => (
                <DropdownMenuItem
                  key={r.value}
                  onClick={() => goRoleHome(r.value)}
                  className={`gap-2 ${role === r.value ? "bg-teal-50 font-medium text-teal-800" : ""}`}
                >
                  {r.icon}
                  {r.label}
                  {session?.role === r.value && (
                    <span className="ml-auto text-[10px] font-semibold text-emerald-600">✓ signed in</span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openAuthDialog(null)} className="gap-2">
                <KeyRound className="h-4 w-4" /> Sign in as staff…
              </DropdownMenuItem>
              {session && session.role !== "kiosk" && (
                <DropdownMenuItem onClick={() => void signOut()} className="gap-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  navigate("record")
                }}
                disabled={!activePatientId}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" /> Open active patient record
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("audit")} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Audit trail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Offline / pending sync strip */}
      {(isOffline || pending > 0) && (
        <div
          className={`flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium ${
            isOffline ? "bg-amber-50 text-amber-800 border-t border-amber-200" : "bg-teal-50 text-teal-800 border-t border-teal-200"
          }`}
          role="status"
        >
          {isOffline ? (
            <>
              <WifiOff className="h-3.5 w-3.5" /> Offline mode — data is saved on this device.
              {pending > 0 && <span>· {pending} record{pending === 1 ? "" : "s"} waiting to sync.</span>}
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5" /> Back online — {pending} record{pending === 1 ? "" : "s"} waiting to sync.
            </>
          )}
          {pending > 0 && (
            <button
              onClick={() => syncNow()}
              disabled={syncing}
              className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-0.5 text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
              {syncing ? "Syncing…" : `${t("syncNow")}`}
            </button>
          )}
        </div>
      )}
    </header>
  )
}

export function AppFooter() {
  const { language, navigate } = useAppStore()
  const t = makeT(language)
  return (
    <footer className="mt-auto border-t bg-muted/40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-800">
            <ShieldCheck className="h-4 w-4" /> {t("principle")}
          </p>
          <p className="max-w-xl text-xs text-muted-foreground">
            {t("disclaimer")} · Hackathon prototype by <span className="font-medium text-foreground">Team Void Reapers</span> ·
            Smart India Hackathon 2026 · <button onClick={() => navigate("demo")} className="underline hover:text-foreground">Demo Mode</button>
          </p>
        </div>
      </div>
    </footer>
  )
}
