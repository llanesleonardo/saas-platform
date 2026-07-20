import { getTrustedClientIp } from "./security/client-ip";

/**
 * In-memory token-bucket rate limiter for single-node installs.
 * Redis-backed limits remain future work for multi-instance SaaS.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

function parseLimitPerMinute(envValue: string | undefined, fallback: number): number {
  if (!envValue?.trim()) return fallback;
  const n = Number.parseInt(envValue, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/** @deprecated Prefer getTrustedClientIp — kept for call sites. */
export function getClientIp(request: Request): string {
  return getTrustedClientIp(request);
}

/**
 * Consume one token from the per-key bucket.
 * `limitPerMinute` is the steady refill rate and burst capacity.
 */
export function takeToken(key: string, limitPerMinute: number): RateLimitResult {
  const now = Date.now();
  const refillPerMs = limitPerMinute / 60_000;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: limitPerMinute, updatedAt: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.updatedAt;
  bucket.tokens = Math.min(limitPerMinute, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    const retryAfterSec = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
    return { ok: false, limit: limitPerMinute, remaining: 0, retryAfterSec };
  }

  bucket.tokens -= 1;
  return {
    ok: true,
    limit: limitPerMinute,
    remaining: Math.floor(bucket.tokens),
    retryAfterSec: 0,
  };
}

export function checkSubmitRateLimit(request: Request): RateLimitResult {
  const limit = parseLimitPerMinute(process.env.RATE_LIMIT_SUBMIT, 60);
  return takeToken(`submit:${getTrustedClientIp(request)}`, limit);
}

export function checkLoginRateLimit(request: Request): RateLimitResult {
  const limit = parseLimitPerMinute(process.env.RATE_LIMIT_LOGIN, 10);
  return takeToken(`login:${getTrustedClientIp(request)}`, limit);
}

/** Per-account login limiter (in addition to IP). */
export function checkLoginEmailRateLimit(email: string): RateLimitResult {
  const limit = parseLimitPerMinute(process.env.RATE_LIMIT_LOGIN, 10);
  const key = email.trim().toLowerCase() || "unknown";
  return takeToken(`login:email:${key}`, limit);
}

/** Test helper */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export { getTrustedClientIp };
