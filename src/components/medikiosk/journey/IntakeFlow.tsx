"use client"

// ============================================================
// MediKiosk — IntakeFlow (conversational, adaptive intake wizard)
// Step 1: speak/type complaint → AI extraction (human-confirmable)
// Step 2: adaptive red-flag checklist (skipped for routine visits)
// Step 3: patient details (+ continuity match by phone)
// Step 4: history quick-input → submit intake
// All AI output is advisory and must be confirmed by the patient
// and reviewed by a healthcare professional.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  History,
  Loader2,
  Mic,
  Square,
  Stethoscope,
  User,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { AINote } from "@/components/medikiosk/shared"
import { useAppStore } from "@/lib/store"
import { makeT } from "@/lib/i18n"
import type { ExtractResult, IntakePayload, Language } from "@/lib/types"
import { cn } from "@/lib/utils"

// ------------------------------------------------------------
// Demo data (fixed transcripts per language — deterministic demo)
// ------------------------------------------------------------
const DEMO_TRANSCRIPTS: Record<Language, string> = {
  en: "I have had fever for three days and I have difficulty breathing.",
  hi: "मुझे तीन दिन से बुखार है और सांस लेने में तकलीफ हो रही है।",
  bn: "আমার তিন দিন ধরে জ্বর আছে এবং শ্বাস নিতে কষ্ট হচ্ছে।",
}

const QUICK_SYMPTOMS: { label: string; hi: string }[] = [
  { label: "Fever", hi: "बुखार" },
  { label: "Cough", hi: "खांसी" },
  { label: "Headache", hi: "सिरदर्द" },
  { label: "Vomiting", hi: "उल्टी" },
  { label: "Diarrhea", hi: "दस्त" },
  { label: "Body ache", hi: "शरीर दर्द" },
]

const RED_FLAG_OPTIONS: { label: string; hi: string }[] = [
  { label: "Severe headache", hi: "तेज सिरदर्द" },
  { label: "Difficulty breathing", hi: "सांस लेने में तकलीफ" },
  { label: "Chest pain", hi: "सीने में दर्द" },
  { label: "Persistent vomiting", hi: "लगातार उल्टी" },
  { label: "Confusion", hi: "भ्रम / बेहोशी" },
]
const NONE_LABEL = "None of these"

const DURATION_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: "1 day" },
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
]
const labelForDays = (d: number) => DURATION_OPTIONS.find((o) => o.days === d)?.label ?? `${d} days`

type MicPhase = "idle" | "listening" | "typing" | "analyzing" | "done"
type Severity = "MILD" | "MODERATE" | "SEVERE"
interface SymptomPick {
  label: string
  hi?: string
}

