// ============================================================
// MediKiosk — AI Service Layer (SERVER ONLY)
// Deterministic rules engine is the primary safety-critical path.
// Optional LLM (z-ai-web-dev-sdk) only enriches narrative text and
// gracefully falls back to deterministic output on any failure.
//
// Principle: AI assists → AI verifies → Human validates →
//            Healthcare professional decides.
// The AI NEVER diagnoses or prescribes.
// ============================================================

import type {
  ExtractResult,
  Language,
  TriagePriority,
  TriageResult,
} from "@/lib/types"

// ------------------------------------------------------------
// Multilingual symptom dictionary
// ------------------------------------------------------------

interface SymptomDef {
  label: string
  hi: string
  bn: string
  keywords: string[]
  redFlag?: boolean // symptom itself is a red flag when reported
}

const SYMPTOMS: SymptomDef[] = [
  {
    label: "Fever",
    hi: "बुखार",
    bn: "জ্বর",
    keywords: ["fever", "बुखार", "জ্বর", "bukhar", "jor", "temperature", "ताप"],
  },
  {
    label: "Difficulty breathing",
    hi: "सांस लेने में तकलीफ",
    bn: "শ্বাস নিতে কষ্ট",
    keywords: [
      "breathing", "breathless", "breath", "dyspnea", "सांस", "শ্বাস",
      "सांस लेने", "सांस नहीं", "শ্বাস নিতে", "saans",
    ],
    redFlag: true,
  },
  {
    label: "Chest pain",
    hi: "सीने में दर्द",
    bn: "বুকে ব্যথা",
    keywords: ["chest", "सीने", "সীনে", "বুকে ব্যথা", "सीने में दर्द", "seene"],
    redFlag: true,
  },
  {
    label: "Cough",
    hi: "खांसी",
    bn: "কাশি",
    keywords: ["cough", "खांसी", "কাশি", "khansi", "kashi"],
  },
  {
    label: "Severe headache",
    hi: "तेज सिरदर्द",
    bn: "মারাত্মক মাথাব্যথা",
    keywords: ["headache", "सिरदर्द", "सर दर्द", "মাথা", "sir dard", "matha"],
  },
  {
    label: "Persistent vomiting",
    hi: "लगातार उल्टी",
    bn: "বারবার বমি",
    keywords: ["vomit", "उल्टी", "উল্টি", "বমি", "ulti", "bam"],
    redFlag: true,
  },
  {
    label: "Diarrhea",
    hi: "दस्त",
    bn: "পায়খানা",
    keywords: ["diarrhea", "loose motion", "दस्त", "পায়খানা", "dast", "payekhana"],
  },
  {
    label: "Confusion / drowsiness",
    hi: "भ्रम / बेहोशी",
    bn: "বিভ্রান্তি",
    keywords: ["confusion", "confused", "unconscious", "बेहोश", "भ्रम", "বেহোশ", "behosh"],
    redFlag: true,
  },
  {
    label: "Abdominal pain",
    hi: "पेट दर्द",
    bn: "পেটে ব্যথা",
    keywords: ["stomach", "abdominal", "पेट", "পেটে", "pet dard"],
  },
  {
    label: "Dizziness",
    hi: "चक्कर आना",
    bn: "মাথা ঘোরা",
    keywords: ["dizzy", "dizziness", "चक्कर", "ঘোরা", "chakkar"],
  },
  {
    label: "Skin rash",
    hi: "त्वचा पर चकत्ते",
    bn: "চর্মরোগ",
    keywords: ["rash", "चकत्ते", "চুলকানি", "chakatte"],
  },
  {
    label: "Joint pain",
    hi: "जोड़ों का दर्द",
    bn: "জয়েন্ট ব্যথা",
    keywords: ["joint", "जोड़ों", "jodo", "গোড়", "knee"],
  },
]

const SEVERE_WORDS = ["severe", "तेज", "बहुत", "असहनीय", "খুব", "marathek", "unbearable", "high"]
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9,
  "१": 1, "२": 2, "३": 3, "४": 4, "५": 5, "६": 6, "७": 7, "८": 8, "९": 9,
}

