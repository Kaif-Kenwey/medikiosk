import { NextRequest, NextResponse } from "next/server"
import {
  DEMO_IDENTITIES,
  SESSION_COOKIE,
  sessionCookieOptions,
  signJwt,
} from "@/lib/auth"
import { logAudit, demoNow } from "@/lib/server-data"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/login — issue a JWT session cookie.
 * Body: { role: "kiosk" | "frontline" | "doctor" | "admin", pin?: string }
 * - kiosk: no PIN (kiosk tablets auto-authenticate as the patient-facing role)
 * - elevated roles: facility PIN required (demo PINs are shown in the sign-in UI)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { role?: string; pin?: string }
    const role = body.role

    if (role === "kiosk") {
      const token = signJwt({ sub: "kiosk", name: "Kiosk Device", facility: "Rampur Sub-Centre" })
      const res = NextResponse.json({
        ok: true,
        meta: { session: { role: "kiosk", name: "Kiosk Device" } },
      })
      res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
      return res
    }

    const identity = role ? DEMO_IDENTITIES[role as keyof typeof DEMO_IDENTITIES] : undefined
    if (!identity) {
      return NextResponse.json({ ok: false, error: "Unknown role" }, { status: 400 })
    }
    if ((body.pin ?? "").trim() !== identity.pin) {
      await logAudit({
        actor: role ?? "unknown",
        actorRole: "SYSTEM",
        action: "SESSION_LOGIN_FAILED",
        target: role ?? "unknown",
        detail: "Invalid facility PIN",
        createdAt: demoNow(),
      })
      return NextResponse.json({ ok: false, error: "Incorrect facility PIN" }, { status: 401 })
    }

    const token = signJwt({
      sub: role as "frontline" | "doctor" | "admin",
      name: identity.name,
      facility: "Rampur PHC",
    })
    const res = NextResponse.json({
      ok: true,
      meta: { session: { role, name: identity.name } },
    })
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    await logAudit({
      actor: identity.name,
      actorRole: role === "doctor" ? "DOCTOR" : role === "admin" ? "ADMIN" : "FRONTLINE",
      action: "SESSION_STARTED",
      target: `${role} session`,
      detail: "JWT session issued (HS256, httpOnly cookie, 8h)",
      createdAt: demoNow(),
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, error: "Login failed" }, { status: 500 })
  }
}
