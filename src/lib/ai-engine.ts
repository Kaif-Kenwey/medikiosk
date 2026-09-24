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
Review after 30 days. Fasting sugar next visit.`,
      extracted: [
        { field: "Medicine 1", value: "Metformin 500 mg — twice daily after food — 30 days", confidence: 0.93, source: "Prescription — Rx line 1", flag: "info" },
        { field: "Medicine 2", value: "Amlodipine 5 mg — once daily morning — 30 days", confidence: 0.91, source: "Prescription — Rx line 2", flag: "info" },
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