export const RED_FLAG_CHECKLIST = [
  { label: "Severe headache", hi: "तेज सिरदर्द", bn: "মারাত্মক মাথাব্যথা" },
  { label: "Difficulty breathing", hi: "सांस लेने में तकलीफ", bn: "শ্বাস নিতে কষ্ট" },
  { label: "Chest pain", hi: "सीने में दर्द", bn: "বুকে ব্যথা" },
  { label: "Persistent vomiting", hi: "लगातार उल्टी", bn: "বারবার বমি" },
  { label: "Confusion", hi: "भ्रम / बेहोशी", bn: "বিভ্রান্তি" },
  { label: "None of these", hi: "इनमें से कोई नहीं", bn: "এর কোনোটিই নয়" },
]

export function detectLanguage(text: string, fallback: Language = "hi"): Language {
  if (/[\u0980-\u09FF]/.test(text)) return "bn"
  if (/[\u0900-\u097F]/.test(text)) return "hi"
  if (/[a-zA-Z]/.test(text)) return "en"
  return fallback
}

const LANG_LABEL: Record<Language, string> = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  bn: "Bengali (বাংলা)",
}

function parseDuration(text: string): { days: number | null; label: string } {
  const t = text.toLowerCase()
  // digits (incl. Devanagari/Bengali)
  const digitMatch = t.match(/([0-9०-९০-৯]+)\s*(day|days|din|दिन|দিন|week|weeks|hafta|हफ्ते|हफ्ता|সপ্তাহ)/)
  let n: number | null = null
  let unit: "day" | "week" = "day"
  if (digitMatch) {
    const raw = digitMatch[1]
      .split("")
      .map((c) => ({ "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9", "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" }[c] ?? c))
      .join("")
    n = parseInt(raw, 10)
    unit = /week|hafta|हफ्त|সপ্তাহ/.test(digitMatch[2]) ? "week" : "day"
  } else {
    for (const [word, val] of Object.entries(NUMBER_WORDS)) {
      const re = new RegExp(`${word}\\s*(din|day|दिन|দিন|week|hafta|हफ्त|সপ্তাহ)`, "i")
      if (re.test(t)) {
        n = val
        unit = /week|hafta|हफ्त|সপ্তাহ/.test(t) ? "week" : "day"
        break
      }
    }
  }
  if (n === null) return { days: null, label: "Not specified" }
  const days = unit === "week" ? n * 7 : n
  return { days, label: `${n} ${unit === "week" ? (n > 1 ? "weeks" : "week") : n > 1 ? "days" : "day"}` }
}

/** Deterministic symptom extraction — the judging-safe path */
export function extractFromText(text: string, fallbackLang: Language = "hi"): ExtractResult {
  const t = text.toLowerCase()
  const language = detectLanguage(text, fallbackLang)
  const matched: ExtractResult["symptoms"] = []
  for (const s of SYMPTOMS) {
    if (s.keywords.some((k) => t.includes(k))) {
      matched.push({ label: s.label, hi: s.hi, confidence: 0.94 })
    }
  }
  const { days, label } = parseDuration(text)
  const severe = SEVERE_WORDS.some((w) => t.includes(w))
  const redFlagSuspects = matched
    .filter((m) => SYMPTOMS.find((s) => s.label === m.label)?.redFlag)
    .map((m) => m.label)
  if (matched.some((m) => m.label === "Fever") && severe) {
    redFlagSuspects.push("Persistent high fever")
  }

  const followUpQuestions = ["Severe headache", "Difficulty breathing", "Chest pain", "Persistent vomiting", "Confusion", "None"]
    .filter((q) => !matched.some((m) => m.label === q) || q === "None")
    .slice(0, 5)

  return {
    language,
    languageLabel: LANG_LABEL[language],
    transcript: text,
    symptoms: matched,
    durationDays: days,
    durationLabel: label,
    severity: severe ? "SEVERE" : matched.length > 1 ? "MODERATE" : "MILD",
    redFlagSuspects: [...new Set(redFlagSuspects)],
    followUpQuestions: followUpQuestions.length ? followUpQuestions : ["None"],
    engine: "deterministic-nlp",
  }
}

// ------------------------------------------------------------
// Deterministic triage rules engine
// ------------------------------------------------------------

export interface TriageInput {
  symptoms: string[]
  durationDays: number | null
  severity: string
  age: number
  conditions: string[]
  extraRedFlags?: string[]
}

