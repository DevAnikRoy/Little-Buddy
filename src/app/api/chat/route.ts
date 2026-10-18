import { chatRequestSchema } from "@/lib/chat/schema";
import { respondToChat } from "@/lib/server/chat";
import { rateLimiter, requestIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 16_384;
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
async function readBoundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Error("size");
  if (!request.body) throw new Error("body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { void reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function POST(request: Request) {
  const ipLimit = rateLimiter.ip(requestIp(request.headers));
  if (!ipLimit.allowed) return json({ error: "Let's take a short pause and try again." }, 429, { "Retry-After": String(ipLimit.retryAfter) });
  const origin = request.headers.get("origin");
  // Next.js may use an internal request URL hostname. Browsers send the public Host.
  let sameOrigin = true;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      sameOrigin = ["http:", "https:"].includes(parsedOrigin.protocol) && parsedOrigin.host === (request.headers.get("host") ?? new URL(request.url).host);
    } catch { sameOrigin = false; }
  }
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Please use Little Buddy's own page." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Please send JSON." }, 415);
  let body: unknown;
  try { body = await readBoundedJson(request); } catch { return json({ error: "Please send a small, valid message." }, 400); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Please send a valid message of up to 200 characters." }, 400);
  const sessionLimit = rateLimiter.session(parsed.data.sessionId);
  if (!sessionLimit.allowed) return json({ error: "Let's take a short pause and try again." }, 429, { "Retry-After": String(sessionLimit.retryAfter) });
  try { return json(await respondToChat(parsed.data)); } catch { return json({ error: "Buddy needs a little pause. Please try again." }, 503); }
}
