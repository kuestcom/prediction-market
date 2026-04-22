import { LRUCache } from 'lru-cache'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// keyed by "<route>:<ip>", capped at 5 000 distinct callers in memory
const store = new LRUCache<string, RateLimitEntry>({ max: 5_000 })

interface RateLimitOptions {
  /** number of allowed requests per window */
  limit?: number
  /** window size in milliseconds */
  windowMs?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Simple fixed-window in-memory rate limiter.
 * In a multi-instance deployment (e.g. Vercel serverless) each instance
 * maintains its own counter — use a shared store (Redis / KV) for global limits.
 */
export function checkRateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: RateLimitOptions = {},
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt }, { ttl: windowMs })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}
