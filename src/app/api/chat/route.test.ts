import { describe, expect, it, vi, afterEach } from "vitest";
import { POST } from "./route";
import { createProgress } from "@/lib/learning/progress";
import { createChatContext } from "@/lib/chat/modes";

function payload() { return { sessionId: crypto.randomUUID(), action: "message", message: "I am sad", progress: createProgress(), context: createChatContext() }; }
function req(body: unknown, headers: Record<string, string> = {}) { return new Request("https://buddy.example/api/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
afterEach(() => vi.unstubAllEnvs());
describe("chat API boundary", () => {
  it("returns a no-store Support response with unchanged learning progress", async () => {
    const body = payload(); const response = await POST(req(body));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json(); expect(data.mode).toBe("Support"); expect(data.progress).toEqual(body.progress);
  });
  it("rejects invalid messages, progress and actions without leaking validation details", async () => {
    for (const body of [{ ...payload(), message: "a".repeat(201) }, { ...payload(), progress: {} }, { ...payload(), action: "run-system" }]) {
      const response = await POST(req(body)); expect(response.status).toBe(400);
      expect(Object.keys(await response.json())).toEqual(["error"]);
    }
  });
  it("rejects cross-origin requests and wrong content type", async () => {
    expect((await POST(req(payload(), { origin: "https://other.example" }))).status).toBe(403);
    expect((await POST(req(payload(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await POST(req(payload(), { "content-type": "text/plain" }))).status).toBe(415);
  });
  it("accepts same-origin requests", async () => expect((await POST(req(payload(), { origin: "https://buddy.example" }))).status).toBe(200));
  it("rejects malformed JSON and oversized streamed bodies", async () => {
    for (const body of ["{", "x".repeat(16_385)]) {
      const request = new Request("https://buddy.example/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body });
      expect((await POST(request)).status).toBe(400);
    }
    expect((await POST(req(payload(), { "content-length": "20000" }))).status).toBe(400);
  });
  it("responds with 429 and Retry-After when a session exceeds its limit", async () => {
    vi.stubEnv("VERCEL", "1"); const body = payload();
    for (let i = 0; i < 30; i++) expect((await POST(req(body, { "x-forwarded-for": "192.0.2.9" }))).status).toBe(200);
    const response = await POST(req(body, { "x-forwarded-for": "192.0.2.9" }));
    expect(response.status).toBe(429); expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
