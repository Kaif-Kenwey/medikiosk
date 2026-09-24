import { NextResponse } from "next/server"
import { seedDemoData } from "@/lib/seed"
import { getDemoData } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/** Demo Mode: instantly reset the environment to a clean, seeded state */
export async function POST() {
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
