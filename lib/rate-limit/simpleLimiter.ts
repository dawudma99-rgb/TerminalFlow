// lib/rate-limit/simpleLimiter.ts

// A very simple, in-memory, per-process rate limiter.
// This is intended as a lightweight guard for abuse-prone endpoints.
// In a real multi-region/serverless production setup, this can be replaced
// with a Redis/Upstash-backed implementation using the same interface.

export type LimitConfig = {
  windowMs: number; // e.g. 5 * 60 * 1000 for 5 minutes
  max: number; // e.g. 5 requests per window
};

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterMs: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function hitRateLimit(
  key: string,
  config: LimitConfig
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  // New bucket or expired window → reset counter
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: config.max - 1, resetAt };
  }

  // Existing window, already at or above limit
  if (existing.count >= config.max) {
    return {
      ok: false,
      retryAfterMs: existing.resetAt - now,
      resetAt: existing.resetAt,
    };
  }

  // Existing window, increment counter
  existing.count += 1;
  buckets.set(key, existing);

  return {
    ok: true,
    remaining: config.max - existing.count,
    resetAt: existing.resetAt,
  };
}