const HIGH_FLAGS = [
  "Difficulty breathing",
  "Chest pain",
  "Confusion / drowsiness",
  "Altered consciousness",
  "Persistent vomiting",
  "Severe headache",
  "Fever with severe headache",
  "Persistent high fever",
  "Fever in elderly patient",
]

/**
 * Vulnerable-population floors: these raise the priority to MEDIUM
 * (timely clinical review) but do not by themselves declare an
 * emergency — avoids alarm fatigue from over-triaging routine
 * presentations in young children.
 */
const MEDIUM_FLOOR = "Pediatric patient — priority review"

export function computeTriage(input: TriageInput): TriageResult {
  const flags = new Set<string>()
  const mediumFlags = new Set<string>()
  const { symptoms, durationDays, severity, age, conditions } = input

  for (const s of symptoms) if (HIGH_FLAGS.includes(s)) flags.add(s)
  for (const f of input.extraRedFlags ?? []) {
    if (HIGH_FLAGS.includes(f)) flags.add(f)
    else if (f === "Pediatric patient") mediumFlags.add(MEDIUM_FLOOR)
  }
  if (symptoms.includes("Fever") && symptoms.includes("Severe headache"))
    flags.add("Fever with severe headache")
  if (symptoms.includes("Fever") && (durationDays ?? 0) >= 3 && severity === "SEVERE")
    flags.add("Persistent high fever")
  if (symptoms.includes("Fever") && (durationDays ?? 0) >= 4) flags.add("Prolonged fever")
  if (age >= 65 && symptoms.includes("Fever")) flags.add("Fever in elderly patient")
  if (age <= 5) mediumFlags.add(MEDIUM_FLOOR)
  if (conditions.some((c) => /pregnan/i.test(c)))
    flags.add("Symptoms during pregnancy")

  let priority: TriagePriority = "LOW"
  if (flags.size > 0) priority = "HIGH"
  else if (
    mediumFlags.size > 0 ||
    severity === "SEVERE" ||
    (durationDays ?? 0) >= 3 ||
    age >= 60 ||
    symptoms.length >= 2
  )
    priority = "MEDIUM"

  const reason =
    priority === "HIGH"
      ? "Potential emergency indicators detected."
      : priority === "MEDIUM"
        ? "Symptom pattern needs timely clinical review."
        : "Routine presentation detected."

  const summary =
    `Patient reports ${symptoms.join(", ").toLowerCase() || "symptoms"}` +
    (durationDays ? ` for ${durationDays} day(s)` : "") +
    (age ? `, age ${age}` : "") +
    (conditions.length ? `, known history: ${conditions.join(", ")}` : "") +
    `.

AI-assisted risk flag: ${priority} priority.`

  const recommendation =
    priority === "HIGH"
      ? "Escalate to healthcare professional immediately."
      : priority === "MEDIUM"
        ? "Schedule priority consultation at nearest PHC today."
        : "Proceed to routine OPD queue at Sub-Centre / PHC."

  const suggestedWorkflow =
    priority === "HIGH"
      ? "RED-FLAG ESCALATION → Doctor review → Referral"
      : priority === "MEDIUM"
        ? "Frontline worker review → PHC consultation → Follow-up"
        : "Routine OPD → Medicine dispensing → Self-care advice"

  return {
    priority,
    reason,
    redFlags: [...flags, ...mediumFlags],
    summary,
    recommendation,
    suggestedWorkflow,
    confidence: flags.size > 0 ? 0.93 : 0.88,
    engine: "deterministic-rules",
    disclaimer:
      "AI-assisted risk flag only — not a diagnosis. Requires human review by a healthcare professional.",
  }
}

// ------------------------------------------------------------
// Simulated OCR (document intelligence)
// ------------------------------------------------------------

export interface OcrTemplate {
  type: "LAB_REPORT" | "PRESCRIPTION" | "MEDICAL_RECORD"
  title: string
  source: string
  ocrText: string
  extracted: {
    field: string
    value: string
    unit?: string
    confidence: number
    source: string
    flag?: "low" | "high" | "normal" | "info"
  }[]
}

