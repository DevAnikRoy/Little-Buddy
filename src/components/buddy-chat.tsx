"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getActivity, SKILLS, type Activity, type Skill } from "@/lib/learning/curriculum";
import { learningSummary } from "@/lib/learning/engine";
import { createProgress, isMastered, type Progress } from "@/lib/learning/progress";
import { loadProgress, resetProgress, saveProgress } from "@/lib/learning/storage";
import { createChatContext, type ChatContext, type Mode } from "@/lib/chat/modes";
import Icon3D from "./icon-3d";
import LessonSticker from "./lesson-sticker";
import PromptBar from "./PromptBar";
import ReadAloud from "./read-aloud";
import { chatReplySchema, chatRequestSchema, type ChatRequest } from "@/lib/chat/schema";

type Message = { id: number; role: "buddy" | "child"; text: string; activity?: Activity | null };
const WELCOME = "Hi, I'm Buddy! Tap Learn, Play, or Talk.";
const MODE_LABEL: Record<Mode, string> = { Learning: "Learning together", Conversation: "A little chat", Engagement: "Time to play & rest", Support: "Here for your feelings" };
const MODE_ICON: Record<Mode, string> = { Learning: "✏️", Conversation: "💬", Engagement: "🌈", Support: "💛" };
const INITIAL_CHOICES = ["Let's learn", "Play", "Let's talk"];
const SKILL_CHIP: Record<Skill, { label: string; mark: string }> = {
  colors: { label: "Colors", mark: "🔴" },
  animals: { label: "Animals", mark: "🐾" },
  preferences: { label: "I like", mark: "💛" },
  sentences: { label: "Sentences", mark: "✏️" },
  descriptions: { label: "Describe", mark: "🎈" },
  stories: { label: "Stories", mark: "📖" },
};

function choiceIcon(choice: string): string {
  const key = choice.toLowerCase();
  if (key === "red") return "🔴"; if (key === "blue") return "🔵"; if (key === "yellow") return "🟡"; if (key === "green") return "🟢";
  if (key === "cat" || key === "cats") return "🐱"; if (key.includes("dog")) return "🐶"; if (key.includes("duck")) return "🦆";
  if (key.includes("apple")) return "🍎"; if (key.includes("book")) return "📖"; if (key.includes("ball")) return "🟠";
  if (key.includes("umbrella")) return "☂️"; if (key.includes("grown")) return "🧑"; if (key.includes("bird")) return "🐦";
  if (key.includes("learn")) return "✏️"; if (key.includes("play") || key.includes("game")) return "🌈";
  if (key.includes("break")) return "🌿"; if (key.includes("talk")) return "💬"; if (key.includes("bunny")) return "🐰";
  if (key.includes("story")) return "📖"; return "✦";
}

