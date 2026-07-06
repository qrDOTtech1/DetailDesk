/**
 * In-memory sliding-window rate limiter. Good enough for a single Railway
 * instance in V1 — no external dependency. Resets on deploy (acceptable).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const list = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (list.length >= limit) {
    hits.set(key, list);
    return false; // over limit
  }
  list.push(now);
  hits.set(key, list);
  // opportunistic cleanup
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.every((t) => t <= windowStart)) hits.delete(k);
  }
  return true;
}