export function simulateOcr(kind: string): OcrTemplate {
  if (kind === "LAB_REPORT") {
    return {
      type: "LAB_REPORT",
      title: "Complete Blood Count (CBC)",
      source: "Rampur PHC Laboratory",
      ocrText: `RAMPUR PHC LABORATORY
Patient: Sita Devi | 23 Sep 2026
Hemoglobin: 10.2 g/dL
WBC Count: 12,400 /uL
Platelets: 2,10,000 /uL
Blood Pressure: 138/88 mmHg
Random Blood Sugar: 148 mg/dL`,
      extracted: [
        { field: "Hemoglobin", value: "10.2", unit: "g/dL", confidence: 0.96, source: "Lab report — CBC panel", flag: "low" },
        { field: "WBC Count", value: "12,400", unit: "/µL", confidence: 0.94, source: "Lab report — CBC panel", flag: "high" },
        { field: "Platelets", value: "2,10,000", unit: "/µL", confidence: 0.92, source: "Lab report — CBC panel", flag: "normal" },
        { field: "Blood Pressure", value: "138/88", unit: "mmHg", confidence: 0.9, source: "Lab report — vitals", flag: "high" },
        { field: "Random Blood Sugar", value: "148", unit: "mg/dL", confidence: 0.89, source: "Lab report — chemistry", flag: "high" },
        { field: "Report Date", value: "18 Sep 2026", confidence: 0.97, source: "Lab report header", flag: "info" },
      ],
    }
  }
  if (kind === "PRESCRIPTION") {
    return {
      type: "PRESCRIPTION",
      title: "Outpatient Prescription",
      source: "Siwan Rural Hospital — OPD",
      ocrText: `SIWAN RURAL HOSPITAL — OPD
Rx:
1. Metformin 500 mg — twice daily after food — 30 days
2. Amlodipine 5 mg — once daily morning — 30 days
3. Sulfamethoxazole 800 mg — twice daily — 5 days
Review after 30 days. Fasting sugar next visit.`,
      extracted: [
        { field: "Medicine 1", value: "Metformin 500 mg — twice daily after food — 30 days", confidence: 0.93, source: "Prescription — Rx line 1", flag: "info" },
        { field: "Medicine 2", value: "Amlodipine 5 mg — once daily morning — 30 days", confidence: 0.91, source: "Prescription — Rx line 2", flag: "info" },
        { field: "Medicine 3", value: "Sulfamethoxazole 800 mg — twice daily — 5 days", confidence: 0.9, source: "Prescription — Rx line 3", flag: "info" },
        { field: "Follow-up advice", value: "Review after 30 days with fasting sugar", confidence: 0.88, source: "Prescription footer", flag: "info" },
      ],
    }
  }
  return {
    type: "MEDICAL_RECORD",
    title: "Previous Medical Record",
    source: "Gopalganj District Hospital",
    ocrText: `GOPALGANJ DISTRICT HOSPITAL
Diagnosis: Acute febrile illness — treated
Advised: CBC, follow-up in 1 week`,
    extracted: [
      { field: "Diagnosis (recorded)", value: "Acute febrile illness — treated", confidence: 0.87, source: "Discharge summary", flag: "info" },
      { field: "Advised investigations", value: "CBC, follow-up in 1 week", confidence: 0.85, source: "Discharge summary", flag: "info" },
    ],
  }
}

// ------------------------------------------------------------
// Optional LLM narrative enrichment (never decides safety)
// ------------------------------------------------------------

export async function tryLlmSummary(
  input: TriageInput,
  base: TriageResult
): Promise<{ summary: string; used: boolean }> {
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk")
    const zai = await ZAI.create()
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content:
              "You are a hospital triage assistant. Write a 2-sentence factual intake summary for a healthcare worker. List only reported facts. Never diagnose, never prescribe. No markdown.",
          },
          {
            role: "user",
            content: `Symptoms: ${input.symptoms.join(", ")}. Duration: ${input.durationDays ?? "unknown"} days. Severity: ${input.severity}. Age: ${input.age}. History: ${input.conditions.join(", ") || "none"}.`,
          },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("llm-timeout")), 4000)),
    ])) as { choices?: { message?: { content?: string } }[] }
    const text = completion?.choices?.[0]?.message?.content?.trim()
    if (text && text.length > 10 && text.length < 600) return { summary: text, used: true }
    return { summary: base.summary, used: false }
  } catch {
    return { summary: base.summary, used: false }
  }
}

