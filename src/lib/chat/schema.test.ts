import { describe, it, expect } from "vitest";
import { chatReplySchema } from "./schema";
import { respondToChat } from "../server/chat";
import { createProgress } from "../learning/progress";
import { createChatContext } from "./modes";

describe("browser response boundary", () => {
  it("accepts the actual lesson reply and rejects tampered activity content", async () => {
    const reply = await respondToChat({ sessionId: crypto.randomUUID(), action: "learn", progress: createProgress(), context: createChatContext() }, { apiKey: "" });
    expect(chatReplySchema.safeParse(JSON.parse(JSON.stringify(reply))).success).toBe(true);
    expect(chatReplySchema.safeParse({ ...reply, activity: { ...reply.activity, prompt: "Unexpected content" } }).success).toBe(false);
  });
  it("rejects oversized reply text and invalid progress instead of rendering it", () => {
    expect(chatReplySchema.safeParse({ reply: "x".repeat(501), progress: {} }).success).toBe(false);
  });
});
