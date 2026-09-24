import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** GET /api/auth/session — current JWT session (or 401 when signed out). */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: "No active session" }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    meta: {
      session: {
        role: session.sub,
        name: session.name,
        facility: session.facility ?? null,
        expiresAt: new Date(session.exp * 1000).toISOString(),
      },
    },
  })
}