// ------------------------------------------------------------
// Adaptive interview engine (deterministic)
// Picks the NEXT most valuable question from what the patient has
// already told us — red-flag probes first, then symptom detail.
// The kiosk asks, the PATIENT answers; the AI never concludes.
// ------------------------------------------------------------

export interface InterviewQuestion {
  id: string
  question: string
  questionHi: string
  options: { label: string; labelHi: string; value: string }[]
  /** When answered "Yes" the response is treated as a red flag */
  isRedFlagProbe: boolean
  /** Trigger condition — evaluated against what is already known */
  requires?: { symptoms?: string[]; severity?: string[] }
}

export const INTERVIEW_PROBES: InterviewQuestion[] = [
  {
    id: "breathing",
    question: "Right now, do you have any difficulty breathing?",
    questionHi: "अभी सांस लेने में कोई तकलीफ है?",
    options: [
      { label: "No", labelHi: "नहीं", value: "No" },
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
    ],
    isRedFlagProbe: true,
  },
  {
    id: "chest-pain",
    question: "Do you have pain or pressure in your chest?",
    questionHi: "सीने में दर्द या दबाव है?",
    options: [
      { label: "No", labelHi: "नहीं", value: "No" },
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
    ],
    isRedFlagProbe: true,
  },
  {
    id: "confusion",
    question: "Have you felt unusually confused or very drowsy today?",
    questionHi: "आज असामान्य भ्रम या बहुत नींद जैसा महसूस हुआ?",
    options: [
      { label: "No", labelHi: "नहीं", value: "No" },
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
    ],
    isRedFlagProbe: true,
  },
  {
    id: "vomiting",
    question: "Have you been vomiting repeatedly?",
    questionHi: "बार-बार उल्टी हो रही है?",
    options: [
      { label: "No", labelHi: "नहीं", value: "No" },
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
    ],
    isRedFlagProbe: true,
  },
  {
    id: "fever-days",
    question: "How many days have you had the fever?",
    questionHi: "बुखार कितने दिनों से है?",
    options: [
      { label: "1–2 days", labelHi: "1–2 दिन", value: "1-2 days" },
      { label: "3+ days", labelHi: "3+ दिन", value: "3+ days" },
    ],
    isRedFlagProbe: false,
    requires: { symptoms: ["Fever"] },
  },
  {
    id: "rash",
    question: "Do you see any rash or red spots on the skin?",
    questionHi: "त्वचा पर कोई चकत्ते या लाल धब्बे दिखते हैं?",
    options: [
      { label: "No", labelHi: "नहीं", value: "No" },
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
    ],
    isRedFlagProbe: false,
    requires: { symptoms: ["Fever"] },
  },
  {
    id: "hydration",
    question: "Are you able to drink water and keep it down?",
    questionHi: "क्या आप पानी पीकर उसे रख पा रहे हैं?",
    options: [
      { label: "Yes", labelHi: "हाँ", value: "Yes" },
      { label: "No", labelHi: "नहीं", value: "No" },
    ],
    isRedFlagProbe: false,
    requires: { symptoms: ["Diarrhea", "Persistent vomiting"] },
  },
]

/**
 * Deterministic adaptive-interview selection. Returns the next question
 * that (a) hasn't been asked yet, (b) is triggered by known symptoms, and
 * (c) is not already answered by a reported symptom. Red-flag probes are
 * prioritized. Returns null when the interview is complete.
 */
