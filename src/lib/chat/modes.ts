import { z } from "zod";
import { checkAnswer, normalizeAnswer } from "../learning/engine";
import { getActivity } from "../learning/curriculum";
import type { Progress } from "../learning/progress";

export const MODES = ["Learning", "Conversation", "Engagement", "Support"] as const;
export type Mode = typeof MODES[number];
export const chatContextSchema = z.object({
  mode: z.enum(MODES),
  topic: z.enum(["general", "animals", "books", "feelings", "play"]),
  disengagedTurns: z.number().int().min(0).max(3),
}).strict();
export type ChatContext = z.infer<typeof chatContextSchema>;
export function createChatContext(): ChatContext { return { mode: "Conversation", topic: "general", disengagedTurns: 0 }; }
export function detectMode(message: string, state: Progress, context: ChatContext): Mode {
  const text = normalizeAnswer(message);
  // Explicit feelings take precedence over a lesson; story answers remain answers.
  if (/\b(i am|im|i feel|feeling|i m) (sad|scared|afraid|angry|upset|worried|lonely|hurt|happy|excited)\b|\bi (miss|hate|cant|cannot)\b|\b(someone hurt|hurt me|help me|not safe|bully|bullied)\b/.test(text)) return "Support";
  const active = state.context.activeActivityId ? getActivity(state.context.activeActivityId) : null;
  if (active && checkAnswer(active, message)) return "Learning";
  if (/^(sad|scared|afraid|angry|upset|worried|lonely|hurt|happy|excited)$/.test(text)) return "Support";
  if (/\b(bored|boring|tired|sleepy|stop|break|dont want|do not want|no more)\b/.test(text)) return "Engagement";
  if (/^(learn|lets learn|let s learn|start|continue|try again|back to learning|hint|help|skip)$/.test(text)) return "Learning";
  if (/\b(play|game|silly|fun)\b/.test(text)) return "Engagement";
  if (/^(hi|hello|hey|thanks|thank you|talk|lets talk|let s talk|how are you|what is your name)$/.test(text)) return "Conversation";
  if (context.mode === "Support" && /^(yes|no|okay|ok|a little|still sad|still scared|tell me more)$/.test(text)) return "Support";
  if (/\b(dont know|do not know|not sure|idk)\b/.test(text)) return context.disengagedTurns >= 1 ? "Engagement" : "Learning";
  if (context.mode === "Learning" && active && (active.choices.some(c => normalizeAnswer(c) === text) || text.split(" ").length <= 3)) return "Learning";
  return "Conversation";
}
export function nextChatContext(previous: ChatContext, mode: Mode, message: string): ChatContext {
  const text = normalizeAnswer(message);
  const topic = mode === "Support" ? "feelings" : mode === "Engagement" ? "play" : /\b(cat|cats|dog|dogs|bird|birds|duck|ducks)\b/.test(text) ? "animals" : /\b(book|books|story)\b/.test(text) ? "books" : previous.topic;
  const disengaged = /\b(bored|tired|dont know|do not know|not sure|idk)\b/.test(text);
  return { mode, topic, disengagedTurns: disengaged ? Math.min(3, previous.disengagedTurns + 1) : 0 };
}

