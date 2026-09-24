import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { seedDemoData } from "@/lib/seed"
import { getDemoData } from "@/lib/server-data"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await db.patient.count()
    if (count === 0) await seedDemoData()
    const data = await getDemoData()
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bootstrap failed" },
      { status: 500 }
    )
  }
}