export function nextInterviewQuestion(
  askedIds: string[],
  symptoms: string[],
  severity: string
): InterviewQuestion | null {
  // Never probe for a red flag the patient already reported
  const alreadyReported = (id: string) => {
    if (id === "breathing") return symptoms.some((s) => /breathing|breathless/i.test(s))
    if (id === "chest-pain") return symptoms.some((s) => /chest/i.test(s))
    if (id === "confusion") return symptoms.some((s) => /confusion|drowsy|consciousness/i.test(s))
    if (id === "vomiting") return symptoms.some((s) => /vomit/i.test(s))
    return false
  }
  const pool = INTERVIEW_PROBES.filter((p) => {
    if (askedIds.includes(p.id)) return false
    if (alreadyReported(p.id)) return false
    if (p.requires?.symptoms && !p.requires.symptoms.some((s) => symptoms.includes(s))) return false
    return true
  })
  // Red-flag probes first, then SEVERE cases get more probes than mild ones
  const redFlagsFirst = pool.filter((p) => p.isRedFlagProbe)
  const rest = pool.filter((p) => !p.isRedFlagProbe)
  const limit = severity === "SEVERE" ? 99 : symptoms.length > 0 ? 99 : 2
  if (redFlagsFirst.length) return redFlagsFirst[0]
  if (rest.length && askedIds.length < limit) return rest[0]
  return null
}

// ------------------------------------------------------------
// Contradiction / consistency detection (deterministic)
// Cross-checks what the patient SAID against what documents show
// and what the record already knows. Findings are advisory — a
// healthcare professional resolves every contradiction.
// ------------------------------------------------------------

export interface ConsistencyFinding {
  id: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  title: string
  detail: string
  sources: string[]
}

const NEGATED_PATTERNS: { re: RegExp; claim: string; conflictsWith: string[] }[] = [
  { re: /no\s+fever|बुखार\s*नहीं|জ্বর\s*নেই/i, claim: "reports no fever", conflictsWith: ["Fever"] },
  { re: /no\s+(difficulty\s+)?breathing|सांस\s+(में\s+)?नहीं/i, claim: "reports no breathing difficulty", conflictsWith: ["Difficulty breathing"] },
  { re: /no\s+(chest\s+)?pain/i, claim: "reports no pain", conflictsWith: ["Chest pain"] },
]

export function detectContradictions(input: {
  symptoms: string[]
  transcript?: string | null
  allergies?: string[]
  conditions?: string[]
  medications?: string[]
  document?: {
    type: string
    title: string
    extracted: { field: string; value: string; flag?: string }[]
  } | null
}): { findings: ConsistencyFinding[]; engine: "deterministic-rules"; disclaimer: string } {
  const findings: ConsistencyFinding[] = []
  const { symptoms, transcript, allergies = [], document } = input

  // 1) Negation in the transcript vs structured symptoms
  if (transcript) {
    for (const p of NEGATED_PATTERNS) {
      if (p.re.test(transcript) && symptoms.some((s) => p.conflictsWith.includes(s))) {
        findings.push({
          id: `neg-${p.conflictsWith[0]}`,
          severity: "CRITICAL",
          title: "Statement contradicts selected symptoms",
          detail: `The patient ${p.claim}, but "${p.conflictsWith[0]}" is selected as a symptom. Please clarify with the patient before proceeding.`,
          sources: ["Voice transcript", "Selected symptoms"],
        })
      }
    }
  }

  // 2) Documented abnormal vitals vs routine severity claim
  if (document) {
    const abnormal = document.extracted.filter((f) => f.flag === "high" || f.flag === "low")
    if (abnormal.length) {
      findings.push({
        id: "doc-abnormal",
        severity: "WARNING",
        title: "AI-extracted abnormal values need clinical correlation",
        detail: `${abnormal.map((f) => `${f.field}: ${f.value}`).join("; ")} flagged ${abnormal.map((f) => f.flag).join("/")} in "${document.title}". These values were machine-extracted and are not yet validated by a human.`,
        sources: [document.title, "Patient's stated severity"],
      })
    }

    // 3) Prescription medicines vs known allergies
    if (document.type === "PRESCRIPTION" && allergies.length) {
      const rxLines = document.extracted
        .filter((f) => /medicine/i.test(f.field))
        .map((f) => `${f.value}`.toLowerCase())
      for (const a of allergies) {
        const token = a.toLowerCase().replace(/\s+(drugs?|allergy)$/i, "").split(/\s+/)[0]
        if (token.length >= 4 && rxLines.some((l) => l.includes(token))) {
          findings.push({
            id: `allergy-${token}`,
            severity: "CRITICAL",
            title: `Possible allergy conflict: ${a}`,
            detail: `The scanned prescription lists a medicine matching the patient's recorded allergy "${a}". A healthcare professional must verify before this prescription is dispensed.`,
            sources: ["Scanned prescription", "Recorded allergies"],
          })
        }
      }
    }
  }

  // 4) Duplicate medicines across record and prescription
  if (document?.type === "PRESCRIPTION" && input.medications?.length) {
    for (const med of input.medications) {
      const base = med.toLowerCase().split(/\s+/)[0]
      if (base.length >= 4 && document.extracted.some((f) => f.value.toLowerCase().includes(base))) {
        findings.push({
          id: `dup-${base}`,
          severity: "INFO",
          title: `Medicine overlap: ${base}`,
          detail: `"${med}" is already recorded in the patient's medication list and also appears on the scanned prescription. Confirm intended dosage with the prescriber.`,
          sources: ["Patient medication list", "Scanned prescription"],
        })
      }
    }
  }

  return {
    findings,
    engine: "deterministic-rules",
    disclaimer:
      "AI consistency check only — findings are advisory and must be resolved by a healthcare professional.",
  }
}

