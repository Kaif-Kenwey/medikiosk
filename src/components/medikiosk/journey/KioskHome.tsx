"use client"

// ============================================================
// MediKiosk — KioskHome (entry screen, patient-facing kiosk mode)
// Hero + 4 big role actions + language selector + accessibility
// controls + principle banner. Large touch targets throughout.
// ============================================================

import { useEffect, useRef } from "react"
import {
  Accessibility,
  CalendarDays,
  Contrast,
  HeartPulse,
  Languages,
  LayoutDashboard,
  MapPin,
  Mic,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Type,
  UserRound,
  Volume2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { LANGUAGES, makeT } from "@/lib/i18n"
import { speak, SPEAK_LANG } from "@/lib/audio"
import { cn } from "@/lib/utils"

type TextScale = "normal" | "large" | "xl"

const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xl", label: "XL" },
]

export default function KioskHome() {
  const {
    language,
    textScale,
    highContrast,
    audioGuide,
    navigate,
    setRole,
    setLanguage,
    setTextScale,
    toggleAudioGuide,
    toggleContrast,
  } = useAppStore()

  const t = makeT(language)
  const welcomedRef = useRef(false)

  // Audio guidance: speak the welcome line once per visit to this screen.
  useEffect(() => {
    if (audioGuide && !welcomedRef.current) {
      welcomedRef.current = true
      speak(makeT(language)("startAssistance"), SPEAK_LANG[language])
    }
  }, [audioGuide, language])

  const entries = [
    {
      icon: UserRound,
      label: t("imFrontline"),
      sub: "Assisted intake, records & follow-ups",
      onClick: () => {
        setRole("frontline")
        navigate("intake")
      },
    },
    {
      icon: Stethoscope,
      label: t("doctorHospital"),
      sub: "Open the doctor queue",
      onClick: () => {
        setRole("doctor")
        navigate("doctor")
      },
    },
    {
      icon: LayoutDashboard,
      label: t("facilityDashboard"),
      sub: "Facility overview & alerts",
      onClick: () => {
        setRole("admin")
        navigate("facility")
      },
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* Hero */}
      <section className="rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white shadow-md">
            <HeartPulse className="h-9 w-9" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">MediKiosk</h1>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">{t("tagline")}</p>
          <Badge
            variant="outline"
            className="border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800"
          >
            SIH26133 · Team Void Reapers · Demo
          </Badge>
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden />
            <span>Demo session · Wednesday, 23 Sep 2026</span>
            <span aria-hidden>·</span>
            <MapPin className="h-4 w-4" aria-hidden />
            <span>Rampur Sub-Centre</span>
          </p>
        </div>
      </section>

      {/* Primary action — largest touch target */}
      <button
        type="button"
        onClick={() => {
          setRole("kiosk")
          navigate("intake")
        }}
        className="flex w-full items-center gap-4 rounded-xl bg-teal-600 p-5 text-left text-white shadow-md transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 sm:p-6"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Mic className="h-8 w-8" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-xl font-bold sm:text-2xl">{t("startAssistance")}</span>
          <span className="mt-0.5 block text-sm text-teal-50 sm:text-base">
            Speak or type in your language — AI assists, professionals decide
          </span>
        </span>
      </button>

      {/* Secondary role entries */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {entries.map((e) => (
          <button
            key={e.label}
            type="button"
            onClick={e.onClick}
            className="flex min-h-24 flex-col items-center justify-center rounded-xl border bg-card p-4 text-center shadow-sm transition-colors hover:border-teal-400 hover:bg-teal-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
          >
            <e.icon className="h-7 w-7 text-teal-700" aria-hidden />
            <span className="mt-2 block text-lg font-semibold text-foreground">{e.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{e.sub}</span>
          </button>
        ))}
      </div>

      {/* Language selector */}
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Languages className="h-5 w-5 text-teal-700" aria-hidden />
          {t("selectLanguage")}
        </p>
        <div className="mt-3 flex gap-3">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              aria-pressed={language === l.code}
              className={cn(
                "flex min-h-16 flex-1 flex-col items-center justify-center rounded-full border px-4 py-2 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300",
                language === l.code
                  ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600"
                  : "bg-card hover:border-teal-300"
              )}
            >
              <span className="text-lg font-semibold text-foreground">{l.native}</span>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Accessibility row */}
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Accessibility className="h-5 w-5 text-teal-700" aria-hidden />
          {t("accessibility")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div
              className="flex overflow-hidden rounded-lg border"
              role="group"
              aria-label={t("textSize")}
            >
              {TEXT_SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTextScale(s.value)}
                  aria-pressed={textScale === s.value}
                  className={cn(
                    "h-12 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:text-base",
                    textScale === s.value
                      ? "bg-teal-600 text-white"
                      : "bg-card text-foreground hover:bg-teal-50"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAudioGuide}
            aria-pressed={audioGuide}
            className={cn(
              "flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 sm:text-base",
              audioGuide
                ? "border-teal-600 bg-teal-600 text-white"
                : "bg-card text-foreground hover:border-teal-300"
            )}
          >
            <Volume2 className="h-5 w-5" aria-hidden />
            {t("audioGuide")}
          </button>

          <button
            type="button"
            onClick={toggleContrast}
            aria-pressed={highContrast}
            className={cn(
              "flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 sm:text-base",
              highContrast
                ? "border-teal-600 bg-teal-600 text-white"
                : "bg-card text-foreground hover:border-teal-300"
            )}
          >
            <Contrast className="h-5 w-5" aria-hidden />
            {t("highContrast")}
          </button>
        </div>
      </section>

      {/* Principle banner */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4">
        <ShieldCheck className="h-6 w-6 shrink-0 text-teal-700" aria-hidden />
        <p className="text-base font-medium text-teal-900">{t("principle")}</p>
      </div>

      {/* Judges hint */}
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
          <p className="text-sm text-muted-foreground">
            For judges: open Demo Mode from the header for guided scenarios and Reset Demo.
          </p>
        </div>
        <Button variant="outline" className="h-10 shrink-0" onClick={() => navigate("demo")}>
          Open Demo Mode
        </Button>
      </div>
    </div>
  )
}
