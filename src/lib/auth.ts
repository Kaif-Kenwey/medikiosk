// ============================================================
// MediKiosk — JWT sessions + RBAC (SERVER ONLY)
// Hand-rolled HS256 JWT via node:crypto (no extra dependency),
// carried in an httpOnly cookie. Kiosk devices auto-authenticate
// in the KIOSK role; elevated roles sign in with a facility PIN.
//
//   AI assists → AI verifies → Human validates → professional decides
//   RBAC mirrors that: the kiosk captures, staff validate & decide.
// ============================================================

import crypto from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export type SessionRole = "kiosk" | "frontline" | "doctor" | "admin"

export interface SessionPayload {
  sub: SessionRole
  name: string
  facility?: string
  iat: number
  exp: number
}

export const SESSION_COOKIE = "mk_session"
const SESSION_TTL_SECONDS = 8 * 3600

/** Demo credentials — openly displayed in the sign-in dialog for the SIH demo. */
export const DEMO_IDENTITIES: Record<
  Exclude<SessionRole, "kiosk">,
  { name: string; pin: string; title: string }
> = {
  frontline: { name: "ANM Sunita Sharma", pin: "1234", title: "Frontline Worker (ANM/ASHA)" },
  doctor: { name: "Dr. A. Prasad", pin: "2345", title: "Medical Officer" },
  admin: { name: "Facility Administrator", pin: "3456", title: "Facility Administrator" },
}

function secret(): string {
  return process.env.MEDIKIOSK_SECRET || "medikiosk-sih2026-demo-secret-not-for-production"
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url")

/** Minimal HS256 JWT — header.payload.signature (base64url). */
export function signJwt(payload: Omit<SessionPayload, "iat" | "exp">, ttlSeconds = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000)
  const body: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds }
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const data = `${head}.${b64url(JSON.stringify(body))}`
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url")
  return `${data}.${sig}`
}

/** Verify signature + expiry. Returns null on any failure. */
export function verifyJwt(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [head, body, sig] = parts
  const expected = crypto.createHmac("sha256", secret()).update(`${head}.${body}`).digest()
  const given = Buffer.from(sig, "base64url")
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (!payload.sub || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  return verifyJwt(req.cookies.get(SESSION_COOKIE)?.value)
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    // Demo runs over http in the sandbox; production (https) should add secure: true.
    secure: false,
  }
}

// ------------------------------------------------------------
// RBAC — one permission matrix, enforced by every mutating route
// ------------------------------------------------------------

type Rule = { method: "POST" | "PATCH"; match: RegExp; roles: SessionRole[] }

export const ROUTE_PERMISSIONS: Rule[] = [
  { method: "POST", match: /^\/api\/intake$/, roles: ["kiosk", "frontline", "admin"] },
  { method: "PATCH", match: /^\/api\/visits$/, roles: ["frontline", "doctor", "admin"] },
  { method: "POST", match: /^\/api\/referrals$/, roles: ["frontline", "doctor", "admin"] },
  { method: "PATCH", match: /^\/api\/referrals$/, roles: ["frontline", "doctor", "admin"] },
  { method: "POST", match: /^\/api\/diagnostics$/, roles: ["doctor", "admin"] },
  { method: "PATCH", match: /^\/api\/diagnostics$/, roles: ["doctor", "admin"] },
  { method: "PATCH", match: /^\/api\/followups$/, roles: ["frontline", "doctor", "admin"] },
  { method: "POST", match: /^\/api\/documents$/, roles: ["kiosk", "frontline", "admin"] },
  { method: "POST", match: /^\/api\/documents\/validate$/, roles: ["frontline", "doctor", "admin"] },
  { method: "POST", match: /^\/api\/demo\/reset$/, roles: ["admin"] },
  { method: "POST", match: /^\/api\/consent\/withdraw$/, roles: ["frontline", "admin"] },
]

export function isAllowed(method: string, pathname: string, role: SessionRole): boolean {
  const rule = ROUTE_PERMISSIONS.find((r) => r.method === method && r.match.test(pathname))
  if (!rule) return false
  return rule.roles.includes(role)
}

/**
 * Returns a 401/403 NextResponse when the caller lacks a session or the
 * required role; returns null when the request may proceed.
 * (Read-only GETs stay open — kiosk tablets share one device session.)
 */
export function guard(req: NextRequest, method: "POST" | "PATCH"): NextResponse | null {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED — sign in to perform this action" },
      { status: 401 }
    )
  }
  const pathname = new URL(req.url).pathname
  if (!isAllowed(method, pathname, session.sub)) {
    return NextResponse.json(
      { ok: false, error: `AUTH_FORBIDDEN — ${session.sub} role cannot ${method} ${pathname}` },
      { status: 403 }
    )
  }
  return null
}