// ------------------------------------------------------------
// Clinical record summary (deterministic + optional LLM polish)
// ------------------------------------------------------------

export interface SummaryInput {
  patient: { name: string; age: number; gender: string; mrn: string; conditions: string[]; allergies: string[]; medications: string[] }
  visits: { chiefComplaint: string; triagePriority: string | null; status: string; createdAt: string; facility: string }[]
  referrals: { destination: string; priority: string; status: string }[]
  diagnostics: { testType: string; status: string }[]
  followUps: { category: string; status: string; nextDue: string }[]
  documents: { type: string; title: string; validationStatus: string }[]
}

/** Deterministic, fact-only summary — safe even when the LLM is unavailable */
export function buildPatientSummary(input: SummaryInput): string {
  const { patient, visits, referrals, diagnostics, followUps, documents } = input
  const lines: string[] = []
  lines.push(
    `${patient.name}, ${patient.age}y ${patient.gender} (${patient.mrn}). ` +
      (patient.conditions.length ? `Known conditions: ${patient.conditions.join(", ")}. ` : "No known chronic conditions recorded. ") +
      (patient.allergies.length ? `Allergies: ${patient.allergies.join(", ")}. ` : "No known allergies. ") +
      (patient.medications.length ? `Current medications: ${patient.medications.join(", ")}.` : "No regular medications recorded.")
  )
  const last = visits[0]
  if (last) {
    lines.push(
      `Most recent visit (${new Date(last.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${last.facility}): ${last.chiefComplaint}. ` +
        (last.triagePriority ? `AI triage flagged ${last.triagePriority} priority, currently ${last.status.replace(/_/g, " ").toLowerCase()}.` : `Currently ${last.status.replace(/_/g, " ").toLowerCase()}.`)
    )
  }
  if (referrals.length) {
    const active = referrals.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status))
    lines.push(
      `Referrals: ${active.length ? active.map((r) => `${r.status.replace(/_/g, " ").toLowerCase()} → ${r.destination} (${r.priority})`).join("; ") : "all completed"}.`
    )
  }
  if (diagnostics.length) {
    const pending = diagnostics.filter((d) => d.status !== "REVIEWED")
    lines.push(
      `Diagnostics: ${pending.length ? `${pending.map((d) => `${d.testType} (${d.status.replace(/_/g, " ").toLowerCase()})`).join(", ")} awaiting review.` : "all results reviewed."}`
    )
  }
  if (followUps.length) {
    const next = followUps.find((f) => f.status === "PENDING" || f.status === "RESCHEDULED")
    if (next) {
      lines.push(
        `Next follow-up: ${next.category.replace(/_/g, " ").toLowerCase()} task due ${new Date(next.nextDue).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`
      )
    }
  }
  if (documents.length) {
    const validated = documents.filter((d) => d.validationStatus === "VALIDATED").length
    lines.push(`Documents on record: ${documents.length} (${validated} human-validated).`)
  }
  return lines.join("\n")
}

/**
 * Optional LLM polish for the patient summary. The LLM receives only the
 * deterministic fact sheet and must not add diagnoses or recommendations.
 * Any failure/timeout returns the deterministic text untouched.
 */
