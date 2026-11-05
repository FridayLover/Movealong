/**
 * Tiny in-memory per-user rate limiter for the AI endpoints.
 * Protects credits and the Meta API budget from accidental or scripted spam.
 * Single-instance demo scale — swap for Redis/Upstash when you scale out.
 */

const buckets = new Map<string, number[]>();

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const since = now - windowMs;
  const hits = (buckets.get(key) || []).filter((t) => t > since);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map cannot grow without bound
  if (buckets.size > 500) {
    Array.from(buckets.entries()).forEach(([k, v]) => {
      if (!v.length || v[v.length - 1] <= since) buckets.delete(k);
    });
  }
  return { allowed: true, retryAfterSec: 0 };
}
