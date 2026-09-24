// ============================================================
// MediKiosk — Field-level encryption (SERVER ONLY)
// AES-256-GCM for sensitive PII at rest (patient phone) plus a
// deterministic blind index (HMAC-SHA256) so continuity match
// by phone works WITHOUT decrypting every row.
//
// Key material comes from MEDIKIOSK_SECRET (env). A dev-only
// fallback keeps the SIH demo self-contained — production
// deployments MUST set the env secret.
// ============================================================

import crypto from "node:crypto"

const DEV_FALLBACK_SECRET = "medikiosk-sih2026-demo-secret-not-for-production"

function keyBytes(): Buffer {
  const secret = process.env.MEDIKIOSK_SECRET || DEV_FALLBACK_SECRET
  // scrypt derives a stable 32-byte key from the secret
  return crypto.scryptSync(secret, "medikiosk.field.v1", 32)
}

const PREFIX = "enc.v1"

/** AES-256-GCM encrypt → "enc.v1:<iv>:<authTag>:<ciphertext>" (all base64url) */
export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":")
}

/** Decrypt an "enc.v1:" payload. Legacy plaintext (no prefix) passes through. */
export function decryptField(stored: string | null | undefined): string {
  if (!stored) return ""
  if (!stored.startsWith(`${PREFIX}:`)) return stored // legacy row written before encryption
  try {
    const [, ivB64, tagB64, ctB64] = stored.split(":")
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB64, "base64url"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    return "" // tampered or wrong key — never surface ciphertext
  }
}

/** Blind index: deterministic, non-reversible lookup key for a phone number. */
export function blindIndex(phone: string): string {
  const normalized = phone.replace(/\D/g, "").slice(-10)
  return crypto
    .createHmac("sha256", keyBytes())
    .update(`phone:${normalized}`)
    .digest("hex")
    .slice(0, 24)
}
