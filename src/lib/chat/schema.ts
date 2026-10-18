import { z } from "zod";
import { progressSchema } from "../learning/progress";
import { ACTIVITIES } from "../learning/curriculum";
import { MODES, chatContextSchema } from "./modes";

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

const activitySchema = z.custom<import("../learning/curriculum").Activity>(value => {
  if (!value || typeof value !== "object" || !("id" in value)) return false;
  return ACTIVITIES.some(activity => activity.id === value.id && JSON.stringify(activity) === JSON.stringify(value));
}, "Invalid activity");
export const chatReplySchema = z.object({
  mode: z.enum(MODES), reply: z.string().min(1).max(500), choices: z.array(z.string().min(1).max(200)).max(4),
  progress: progressSchema, context: chatContextSchema, activity: activitySchema.nullable(),
  source: z.enum(["rules", "llm"]), outcome: z.enum(["ready", "correct", "incorrect", "hint", "skipped"]).nullable(),
}).strict();
export type ChatReply = z.infer<typeof chatReplySchema>;
