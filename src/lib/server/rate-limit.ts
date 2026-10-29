import "server-only";

/**
 * Fixed-window in-memory rate limiter.
 *
 * shortcut: state lives in one server instance, so on serverless each instance has its own
 * counters (limits multiply by instance count). Replace with a shared store such as Upstash Redis
 * (`@upstash/ratelimit`) before public launch; keep this call signature.
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const { limit, windowMs, maxKeys = 10_000 } = opts;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      if (buckets.size >= maxKeys) {
        // Bounded memory: drop expired buckets, then the oldest if still full.
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
      }
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    const ok = b.count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - b.count),
      retryAfterSeconds: ok ? 0 : Math.ceil((b.resetAt - now) / 1000),
    };
  };
}

/**
 * Best-effort client IP for rate limiting. Uses the right-most x-forwarded-for entry: the one added by
 * the nearest proxy (on Vercel the header holds only the platform-verified client IP). Entries further
 * left are client-supplied and trivially spoofed. Without a proxy every value here is spoofable, which is
 * why billable routes also have a global cap.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const last = fwd?.split(",").pop()?.trim();
  return last || headers.get("x-real-ip") || "unknown";
}
