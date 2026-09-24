import { NextRequest, NextResponse } from "next/server"
import { seedDemoData } from "@/lib/seed"
import { getDemoData } from "@/lib/server-data"
import { guard } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Demo Mode: reset the environment to a clean, seeded state (ADMIN only) */
export async function POST(req: NextRequest) {
  const denied = guard(req, "POST")
  if (denied) return denied
  try {
    await seedDemoData()
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data, meta: { resetAt: new Date().toISOString() } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "reset failed" },
      { status: 500 }
    )
  }
}
