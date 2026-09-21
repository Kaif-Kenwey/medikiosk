import { NextRequest, NextResponse } from "next/server"
import { extractFromText } from "@/lib/ai-engine"
import type { Language } from "@/lib/types"

export const dynamic = "force-dynamic"

/** AI-assisted speech/text understanding — deterministic NLP (demo-reliable) */
export async function POST(req: NextRequest) {
  try {
    const { text, language } = (await req.json()) as { text?: string; language?: Language }
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Empty text" }, { status: 400 })
    }
    const result = extractFromText(text, language ?? "hi")
    return NextResponse.json({ ok: true, data: result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "extract failed" },
      { status: 500 }
    )
  }
}