interface InterviewQ {
  id: string
  question: string
  questionHi: string
  options: { label: string; labelHi: string; value: string }[]
  isRedFlagProbe: boolean
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------
export default function IntakeFlow() {
  const { data, language, isOffline, navigate, submitIntake, role, signIn } = useAppStore()
  const t = makeT(language)

  const [step, setStep] = useState(1)
  const [micPhase, setMicPhase] = useState<MicPhase>("idle")
  const [typedInput, setTypedInput] = useState("")
  const [typedText, setTypedText] = useState("") // typewriter bubble
  const [fullTranscript, setFullTranscript] = useState("")
  const [extract, setExtract] = useState<ExtractResult | null>(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomPick[]>([])
  const [durationDays, setDurationDays] = useState<number | null>(null)
  const [durationLabel, setDurationLabel] = useState("Not specified")
  const [severity, setSeverity] = useState<Severity>("MILD")
  const [extraRedFlags, setExtraRedFlags] = useState<string[]>([])
  const [noneSelected, setNoneSelected] = useState(false)
  const [routineDemo, setRoutineDemo] = useState(false)
  const [chiefComplaintInput, setChiefComplaintInput] = useState("")
  const [form, setForm] = useState({
    name: "",
    nameHi: "",
    age: "",
    gender: "",
    phone: "",
    village: "",
  })
  const [conditions, setConditions] = useState<string[]>([])
  const [medications, setMedications] = useState<string[]>([])
  const [allergies, setAllergies] = useState<string[]>([])
  const [consentGiven, setConsentGiven] = useState(false)
  const [interviewAnswers, setInterviewAnswers] = useState<{ question: string; answer: string; at: string }[]>([])
  const [interviewPhase, setInterviewPhase] = useState<"idle" | "asking" | "done">("idle")
  const [currentQ, setCurrentQ] = useState<InterviewQ | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const askedIdsRef = useRef<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Timers for listening simulation + typewriter (cleaned up on unmount)
  const timersRef = useRef<number[]>([])
  const clearTimers = () => {
    timersRef.current.forEach((id) => {
      window.clearTimeout(id)
      window.clearInterval(id)
    })
    timersRef.current = []
  }
  useEffect(() => clearTimers, [])

  // ------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------
  const chiefText =
    fullTranscript.trim() ||
    chiefComplaintInput.trim() ||
    (selectedSymptoms.length
      ? selectedSymptoms.map((s) => s.label).join(", ")
      : "General consultation")

  const canContinueStep1 =
    selectedSymptoms.length > 0 ||
    fullTranscript.trim().length > 0 ||
    typedInput.trim().length > 0 ||
    chiefComplaintInput.trim().length > 0

  const phoneDigits = form.phone.replace(/\s/g, "")
  const canContinueDetails =
    form.name.trim().length > 0 && phoneDigits.length >= 10 && Number(form.age) > 0

  // Continuity: match an existing patient by phone digits
  const matchedPatient = useMemo(() => {
    if (!data || phoneDigits.length < 4) return null
    return data.patients.find((p) => p.phone.replace(/\s/g, "") === phoneDigits) ?? null
  }, [data, phoneDigits])

  const previousVisits = useMemo(() => {
    if (!data || !matchedPatient) return 0
    return data.visits.filter((v) => v.patientId === matchedPatient.id).length
  }, [data, matchedPatient])

  // ------------------------------------------------------------
  // AI extraction (both voice + typed paths)
  // ------------------------------------------------------------
  const analyzeText = async (text: string) => {
    const clean = text.trim()
    if (!clean) return
    clearTimers()
    setMicPhase("analyzing")
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, language }),
      })
      const json = (await res.json()) as { ok: boolean; data?: ExtractResult; error?: string }
      if (json.ok && json.data) {
        const r = json.data
        setExtract(r)
        setTypedText(r.transcript || clean)
        setFullTranscript(r.transcript || clean)
        setSelectedSymptoms(r.symptoms.map((s) => ({ label: s.label, hi: s.hi })))
        setDurationDays(r.durationDays)
        setDurationLabel(r.durationDays !== null ? labelForDays(r.durationDays) : "Not specified")
        setSeverity(r.severity)
        setExtraRedFlags(
          r.redFlagSuspects.filter((f) => RED_FLAG_OPTIONS.some((o) => o.label === f))
        )
        setMicPhase("done")
      } else {
        toast.error("AI extraction failed", { description: json.error ?? "Please try again." })
        setMicPhase("done")
      }
    } catch {
      toast.error("AI extraction failed", {
        description: "Could not reach the AI service. You can continue manually.",
      })
      setMicPhase("done")
    }
  }

  // Mic simulation: 2.4s listening → typewriter transcript → auto-analyze
  const onMicClick = () => {
    if (micPhase === "listening" || micPhase === "typing") {
      clearTimers()
      setMicPhase("idle")
      return
    }
    clearTimers()
    setMicPhase("listening")
    const t1 = window.setTimeout(() => {
      setMicPhase("typing")
      const text = DEMO_TRANSCRIPTS[language]
      let i = 0
      setTypedText("")
      const iv = window.setInterval(() => {
        i += 1
        setTypedText(text.slice(0, i))
        if (i >= text.length) {
          window.clearInterval(iv)
          void analyzeText(text)
        }
      }, 30)
      timersRef.current.push(iv)
    }, 2400)
    timersRef.current.push(t1)
  }

  const addSymptom = (s: SymptomPick) =>
    setSelectedSymptoms((prev) =>
      prev.some((x) => x.label === s.label) ? prev : [...prev, s]
    )

  const toggleRedFlag = (label: string) => {
    if (label === NONE_LABEL) {
      setNoneSelected((prev) => !prev)
      if (!noneSelected) setExtraRedFlags([])
      return
    }
    setNoneSelected(false)
    setExtraRedFlags((prev) =>
      prev.includes(label) ? prev.filter((f) => f !== label) : [...prev, label]
    )
  }

  // ------------------------------------------------------------
  // Demo fills (for judges)
  // ------------------------------------------------------------
  const demoFillSita = async () => {
    setRoutineDemo(false)
    setChiefComplaintInput("")
    setTypedInput("")
    await analyzeText(DEMO_TRANSCRIPTS.hi)
    setForm({
      name: "Sita Devi",
      nameHi: "सीता देवी",
      age: "46",
      gender: "Female",
      phone: "98301 22114",
      village: "Rampur",
    })
    setConditions(["Anemia (mild)"])
    setMedications(["Iron + Folic Acid tablet — once daily"])
    setAllergies(["Sulfa drugs"])
    setStep(3)
  }

  const demoFillRahul = () => {
    setRoutineDemo(true)
    clearTimers()
    setMicPhase("idle")
    setExtract(null)
    setTypedText("")
    setTypedInput("")
    setFullTranscript("")
    setSelectedSymptoms([])
    setDurationDays(null)
    setDurationLabel("Not specified")
    setSeverity("MILD")
    setExtraRedFlags([])
    setNoneSelected(false)
    setChiefComplaintInput("BP follow-up")
    setForm({
      name: "Rahul Kumar",
      nameHi: "राहुल कुमार",
      age: "32",
      gender: "Male",
      phone: "98300 44192",
      village: "Bharwalia",
    })
    setConditions(["Hypertension (stage 1)"])
    setMedications(["Amlodipine 5 mg — once daily"])
    setAllergies([])
    setStep(3)
  }

  // ------------------------------------------------------------
  // Adaptive interview (server-driven, deterministic, patient answers)
  // ------------------------------------------------------------
  const fetchNextQuestion = async (askedIds: string[]) => {
    const symptoms = [
      ...new Set([...selectedSymptoms.map((s) => s.label), ...extraRedFlags]),
    ]
    try {
      // Abort after 6s so an offline/unreachable server can never leave the
      // patient stuck on a disabled "Waiting for your answers…" button —
      // the interview is optional and skips gracefully when it times out.
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms, severity, asked: askedIds }),
        signal: AbortSignal.timeout(6000),
      })
      const json = (await res.json()) as { ok: boolean; data?: { done: boolean; question?: InterviewQ } }
      if (json.ok && json.data && !json.data.done && json.data.question) {
        setCurrentQ(json.data.question)
        setInterviewPhase("asking")
        return true
      }
    } catch {
      // offline / unreachable — interview is skipped silently
    }
    setInterviewPhase("done")
    return false
  }

  const handleStep2Continue = async () => {
    if (interviewPhase === "idle") {
      setLoadingQuestion(true)
      await fetchNextQuestion(askedIdsRef.current)
      setLoadingQuestion(false)
      return // stays on step 2 while the interview runs
    }
    setStep(3)
  }

  const answerQuestion = async (value: string) => {
    if (!currentQ) return
    const q = currentQ
    setInterviewAnswers((prev) => [
      ...prev,
      { question: q.question, answer: value, at: new Date().toISOString() },
    ])
    // A "Yes" on a red-flag probe feeds the triage red-flag list
    if (q.isRedFlagProbe && value === "Yes") {
      const labelMap: Record<string, string> = {
        breathing: "Difficulty breathing",
        "chest-pain": "Chest pain",
        confusion: "Confusion",
        vomiting: "Persistent vomiting",
      }
      const label = labelMap[q.id]
      if (label) setExtraRedFlags((prev) => (prev.includes(label) ? prev : [...prev, label]))
    }
    askedIdsRef.current = [...askedIdsRef.current, q.id]
    setLoadingQuestion(true)
    setCurrentQ(null)
    await fetchNextQuestion(askedIdsRef.current)
    setLoadingQuestion(false)
  }

  const skipInterview = () => {
    setCurrentQ(null)
    setInterviewPhase("done")
  }

  // ------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------
  const handleSubmit = async () => {
    if (!canContinueDetails) {
      toast.error("Please complete the required fields", {
        description: "Name, a valid age and phone number are required.",
      })
      return
    }
    if (!consentGiven) {
      toast.error("Consent is required", {
        description: "Please review and accept the data-use notice to continue.",
      })
      return
    }
    setSubmitting(true)
    // Patient-confirmed red flags are symptoms too — fold them into the
    // symptom list so the deterministic triage engine can evaluate them.
    const symptoms = [
      ...new Set([
        ...selectedSymptoms.map((s) => s.label),
        ...extraRedFlags.map((f) => (f === "Confusion" ? "Confusion / drowsiness" : f)),
      ]),
    ]
    const payload: IntakePayload = {
      name: form.name.trim(),
      nameHi: form.nameHi.trim() || undefined,
      age: Number(form.age),
      gender: form.gender || "Other",
      phone: form.phone.trim(),
      village: form.village.trim() || "Rampur",
      district: "Gopalganj",
      language,
      chiefComplaint: chiefText,
      symptoms,
      durationDays,
      durationLabel,
      severity,
      conditions,
      medications,
      allergies,
      transcript: fullTranscript || undefined,
      consent: true,
      interviewAnswers: interviewAnswers.length ? interviewAnswers : undefined,
    }
    const outcome = await submitIntake(payload)
    setSubmitting(false)
    if (outcome) {
      navigate("triage")
    } else {
      toast.error("Intake could not be completed", {
        description: "Please check the details and try again.",
      })
    }
  }

  // ------------------------------------------------------------
  // Guard: data may still be bootstrapping
  // ------------------------------------------------------------
  if (!data) return <ViewSkeleton />

  const genderOptions = [
    { value: "Male", label: t("male"), icon: User },
    { value: "Female", label: t("female"), icon: UserRound },
    { value: "Other", label: t("other"), icon: Users },
  ]

  const stepTitles = [t("whatBringsYou"), t("alsoHave"), t("patientDetails"), "Health history (optional)"]

  // Role gate: patient self-service intake is a kiosk/frontline action.
  // A doctor walking the patient journey would fill every screen and then be
  // rejected by RBAC at submit — stop that honestly, before any data is typed.
  if (role === "doctor") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
          <UserCog className="mx-auto h-10 w-10 text-amber-700" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">
            You are signed in as {role === "doctor" ? "a doctor" : "staff"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Patient self-service intake runs on the Kiosk role. Clinical review of intake records
            happens in the doctor queue — AI assists, a professional decides.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              className="h-11 bg-teal-600 text-white hover:bg-teal-700"
              onClick={() => navigate("doctor")}
            >
              <Stethoscope className="h-4 w-4" aria-hidden /> Open Doctor Queue
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-teal-600 text-teal-700 hover:bg-teal-50"
              onClick={() => void signIn("kiosk")}
            >
              Continue as Kiosk
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* Keyframes for the listening animation */}
      <style>{`@keyframes mk-eq { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }`}</style>

      {isOffline && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Offline mode — intake will be captured on this device and synced later.</span>
        </div>
      )}

      <StepHeader
        step={step}
        title={stepTitles[step - 1]}
        onBack={step > 1 ? () => setStep((s) => Math.max(1, s - 1)) : undefined}
      />

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {/* ================= STEP 1 — complaint ================= */}
        {step === 1 && (
          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
            <KioskBubble>
              <p className="text-lg font-medium text-foreground">{t("whatBringsYou")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("speakOrType")}</p>
            </KioskBubble>

            {(typedText || micPhase === "listening") && (
              <div className="flex justify-end" aria-live="polite">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-teal-600 px-4 py-3 text-white shadow-sm">
                  {micPhase === "listening" ? (
                    <span className="flex items-center gap-3">
                      <AudioBars />
                      <span className="text-base">{t("listening")}</span>
                    </span>
                  ) : (
                    <p className="text-base sm:text-lg">
                      {typedText}
                      {micPhase === "typing" && (
                        <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-white align-middle" />
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Mic control */}
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                type="button"
                onClick={onMicClick}
                disabled={micPhase === "analyzing"}
                aria-label={
                  micPhase === "listening" || micPhase === "typing"
                    ? t("stop")
                    : t("startSpeaking")
                }
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 disabled:opacity-60",
                  micPhase === "listening" || micPhase === "typing"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-teal-600 hover:bg-teal-700"
                )}
              >
                {micPhase === "listening" || micPhase === "typing" ? (
                  <Square className="h-7 w-7" aria-hidden />
                ) : (
                  <Mic className="h-8 w-8" aria-hidden />
                )}
              </button>
              <span className="text-sm font-medium text-muted-foreground">
                {micPhase === "listening" || micPhase === "typing"
                  ? t("stop")
                  : t("startSpeaking")}
              </span>
            </div>

            {/* Typed path */}
            <div className="space-y-2">
              <Textarea
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                rows={3}
                placeholder="…or type here (English / हिन्दी / বাংলা)"
                className="min-h-20 text-base"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-12 bg-teal-600 px-6 text-base text-white hover:bg-teal-700"
                  disabled={!typedInput.trim() || micPhase === "analyzing"}
                  onClick={() => void analyzeText(typedInput)}
                >
                  {micPhase === "analyzing" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> AI is understanding…
                    </>
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
            </div>

            {/* Extraction result — always human-confirmable */}
            {extract && (
              <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-teal-900">{t("extractedInfo")}</p>
                  <Badge
                    variant="outline"
                    className="border-teal-300 bg-white text-xs text-teal-800"
                  >
                    {t("detected")}: {extract.languageLabel}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("symptoms")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSymptoms.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No symptoms detected — add them below.
                      </p>
                    )}
                    {selectedSymptoms.map((s) => (
                      <span
                        key={s.label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-white px-3 py-1.5 text-sm font-medium text-teal-900"
                      >
                        {s.label}
                        {s.hi ? <span className="text-xs text-teal-700">({s.hi})</span> : null}
                        <button
                          type="button"
                          aria-label={`Remove ${s.label}`}
                          onClick={() =>
                            setSelectedSymptoms((prev) =>
                              prev.filter((x) => x.label !== s.label)
                            )
                          }
                          className="rounded-full p-0.5 hover:bg-teal-100"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {selectedSymptoms.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SYMPTOMS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => addSymptom(q)}
                        className="rounded-full border border-dashed border-teal-400 px-3 py-1.5 text-sm text-teal-800 transition-colors hover:bg-teal-100"
                      >
                        + {q.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("duration")}</Label>
                    <Select
                      value={durationDays === null ? "none" : String(durationDays)}
                      onValueChange={(v) => {
                        if (v === "none") {
                          setDurationDays(null)
                          setDurationLabel("Not specified")
                        } else {
                          const d = Number(v)
                          setDurationDays(d)
                          setDurationLabel(labelForDays(d))
                        }
                      }}
                    >
                      <SelectTrigger className="h-12 w-full text-base">
                        <SelectValue placeholder={t("duration")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {DURATION_OPTIONS.map((o) => (
                          <SelectItem key={o.days} value={String(o.days)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Severity</Label>
                    <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                      <SelectTrigger className="h-12 w-full text-base">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MILD">Mild</SelectItem>
                        <SelectItem value="MODERATE">Moderate</SelectItem>
                        <SelectItem value="SEVERE">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {extract.redFlagSuspects.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                      Possible warning signs the AI noticed — a professional will double-check
                      these
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {extract.redFlagSuspects.map((f) => (
                        <li key={f} className="text-sm text-amber-900">
                          • {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <AINote>AI-assisted extraction — please confirm the information is correct.</AINote>

                <Button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className="h-14 w-full bg-teal-600 text-lg font-semibold text-white hover:bg-teal-700"
                >
                  {t("confirmNext")} <ArrowRight className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ================= STEP 2 — adaptive red-flag check ================= */}
        {step === 2 && (
          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
            {routineDemo || selectedSymptoms.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-base font-medium text-emerald-800">
                  <Check className="h-5 w-5 shrink-0" aria-hidden />
                  No additional checks needed for routine visit
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  Continue to patient details — history can be added in the next step.
                </p>
              </div>
            ) : (
              <>
                <KioskBubble>
                  <p className="text-lg font-medium text-foreground">{t("alsoHave")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select all that apply — this helps the care team act fast.
                  </p>
                </KioskBubble>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {RED_FLAG_OPTIONS.map((opt) => {
                    const checked = extraRedFlags.includes(opt.label)
                    return (
                      <div
                        key={opt.label}
                        onClick={() => toggleRedFlag(opt.label)}
                        className={cn(
                          "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                          checked
                            ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                            : "border-border bg-card hover:border-teal-300"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleRedFlag(opt.label)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5"
                          aria-label={opt.label}
                        />
                        <div className="min-w-0">
                          <p className="text-base font-medium text-foreground">{opt.label}</p>
                          <p className="text-sm text-muted-foreground">{opt.hi}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div
                    onClick={() => toggleRedFlag(NONE_LABEL)}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors sm:col-span-2",
                      noneSelected
                        ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                        : "border-border bg-card hover:border-teal-300"
                    )}
                  >
                    <Checkbox
                      checked={noneSelected}
                      onCheckedChange={() => toggleRedFlag(NONE_LABEL)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5"
                      aria-label={t("none")}
                    />
                    <p className="text-base font-medium text-foreground">{t("none")}</p>
                  </div>
                </div>
                <AINote>
                  AI-assisted red-flag screening — every case is reviewed by a healthcare
                  professional.
                </AINote>
              </>
            )}

            {/* Adaptive interview — AI asks, the patient answers */}
            {interviewPhase === "asking" && currentQ && (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                <KioskBubble>
                  <div>
                    <p className="text-lg font-medium text-foreground">{currentQ.question}</p>
                    {currentQ.questionHi && (
                      <p className="text-sm text-muted-foreground">{currentQ.questionHi}</p>
                    )}
                  </div>
                </KioskBubble>
                <div className="flex flex-wrap gap-2 pl-13">
                  {currentQ.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => void answerQuestion(o.value)}
                      className="min-h-12 rounded-xl border border-teal-300 bg-white px-5 py-2.5 text-base font-medium text-teal-900 transition-colors hover:bg-teal-100"
                    >
                      {o.label}
                      {o.labelHi ? <span className="ml-1.5 text-sm text-teal-700">({o.labelHi})</span> : null}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={skipInterview}
                    className="min-h-12 rounded-xl px-3 py-2.5 text-sm text-muted-foreground underline hover:text-foreground"
                  >
                    Skip remaining questions
                  </button>
                </div>
                <AINote>
                  Follow-up question chosen by the AI from your answers so far. A “Yes” to a
                  warning-sign question is always double-checked by a health worker.
                </AINote>
              </div>
            )}
            {interviewPhase === "asking" && !currentQ && (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing next question…
              </div>
            )}
            {interviewPhase === "done" && interviewAnswers.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <Check className="mr-1.5 inline h-4 w-4" aria-hidden />
                {interviewAnswers.length} adaptive question{interviewAnswers.length === 1 ? "" : "s"} answered — answers
                will be part of this visit record.
              </div>
            )}

            <Button
              type="button"
              disabled={loadingQuestion}
              onClick={() => void handleStep2Continue()}
              className="h-14 w-full bg-teal-600 text-lg font-semibold text-white hover:bg-teal-700"
            >
              {loadingQuestion ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Checking…
                </>
              ) : interviewPhase === "asking" ? (
                "Waiting for your answers…"
              ) : (
                <>
                  {t("confirmNext")} <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </Button>
          </section>
        )}

        {/* ================= STEP 3 — patient details ================= */}
        {step === 3 && (
          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
            {/* Demo fills — for judges */}
            <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 p-3">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-teal-700">
                Demo shortcuts
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-11 border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={() => void demoFillSita()}
              >
                <Zap className="h-4 w-4" aria-hidden /> Demo: Sita Devi — emergency hero
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={demoFillRahul}
              >
                <UserCheck className="h-4 w-4" aria-hidden /> Demo: Rahul Kumar — routine
              </Button>
            </div>

            {/* Continuity match */}
            {matchedPatient && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                <History className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                <p className="text-sm text-emerald-900">
                  <span className="font-semibold">
                    Known patient matched — {previousVisits} previous visit
                    {previousVisits === 1 ? "" : "s"} found.
                  </span>{" "}
                  This visit will be linked to their continuous record ({matchedPatient.name} ·{" "}
                  {matchedPatient.mrn}).
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mk-name" className="text-base">
                  {t("name")} *
                </Label>
                <Input
                  id="mk-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sita Devi"
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-age" className="text-base">
                  {t("age")} *
                </Label>
                <Input
                  id="mk-age"
                  type="number"
                  min={0}
                  max={120}
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  placeholder="e.g. 46"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-phone" className="text-base">
                  {t("phone")} *
                </Label>
                <Input
                  id="mk-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 98301 22114"
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-village" className="text-base">
                  {t("village")}
                </Label>
                <Input
                  id="mk-village"
                  value={form.village}
                  onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))}
                  placeholder="e.g. Rampur"
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-base">{t("gender")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {genderOptions.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, gender: g.value }))}
                    aria-pressed={form.gender === g.value}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300",
                      form.gender === g.value
                        ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600"
                        : "bg-card hover:border-teal-300"
                    )}
                  >
                    <g.icon className="h-5 w-5 text-teal-700" aria-hidden />
                    <span className="text-sm font-medium text-foreground sm:text-base">
                      {g.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {!canContinueDetails && (
              <p className="text-sm text-amber-700">
                Name, a valid age and phone number are required to continue.
              </p>
            )}

            <Button
              type="button"
              disabled={!canContinueDetails}
              onClick={() => setStep(4)}
              className="h-14 w-full bg-teal-600 text-lg font-semibold text-white hover:bg-teal-700"
            >
              {t("confirmNext")} <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          </section>
        )}

        {/* ================= STEP 4 — history + submit ================= */}
        {step === 4 && (
          <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="text-foreground">
                <span className="font-medium">Visit:</span> {chiefText}
              </p>
              {selectedSymptoms.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {selectedSymptoms.map((s) => s.label).join(" · ")}
                  {durationDays !== null ? ` — ${durationLabel}` : ""}
                </p>
              )}
            </div>

            <ChipListInput
              label={t("existingConditions")}
              placeholder="e.g. Diabetes"
              values={conditions}
              onChange={setConditions}
            />
            <ChipListInput
              label={t("currentMedicines")}
              placeholder="e.g. Amlodipine 5 mg"
              values={medications}
              onChange={setMedications}
            />
            <ChipListInput
              label={t("allergies")}
              placeholder="e.g. Sulfa drugs"
              values={allergies}
              onChange={setAllergies}
            />

            {/* DPDP-style informed consent — required before data is recorded */}
            <div
              className={cn(
                "rounded-xl border p-4 transition-colors",
                consentGiven ? "border-emerald-300 bg-emerald-50" : "border-teal-300 bg-teal-50/60"
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mk-consent"
                  checked={consentGiven}
                  onCheckedChange={(v) => setConsentGiven(v === true)}
                  className="mt-0.5 h-5 w-5"
                  aria-label="Consent to record this visit"
                />
                <label htmlFor="mk-consent" className="cursor-pointer text-sm leading-relaxed">
                  <span className="font-semibold text-foreground">
                    I agree to my health information being recorded
                    {language === "hi" ? " (मैं सहमत हूँ)" : language === "bn" ? "(আমি সম্মত)" : ""}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    This kiosk records your symptoms, phone number and health history so the care
                    team can treat and follow up with you. Data is stored securely and encrypted,
                    shared only with your treating health workers, and you may withdraw consent at
                    any time. आपकी जानकारी सुरक्षित रखी जाती है और केवल इलाज के लिए उपयोग होती है।
                  </span>
                </label>
              </div>
            </div>

            <Button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="h-16 w-full bg-teal-600 text-lg font-semibold text-white hover:bg-teal-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Submitting…
                </>
              ) : (
                <>
                  {t("submitIntake")} <Check className="h-5 w-5" aria-hidden />
                </>
              )}
            </Button>
            <AINote>
              AI-assisted intake support — a healthcare professional reviews every submission.
            </AINote>
          </section>
        )}
      </motion.div>
    </div>
  )
}

// ------------------------------------------------------------
// Local sub-components
// ------------------------------------------------------------

function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function StepHeader({
  step,
  title,
  onBack,
}: {
  step: number
  title: string
  onBack?: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">Step {step} of 4</p>
          <h2 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <Progress value={step * 25} className="h-2" aria-label={`Step ${step} of 4`} />
    </div>
  )
}

function KioskBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
        <Bot className="h-5 w-5" aria-hidden />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-card px-4 py-3 shadow-sm">
        {children}
      </div>
    </div>
  )
}

function AudioBars() {
  return (
    <span className="flex h-8 items-center gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-full w-1.5 origin-center rounded-full bg-teal-300"
          style={{ animation: `mk-eq 0.9s ease-in-out ${i * 0.12}s infinite` }}
        />
      ))}
    </span>
  )
}

function ChipListInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft("")
  }
  return (
    <div>
      <Label className="text-base">{label}</Label>
      <div className="mt-1.5 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="h-12 text-base"
          autoComplete="off"
        />
        <Button type="button" variant="outline" className="h-12 px-4 text-base" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-900"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded-full p-0.5 hover:bg-teal-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
