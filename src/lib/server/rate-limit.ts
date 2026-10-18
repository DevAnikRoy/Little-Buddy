import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const WINDOW_MS = 60_000;
const MAX_KEYS = 5000;
type Bucket = { count: number; expires: number };
export function createRateLimiter() {
  const buckets = new Map<string, Bucket>();
  const salt = randomBytes(16).toString("hex");
  function consume(kind: "ip" | "session", identity: string, limit: number, now = Date.now()) {
    for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const key = createHash("sha256").update(`${salt}:${kind}:${identity}`).digest("hex");
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= MAX_KEYS) return { allowed: false, retryAfter: 60 };
      bucket = { count: 0, expires: now + WINDOW_MS }; buckets.set(key, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.expires - now) / 1000)) };
  }
  return { ip: (identity: string, now?: number) => consume("ip", identity, 60, now), session: (identity: string, now?: number) => consume("session", identity, 30, now) };
}
export const rateLimiter = createRateLimiter();
export function requestIp(headers: Headers): string {
  // Only trust Vercel's overwritten forwarding header in a Vercel deployment.
  const value = process.env.VERCEL === "1" ? headers.get("x-forwarded-for")?.split(",")[0].trim() : null;
  return value && isIP(value) ? value : "local";
}

