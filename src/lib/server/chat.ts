import "server-only";
import { checkAnswer, handleLearning, normalizeAnswer, type LearningResult } from "../learning/engine";
import { getActivity, type Activity } from "../learning/curriculum";
import { currentLevel, type Progress } from "../learning/progress";
import { detectMode, nextChatContext, type ChatContext, type Mode } from "../chat/modes";
import { inputRisk } from "../chat/safety";
import { chatRequestSchema, type ChatRequest, type ChatReply } from "../chat/schema";
import { optionalLlm, type LlmOptions } from "./llm";

function ruleReply(mode: Mode, message: string, context: ChatContext): { reply: string; choices: string[]; openEnded: boolean } {
  const text = normalizeAnswer(message);
  if (mode === "Support") {
    if (/\b(happy|excited)\b/.test(text)) return { reply: "You feel happy! Would you like to share a smile or play?", choices: ["Play", "Let's learn"], openEnded: false };
    if (/\b(sad|lonely|miss)\b/.test(text)) return { reply: "It is okay to feel sad. You can talk to a trusted grown-up.", choices: ["Take a break", "Let's talk"], openEnded: false };
    if (/\b(scared|afraid|worried)\b/.test(text)) return { reply: "Feeling scared can be hard. A trusted grown-up can help you feel safe.", choices: ["Take a break", "Let's talk"], openEnded: false };
    if (/\b(cant|cannot|angry|upset|hate)\b/.test(text)) return { reply: "That feels hard, and trying matters. You can take a break with a trusted grown-up.", choices: ["Take a break", "Let's learn"], openEnded: false };
    return { reply: "Your feelings matter. You can talk to a trusted grown-up.", choices: ["Take a break", "Let's talk"], openEnded: true };
  }
  if (mode === "Engagement") {
    if (/\b(break|stop|tired|sleepy|no more|dont want|do not want)\b/.test(text)) return { reply: "A little rest is okay. We can play or learn when you feel ready.", choices: ["Play", "Let's learn"], openEnded: false };
    return { reply: "Let's play pretend! Would you rather hop like a bunny or flap like a bird?", choices: ["Hop like a bunny", "Flap like a bird", "Let's learn"], openEnded: false };
  }
  if (/^(hi|hello|hey|start)$/.test(text)) return { reply: "Hello, little friend! Would you like to learn or play?", choices: ["Let's learn", "Play", "Let's talk"], openEnded: false };
  if (/^(thanks|thank you)$/.test(text)) return { reply: "You are welcome! I like how you keep trying.", choices: ["Let's learn", "Play"], openEnded: false };
  if (text === "what is your name") return { reply: "I am Little Buddy, your English practice helper! What would you like to do?", choices: ["Let's learn", "Play"], openEnded: false };
  if (/\bstory\b/.test(text)) return { reply: "A little duck shares a toy with a friend. They smile and play together!", choices: ["Play", "Let's learn"], openEnded: false };
  if (context.topic === "animals") return { reply: "Animals can be fun! Would you like to talk about cats or birds?", choices: ["Cats", "Birds", "Let's learn"], openEnded: true };
  if (context.topic === "books") return { reply: "Books can take us on little trips! Would you like a story or a game?", choices: ["Tell me a story", "Play", "Let's learn"], openEnded: true };

  return { reply: "I am here to listen and play. Would you like to talk or play a game?", choices: ["Let's talk", "Play", "Let's learn"], openEnded: true };
}
export async function respondToChat(raw: ChatRequest, llmOptions: LlmOptions = {}): Promise<ChatReply> {
  const request = chatRequestSchema.parse(raw);
  const message = request.message ?? ({ start: "hello", learn: "let's learn", talk: "let's talk", play: "play", break: "take a break", hint: "hint", skip: "skip" } as const)[request.action as Exclude<ChatRequest["action"], "message">];
  const risk = inputRisk(message);
  if (risk) {
    const mode: Mode = risk === "urgent" ? "Support" : "Conversation";
    const reply = risk === "urgent" ? "You deserve to feel safe. Please tell a trusted grown-up right now so they can help." : risk === "private" ? "Let's keep private details off our chat. We can talk about animals or play!" : "Let's keep our chat kind and safe. Would you like to play or learn?";
    return { mode, reply, choices: risk === "urgent" ? ["Take a break"] : ["Play", "Let's learn"], progress: request.progress, context: nextChatContext(request.context, mode, message), activity: null, source: "rules", outcome: null };
  }
  let mode = detectMode(message, request.progress, request.context);
  // The pretend game remembers its mode without storing a conversation transcript.
  if (request.context.mode === "Engagement" && /\b(hop|flap|bunny)\b/.test(normalizeAnswer(message))) {
    mode = "Engagement";
    return { mode, reply: "What a fun choice! Would you like another game or a little learning?", choices: ["Play", "Let's learn"], progress: request.progress, context: nextChatContext(request.context, mode, message), activity: null, source: "rules", outcome: null };
  }
  const context = nextChatContext(request.context, mode, message);
  if (mode === "Learning") {
    const text = normalizeAnswer(message);
    const active = request.progress.context.activeActivityId ? getActivity(request.progress.context.activeActivityId) : null;
    const isAnswer = request.action === "message" && active && checkAnswer(active, message);
    const action = request.action === "hint" || text === "hint" || text === "help" || /^(i )?(dont know|do not know|not sure|idk)$/.test(text) ? { type: "hint" as const } : request.action === "skip" || text === "skip" ? { type: "skip" as const } : request.action === "learn" || (!isAnswer && /^(learn|lets learn|let s learn|start|continue|try again|back to learning)$/.test(text)) ? { type: "start" as const } : { type: "answer" as const, message };
    const learning = handleLearning(request.progress, action);
    return { mode, reply: learning.reply, choices: [...learning.activity.choices], progress: learning.state, context, activity: learning.activity, source: "rules", outcome: learning.outcome };
  }
  const fallback = ruleReply(mode, message, context);
  const generated = fallback.openEnded ? await optionalLlm({ mode, level: currentLevel(request.progress), message, context }, llmOptions) : null;
  return { mode, reply: generated ?? fallback.reply, choices: fallback.choices, progress: request.progress, context, activity: null, source: generated ? "llm" : "rules", outcome: null };
}
