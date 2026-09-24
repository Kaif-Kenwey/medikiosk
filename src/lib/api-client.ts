"use client"

// ============================================================
// MediKiosk — Client API layer with OFFLINE-FIRST queue
// When offline, mutations are queued in localStorage and applied
// optimistically to the local store. [Sync Now] replays them.
// ============================================================

import type { ApiEnvelope, QueuedAction } from "@/lib/types"

const QUEUE_KEY = "medikiosk.sync-queue.v1"

export function getQueue(): QueuedAction[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedAction[]
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

/** Replay the offline queue in order. Returns synced count. */
export async function replayQueue(): Promise<number> {
  const queue = getQueue()
  let synced = 0
  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      })
      removeFromQueue(item.id)
      synced += 1
    } catch {
      break // stop on first failure — retry next sync
    }
  }
  return synced
}