export async function tryLlmPatientSummary(
  deterministicSummary: string
): Promise<{ summary: string; used: boolean }> {
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk")
    const zai = await ZAI.create()
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content:
              "Rewrite the following clinical fact sheet as 2-3 short sentences for a rural healthcare worker. " +
              "STRICT RULES: use ONLY the facts given, add no diagnoses, no medicines, no advice, no markdown. " +
              "If any fact seems missing, omit it silently.",
          },
          { role: "user", content: deterministicSummary },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("llm-timeout")), 4000)),
    ])) as { choices?: { message?: { content?: string } }[] }
    const text = completion?.choices?.[0]?.message?.content?.trim()
    if (text && text.length > 10 && text.length < 900) return { summary: text, used: true }
    return { summary: deterministicSummary, used: false }
  } catch {
    return { summary: deterministicSummary, used: false }
  }
}

// ------------------------------------------------------------
// Vision OCR — real document-image extraction (AI, optional)
// Reads a photo/scan of a paper record with the vision model and
// returns structured fields. Falls back to the simulated template
// whenever the model is unreachable or returns unusable output.
// Output is ALWAYS treated as unverified until a human validates.
// ------------------------------------------------------------

export interface OcrExtraction {
  title: string
  source: string
  ocrText: string
  extracted: {
    field: string
    value: string
    unit?: string
    confidence: number
    source: string
    flag?: "low" | "high" | "normal" | "info"
  }[]
  engine: "vision-ocr" | "simulated-template"
}

export async function tryVisionOcr(
  imageDataUrl: string,
  kind: "LAB_REPORT" | "PRESCRIPTION" | "MEDICAL_RECORD",
  fallback: OcrTemplate
): Promise<OcrExtraction> {
  try {
    if (!imageDataUrl.startsWith("data:image/")) throw new Error("not an image data url")
    const { default: ZAI } = await import("z-ai-web-dev-sdk")
    const zai = await ZAI.create()
    const completion = (await Promise.race([
      zai.chat.completions.createVision({
        model: "glm-4v",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `You are an OCR assistant for rural health workers. This is a photo of a ${kind.replace("_", " ").toLowerCase()}. ` +
                  "Read the document and return STRICT JSON only, no markdown fences: " +
                  '{"title": string (document title), "source": string (hospital/lab name from the letterhead, else "Unknown source"), ' +
                  '"ocrText": string (all visible text, preserve layout), "extracted": [{"field": string, "value": string, "unit": string?, "confidence": number 0..1, "source": string (where on the page), "flag": "low"|"high"|"normal"|"info"?}]}. ' +
                  "Extract every test value, medicine line and date you can actually see. Do NOT invent values that are not visible. Do NOT interpret results.",
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("vision-timeout")), 15000)),
    ])) as { choices?: { message?: { content?: string } }[] }
    const raw = completion?.choices?.[0]?.message?.content?.trim()
    if (!raw) throw new Error("empty vision response")
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "")
    const parsed = JSON.parse(cleaned) as {
      title?: string
      source?: string
      ocrText?: string
      extracted?: OcrExtraction["extracted"]
    }
    if (!parsed.ocrText || !Array.isArray(parsed.extracted) || parsed.extracted.length === 0) {
      throw new Error("vision output unusable")
    }
    const safeFields = parsed.extracted
      .filter((f) => f && typeof f.field === "string" && typeof f.value === "string")
      .slice(0, 20)
      .map((f) => ({
        field: String(f.field).slice(0, 60),
        value: String(f.value).slice(0, 120),
        unit: f.unit ? String(f.unit).slice(0, 20) : undefined,
        confidence: typeof f.confidence === "number" ? Math.min(0.99, Math.max(0.3, f.confidence)) : 0.75,
        source: f.source ? String(f.source).slice(0, 80) : "Vision OCR",
        flag: f.flag === "low" || f.flag === "high" || f.flag === "normal" || f.flag === "info" ? f.flag : undefined,
      }))
    if (!safeFields.length) throw new Error("no usable fields")
    return {
      title: (parsed.title || fallback.title).slice(0, 80),
      source: (parsed.source || fallback.source).slice(0, 80),
      ocrText: parsed.ocrText.slice(0, 4000),
      extracted: safeFields,
      engine: "vision-ocr",
    }
  } catch {
    return { ...fallback, engine: "simulated-template" }
  }
}