export default function BuddyChat() {
  const [progress, setProgress] = useState<Progress>(createProgress);
  const [context, setContext] = useState<ChatContext>(createChatContext);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "buddy", text: WELCOME }]);
  const [choices, setChoices] = useState(INITIAL_CHOICES);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [storageNote, setStorageNote] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [announcement, setAnnouncement] = useState(WELCOME);
  const [celebration, setCelebration] = useState(0);
  const session = useRef("");
  const stateRef = useRef({ progress, context });
  const lock = useRef(false);
  const sequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const revealReply = useRef(false);
  const resetButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    session.current = crypto.randomUUID();
    const loaded = loadProgress();
    let nextContext = createChatContext();
    if (loaded.state.context.activeActivityId) {
      const activity = getActivity(loaded.state.context.activeActivityId);
      nextContext = { ...nextContext, mode: "Learning" };
      const text = "Welcome back! Let's take one little step together.";
      setMessages([{ id: 0, role: "buddy", text, activity }]);
      setChoices([...activity.choices]);
      setAnnouncement(`${text} ${activity.prompt}`);
    }
    setProgress(loaded.state); setContext(nextContext);
    stateRef.current = { progress: loaded.state, context: nextContext };
    if (loaded.status === "unavailable") setStorageNote("Progress stays here while this page is open. This browser cannot save it.");
    if (loaded.status === "invalid") setStorageNote("The saved progress could not be opened. We're starting fresh.");
    setReady(true);
    return () => { sequence.current++; abortRef.current?.abort(); };
  }, []);

  useEffect(() => { const log = chatEnd.current?.parentElement; if (log) { log.scrollTop = log.scrollHeight; if (revealReply.current) { log.scrollIntoView({ block: "nearest", behavior: "instant" }); revealReply.current = false; } } }, [messages, busy]);
  useEffect(() => {
    if (!retryAfter) return;
    const timer = setInterval(() => setRetryAfter(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  async function send(action: ChatRequest["action"], text?: string) {
    if (!ready || lock.current || retryAfter > 0) return;
    const current = stateRef.current;
    const payload = { sessionId: session.current, action, ...(action === "message" ? { message: text?.trim() } : {}), ...current };
    const parsed = chatRequestSchema.safeParse(payload);
    if (!parsed.success) { setError("Try a message with 1 to 200 characters, on one line."); return; }
    lock.current = true; setBusy(true); setError(""); setConfirmReset(false);
    const ticket = ++sequence.current;
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 6000);
    const display = text ?? ({ start: "Hello!", hint: "A hint, please", skip: "Another question, please", learn: "Let's learn", talk: "Let's talk", play: "Let's play", break: "A little break" } as Record<string, string>)[action];
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: controller.signal, cache: "no-store" });
      if (ticket !== sequence.current) return;
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get("retry-after")); setRetryAfter(Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) : 60);
          throw new Error("pause");
        }
        throw new Error("network");
      }
      const result = chatReplySchema.parse(await response.json());
      if (ticket !== sequence.current) return;
      stateRef.current = { progress: result.progress, context: result.context };
      setProgress(result.progress); setContext(result.context); setChoices(result.choices);
      revealReply.current = true;
      setMessages(previous => [...previous, { id: ticket * 2 - 1, role: "child" as const, text: display }, { id: ticket * 2, role: "buddy" as const, text: result.reply, activity: result.activity }].slice(-30));
      if (result.outcome === "correct") setCelebration(ticket);
      setAnnouncement(`${result.reply}${result.activity ? ` ${result.activity.prompt}` : ""}`);
      if (action === "message") setInput("");
      if (!saveProgress(result.progress)) setStorageNote("This browser cannot save progress. You can keep playing on this page.");
    } catch (err) {
      if (ticket !== sequence.current) return;
      setError(err instanceof Error && err.message === "pause" ? "Let's take a tiny pause. Try again when the timer is done." : "Buddy couldn't connect. Your question is still here. Please try again.");
    } finally {
      clearTimeout(timer);
      if (ticket === sequence.current) { lock.current = false; setBusy(false); abortRef.current = null; }
    }
  }

  function doReset() {
    sequence.current++; abortRef.current?.abort(); lock.current = false; setBusy(false); setCelebration(0);
    const reset = resetProgress(); const nextContext = createChatContext();
    stateRef.current = { progress: reset.state, context: nextContext };
    setProgress(reset.state); setContext(nextContext); setChoices(INITIAL_CHOICES);
    setMessages([{ id: 0, role: "buddy", text: WELCOME }]); setInput(""); setError(""); setConfirmReset(false); setAnnouncement("Progress reset. " + WELCOME);
    setStorageNote(reset.persisted ? "" : "This browser could not clear saved progress. This page has started fresh.");
    resetButton.current?.focus();
    // Preserve the random session and cooldown: resetting must not bypass rate limits.
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send("message", input); }
  const summary = learningSummary(progress);
  const unavailable = !ready || busy || retryAfter > 0;
  const active = messages.at(-1)?.role === "buddy" ? messages.at(-1)?.activity : null;

  const visibleChoices = choices.filter(choice => !["let's learn", "let's talk", "play"].includes(choice.toLowerCase()));
  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Little Buddy home"><Icon3D name="bear" size={52} /><span>little buddy<span className="brand-dot">.</span></span></a>
      <span className="header-note">A little English. A lot of heart.</span>
      <button ref={resetButton} className="reset-button" onClick={() => setConfirmReset(true)} disabled={!ready}>Reset progress</button>
    </header>
    <main className="learning-layout">
      <aside className="buddy-sidebar" aria-label="Your learning journey">
        <div className="mascot-stage"><span className="mascot-spark spark-one" aria-hidden="true"><Icon3D name="star" size={42} /></span><Icon3D name="bear" size={168} className="mascot-bear" /><span className="mascot-spark spark-two" aria-hidden="true">✦</span></div>
        <h1>Hi, little friend!</h1>
        <section className="journey" aria-label="Learning progress">
          <ol className="level-trail" aria-label={`Current level ${summary.level}`}>
            {(["L1", "L2", "L3"] as const).map((level, index) => <li key={level} aria-label={`Level ${index + 1}: ${["Words", "Sentences", "Stories"][index]}`} className={level === summary.level ? "current" : index < Number(summary.level[1]) - 1 ? "done" : "later"} aria-current={level === summary.level ? "step" : undefined}><span className="level-circle">{index < Number(summary.level[1]) - 1 ? "✓" : index + 1}</span><span>{["Words", "Sentences", "Stories"][index]}</span></li>)}
          </ol>
          <ul className="skill-stickers" aria-label={`${summary.masteredSkills} of 6 skills starred`}>
            {SKILLS.map(skill => {
              const got = isMastered(progress, skill);
              const chip = SKILL_CHIP[skill];
              return <li key={skill} className={got ? "starred" : "waiting"}><span aria-hidden="true">{got ? "⭐" : chip.mark}</span><span>{chip.label}</span></li>;
            })}
          </ul>
          <div className="progress-caption"><span>{summary.complete ? "Look how you grew!" : "Little steps"}</span><strong>{summary.masteredSkills}/6</strong></div>
          <progress max="6" value={summary.masteredSkills} aria-label={`${summary.masteredSkills} of 6 skills mastered`} />
        </section>
      </aside>
      <section className={`chat-panel room-${context.mode.toLowerCase()}`} aria-label="Chat with Buddy">
        <header className="chat-header"><span className="buddy-avatar"><Icon3D name="bear" size={58} /></span><div><h2>Buddy</h2><p>{context.mode === "Learning" ? "One little question." : context.mode === "Support" ? "Your feelings matter." : context.mode === "Engagement" ? "Let's play a bit." : "I'm listening."}</p></div><span className={`mode-indicator mode-${context.mode.toLowerCase()}`} role="status"><span aria-hidden="true">{MODE_ICON[context.mode]}</span>{MODE_LABEL[context.mode]}</span></header>
        <nav className="activity-nav" aria-label="Choose what to do">{([{ action: "learn", label: "Learn", icon: "learn" }, { action: "play", label: "Play", icon: "play" }, { action: "talk", label: "Talk", icon: "talk" }] as const).map(item => <button key={item.action} disabled={unavailable} aria-pressed={context.mode === ({ learn: "Learning", play: "Engagement", talk: "Conversation" }[item.action])} className={`activity-${item.action}`} onClick={() => void send(item.action)}><Icon3D name={item.icon} size={60} /><span>{item.label}</span></button>)}</nav>
        <div className="chat-messages" role="log" aria-label="Conversation" aria-live="off" aria-busy={busy}>
          {messages.map(message => <div key={message.id} className={`message-row ${message.role}`}>
            <div className={`message-bubble ${message.role === "buddy" && message.id !== 0 ? "reply-reveal" : ""}`}>
              <div className="message-top"><span className="speaker">{message.role === "buddy" ? "Buddy" : "You"}</span>{message.role === "buddy" && <ReadAloud text={`${message.text}${message.activity ? ` ${message.activity.prompt}` : ""}`} />}</div>
              <p>{message.text}</p>{message.activity && <div className="lesson-card"><LessonSticker activityId={message.activity.id} /><p className="question">{message.activity.prompt}</p></div>}
            </div>
          </div>)}
          {busy && <div className="thinking" role="status"><Icon3D name="bear" size={40} /><span>Buddy is thinking<span className="thinking-dots" aria-hidden="true">•••</span></span></div>}
          <div ref={chatEnd} />
        </div>
        <div className="chat-controls">
          {celebration > 0 && <div key={celebration} className="celebration" aria-hidden="true">{[0,1,2,3,4,5,6].map(index => <span key={index} style={{ "--piece": index } as React.CSSProperties}>✦</span>)}</div>}
          {visibleChoices.length > 0 && <div className={`answer-choices ${visibleChoices.every(choice => choice.length <= 8) ? "compact-choices" : ""}`} aria-label={context.mode === "Learning" ? "Answer choices" : "Things you can say"}>{visibleChoices.map(choice => <button key={choice} disabled={unavailable} onClick={() => void send("message", choice)}><span aria-hidden="true">{choiceIcon(choice)}</span><span>{choice}</span></button>)}</div>}
          {context.mode === "Learning" && active && <div className="lesson-tools"><button disabled={unavailable} onClick={() => void send("hint")}><span aria-hidden="true">💡</span>Hint</button><button disabled={unavailable} onClick={() => void send("skip")}>Another one<span aria-hidden="true">↗</span></button></div>}
          <fieldset className="feelings-row"><legend>I feel…</legend>{[{ text: "Happy", icon: "happy" }, { text: "Sad", icon: "sad" }, { text: "Tired", icon: "tired" }].map(feeling => <button key={feeling.text} className={`feeling-${feeling.icon}`} disabled={unavailable} onClick={() => void send("message", `I am ${feeling.text.toLowerCase()}`)}><Icon3D name={feeling.icon as "happy" | "sad" | "tired"} size={52} /><span>{feeling.text}</span></button>)}</fieldset>
          {error && <div className="error-note" role="alert"><span aria-hidden="true">🌱</span><p>{error}{retryAfter > 0 && <strong> {retryAfter}s</strong>}</p></div>}
          <PromptBar value={input} onChange={setInput} onSubmit={submit} disabled={!ready || busy} sendDisabled={unavailable} busy={busy} />
        </div>
      </section>
    </main>
    <footer className="site-footer"><span>No names or private details, please.</span><span>Little steps count. Every single one.</span></footer>
    {storageNote && <p className="storage-note" role="status">{storageNote}</p>}
    <details className="privacy-note"><summary>A note for grown-ups</summary><p>Buddy estimates learning state with rules. It does not precisely recognise emotions. Progress stays in this browser; messages are not saved by the app. If AI replies are enabled, eligible chat messages are sent to Groq. Please supervise young learners and keep personal details out of chat. Listen buttons use this browser's English speech voice, only when tapped.</p></details>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {confirmReset && <div className="dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="reset-dialog" onKeyDown={e => { if (e.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } if (e.key === "Tab") { e.preventDefault(); const buttons = e.currentTarget.querySelectorAll("button"); const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); } }}><Icon3D name="star" size={64} /><h2 id="reset-title">A fresh little start?</h2><p>This clears saved progress and starts again at level 1.</p><div><button autoFocus onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }}>Keep my progress</button><button onClick={doReset}>Start fresh</button></div></section></div>}
  </div>;
}
