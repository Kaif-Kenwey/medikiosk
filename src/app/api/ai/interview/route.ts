import { NextRequest, NextResponse } from "next/server"
import { nextInterviewQuestion } from "@/lib/ai-engine"
import { logAudit, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/**
 * POST /api/ai/interview — adaptive interview engine (deterministic).
 * Body: { symptoms: string[], severity: string, asked: string[] }
 * Returns the next highest-value question or done:true. The kiosk asks,
 * the patient answers — the AI never concludes anything by itself.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { symptoms?: string[]; severity?: string; asked?: string[] }
    const symptoms = Array.isArray(body.symptoms) ? body.symptoms : []
    const asked = Array.isArray(body.asked) ? body.asked : []
    const severity = body.severity ?? "MILD"

    const question = nextInterviewQuestion(asked, symptoms, severity)
    if (!question) {
      return NextResponse.json({ ok: true, data: { done: true } })
    }

    await logAudit({
      actor: "MediKiosk AI",
      actorRole: "AI_SERVICE",
      action: "INTERVIEW_QUESTION",
      target: question.id,
      detail: `Adaptive probe selected (${symptoms.length} symptoms known)`,
      createdAt: demoNow(),
    })

    return NextResponse.json({
      ok: true,
      data: {
        done: false,
        question: {
          id: question.id,
          question: question.question,
          questionHi: question.questionHi,
          options: question.options,
          isRedFlagProbe: question.isRedFlagProbe,
        },
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "interview failed" },
      { status: 500 }
    )
  }
}
