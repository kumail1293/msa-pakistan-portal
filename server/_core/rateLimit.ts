import type { Request } from "express";

/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed on the socket remote address ONLY — X-Forwarded-For is attacker-
 * controllable and is never trusted, so the limit cannot be bypassed by
 * spoofing headers. Behind a real reverse proxy the proxy's address becomes
 * the shared key, which still enforces a global cap (the safe direction).
 *
 * Buckets are trimmed when the map grows; memory is bounded.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Stable rate-limit key for a request. */
export function rateLimitKey(req: Request): string {
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Record one attempt for `key`. Returns whether the request is allowed and,
 * when blocked, how long to wait.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    trimBuckets(now);
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true };
}

/** Test/ops hook: drop a key's window immediately. */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

function trimBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
  // Worst case (e.g. a burst across many IPs): reset the window rather than
  // let the map grow without bound.
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}
