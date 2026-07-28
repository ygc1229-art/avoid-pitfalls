import { NextRequest } from "next/server";
import { ApiError } from "./errors";

type Bucket = { count: number; resetAt: number };

declare global {
  var __avoidPitfallsRateLimits: Map<string, Bucket> | undefined;
}

const buckets =
  globalThis.__avoidPitfallsRateLimits ??
  (globalThis.__avoidPitfallsRateLimits = new Map());

export function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const now = Date.now();
  const key = `${scope}:${requestIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "请求过于频繁，请稍后再试。",
        { retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) },
        true,
      );
    }
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}
