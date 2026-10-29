import "server-only";
import type { ServerEnv } from "./env";
import { apiError } from "./http";
import { logger } from "./logger";
import { resolveAllowedOrigin } from "./origin";
import { clientIp, createRateLimiter } from "./rate-limit";

/**
 * Gate for endpoints that spend paid AI credits: same-origin check, a per-IP limit, and a
 * global cap. The global cap bounds spend even when IPs are spoofed or rotated.
 * Returns the verified origin, or an error response to send as-is.
 */
export function createBillableGuard(name: string, opts: { perIpPerMinute: number; globalPerMinute: number }) {
  const perIp = createRateLimiter({ limit: opts.perIpPerMinute, windowMs: 60_000 });
  const global = createRateLimiter({ limit: opts.globalPerMinute, windowMs: 60_000, maxKeys: 1 });

  return function guard(req: Request, env: ServerEnv): { origin: string } | Response {
    const origin = resolveAllowedOrigin(req.headers, env.appOrigins);
    if (!origin) {
      logger.warn(`${name}.forbidden_origin`, { origin: req.headers.get("origin") });
      return apiError(403, "forbidden_origin", "Not allowed.");
    }
    // Check the IP bucket first so one client hammering the endpoint doesn't drain the global budget.
    const rl = perIp(clientIp(req.headers));
    const g = rl.ok ? global("all") : rl;
    if (!g.ok) {
      logger.warn(`${name}.rate_limited`, { scope: rl.ok ? "global" : "ip" });
      return apiError(429, "rate_limited", "Too many attempts. Please wait a moment.", {
        "Retry-After": String(g.retryAfterSeconds),
      });
    }
    if (!env.decartApiKey) {
      logger.error(`${name}.not_configured`);
      return apiError(503, "not_configured", "Try-on is not available right now.");
    }
    return { origin };
  };
}
