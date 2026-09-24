"use client"

// ============================================================
// MediKiosk — Client API layer with OFFLINE-FIRST queue
// When offline, mutations are queued in localStorage and applied
// optimistically to the local store. [Sync Now] replays them.
//
// Sync integrity rules:
// - a queued record counts as "synced" ONLY when the server
//   answers 2xx with { ok: true }
// - a record the server definitively rejects (4xx validation,
//   missing patient, terminal-state conflict…) is dropped from
//   the queue and reported as FAILED — never counted as synced
//   and never silently lost
// - a network failure stops the replay and keeps the remaining
//   records queued for the next attempt
// ============================================================

import type { ApiEnvelope, QueuedAction } from "@/lib/types"

const QUEUE_KEY = "medikiosk.sync-queue.v1"

export function getQueue(): QueuedAction[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedAction[]
    // Guard against corrupted/stale localStorage shapes
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (q) => q && typeof q.id === "string" && typeof q.url === "string"
    )
  } catch {
    return []
  }
}

export function saveQueue(q: QueuedAction[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue(action: Omit<QueuedAction, "id" | "createdAt">): QueuedAction {
  const item: QueuedAction = {
    ...action,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  saveQueue([...getQueue(), item])
  return item
}

export function clearQueue() {
  saveQueue([])
}

export function removeFromQueue(id: string) {
  saveQueue(getQueue().filter((q) => q.id !== id))
}

/** Move-to-syncing semantics: take the queue out of localStorage so a
 *  concurrent/double "Sync Now" cannot replay the same record twice. */
function takeQueue(): QueuedAction[] {
  const q = getQueue()
  saveQueue([])
  return q
}

/**
 * Executes a mutation. If `offline`, the request is queued and `queued: true`
 * is returned so the caller can apply an optimistic local update instead.
 */
export async function mutate(
  method: "POST" | "PATCH",
  url: string,
  body: Record<string, unknown>,
  opts: { offline?: boolean; label?: string } = {}
): Promise<{ queued: boolean; res?: ApiEnvelope }> {
  if (opts.offline) {
    enqueue({ method, url, body, label: opts.label ?? `${method} ${url}` })
    return { queued: true }
  }
  const res = (await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })) as Response
  const json = (await res.json()) as ApiEnvelope
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`)
  }
  return { queued: false, res: json }
}

export interface ReplayResult {
  synced: number
  failed: number
  /** Remaining count still queued (network failed mid-replay) */
  remaining: number
  /** Labels of records the server rejected */
  failedLabels: string[]
}

/**
 * Replay the offline queue in order.
 * - success (2xx + ok:true): remove, count as synced
 * - definitive rejection (non-network, 4xx/5xx): remove, count as failed
 *   (the record is kept visible in the failure list — never silently lost)
 * - network error: stop, put the remaining records back in the queue
 */
export async function replayQueue(): Promise<ReplayResult> {
  const queue = takeQueue()
  const pending = [...queue]
  const failedLabels: string[] = []
  let synced = 0
  let failed = 0

  while (pending.length > 0) {
    const item = pending[0]
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      })
      let ok = res.ok
      try {
        const json = (await res.json()) as ApiEnvelope
        if (ok && json && json.ok === false) ok = false
      } catch {
        // non-JSON body — fall back to HTTP status
      }
      pending.shift()
      if (ok) {
        synced += 1
      } else {
        failed += 1
        failedLabels.push(item.label)
      }
    } catch {
      // Network failure — stop and re-queue the remainder (incl. current item)
      break
    }
  }

  if (pending.length > 0) saveQueue([...pending, ...getQueue()])
  return { synced, failed, remaining: pending.length, failedLabels }
}
