import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { shouldBypassRateLimit } from "@/lib/bot-detection";

export type RateLimitKind = "directoryPage" | "directoryContacts";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

const LIMITS: Record<RateLimitKind, { requests: number; windowMs: number }> = {
  directoryPage: { requests: 120, windowMs: 60 * 60 * 1000 },
  directoryContacts: { requests: 60, windowMs: 60 * 60 * 1000 },
};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedis();

const upstashLimiters: Partial<Record<RateLimitKind, Ratelimit>> = {};

if (redis) {
  for (const kind of Object.keys(LIMITS) as RateLimitKind[]) {
    const { requests, windowMs } = LIMITS[kind];
    upstashLimiters[kind] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, `${windowMs} ms`),
      prefix: `nowebsite:${kind}`,
      analytics: false,
    });
  }
} else if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory fallback (dev only).",
  );
}

function checkMemoryLimit(
  key: string,
  kind: RateLimitKind,
  multiplier = 1,
): RateLimitResult {
  const { requests, windowMs } = LIMITS[kind];
  const limit = requests * multiplier;
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset: entry.resetAt,
  };
}

export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
  userAgent: string | null,
): Promise<RateLimitResult> {
  const multiplier = shouldBypassRateLimit(userAgent) ? 5 : 1;
  const key = `${kind}:${identifier}`;

  const limiter = upstashLimiters[kind];
  if (limiter) {
    const result = await limiter.limit(key);
    const effectiveLimit = LIMITS[kind].requests * multiplier;
    return {
      success: result.success,
      limit: effectiveLimit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  return checkMemoryLimit(key, kind, multiplier);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfter = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    ...(result.success ? {} : { "Retry-After": String(retryAfter) }),
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
