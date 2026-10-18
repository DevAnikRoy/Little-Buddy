import { z } from "zod";
import { progressSchema } from "../learning/progress";
import { chatContextSchema } from "./modes";

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(["start", "message", "hint", "skip", "learn", "talk", "play", "break"]),
  message: z.string().min(1).max(200).refine(s => s.trim().length > 0 && !/[\u0000-\u001F\u007F]/.test(s), "Invalid message").optional(),
  progress: progressSchema,
  context: chatContextSchema,
}).strict().superRefine((data, ctx) => {
  if ((data.action === "message") !== (data.message !== undefined)) ctx.addIssue({ code: "custom", message: "Message/action mismatch" });
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
