import { NextRequest, NextResponse } from "next/server"
import { computeTriage, tryLlmSummary } from "@/lib/ai-engine"
import { logAudit, getDemoData } from "@/lib/server-data"
import type { TriageResult } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * AI-assisted triage. Priority/red-flag decisions come from the
 * deterministic rules engine; an optional LLM only rewrites the
 * narrative summary. AI never diagnoses — output is a risk flag
 * requiring human review.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      symptoms?: string[]
      durationDays?: number | null
      severity?: string
      age?: number
      conditions?: string[]
      extraRedFlags?: string[]
      patientName?: string
      patientMrn?: string
      visitId?: string
      useLlm?: boolean
    }
    const input = {
      symptoms: body.symptoms ?? [],
      durationDays: body.durationDays ?? null,
      severity: body.severity ?? "MILD",
      age: body.age ?? 30,
      conditions: body.conditions ?? [],
      extraRedFlags: body.extraRedFlags ?? [],
    }
    const triage: TriageResult = computeTriage(input)
    if (body.useLlm) {
      const llm = await tryLlmSummary(input, triage)
      // Engine label must reflect what actually produced the output:
      // if the LLM failed or timed out, the deterministic summary stands
      // and the engine stays "deterministic-rules".
      triage.summary = llm.summary
      if (llm.used) triage.engine = "llm-assisted"
    }
    if (body.patientName) {
      await logAudit({
        actor: "MediKiosk AI",
        actorRole: "AI_SERVICE",
        action: "TRIAGE_GENERATED",
        target: `${body.patientMrn ?? ""} ${body.patientName}`.trim(),
        detail: `${triage.priority} priority — ${triage.engine}`,
      })
    }
    return NextResponse.json({ ok: true, data: triage })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "triage failed" },
      { status: 500 }
    )
  }
}
