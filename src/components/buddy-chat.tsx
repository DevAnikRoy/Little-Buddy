"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getActivity, SKILLS, SKILL_LEVEL, type Activity } from "@/lib/learning/curriculum";
import { learningSummary } from "@/lib/learning/engine";
import { createProgress, isMastered, type Progress } from "@/lib/learning/progress";
import { loadProgress, resetProgress, saveProgress } from "@/lib/learning/storage";
import { createChatContext, type ChatContext, type Mode } from "@/lib/chat/modes";
import { chatReplySchema, chatRequestSchema, type ChatRequest } from "@/lib/chat/schema";

type Message = { id: number; role: "buddy" | "child"; text: string; activity?: Activity | null };
const WELCOME = "Hello, little friend! I'm Buddy. Shall we learn, play, or have a little chat?";
const MODE_LABEL: Record<Mode, string> = { Learning: "Learning together", Conversation: "A little chat", Engagement: "Time to play & rest", Support: "Here for your feelings" };
const MODE_ICON: Record<Mode, string> = { Learning: "✏️", Conversation: "💬", Engagement: "🌈", Support: "💛" };
const SKILL_LABELS = { colors: "Colors", animals: "Animals", preferences: "I like…", sentences: "Sentences", descriptions: "Describing", stories: "Stories" };
const SKILL_ICONS = { colors: "🎨", animals: "🐾", preferences: "🍎", sentences: "💬", descriptions: "🔎", stories: "📖" };
const INITIAL_CHOICES = ["Let's learn", "Play", "Let's talk"];

function choiceIcon(choice: string): string {
  const key = choice.toLowerCase();
  if (key === "red") return "🔴"; if (key === "blue") return "🔵"; if (key === "yellow") return "🟡"; if (key === "green") return "🟢";
  if (key === "cat" || key === "cats") return "🐱"; if (key === "dog") return "🐶"; if (key === "duck") return "🦆";
  if (key.includes("learn")) return "✏️"; if (key.includes("play") || key.includes("game")) return "🌈";
  if (key.includes("break")) return "🌿"; if (key.includes("talk")) return "💬"; if (key.includes("bunny")) return "🐰";
  if (key.includes("bird")) return "🐦"; if (key.includes("story")) return "📖"; return "✦";
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
  const session = useRef("");
  const stateRef = useRef({ progress, context });
  const lock = useRef(false);
  const sequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
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

  useEffect(() => { const log = chatEnd.current?.parentElement; if (log) log.scrollTop = log.scrollHeight; }, [messages, busy]);
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
      setMessages(previous => [...previous, { id: ticket * 2 - 1, role: "child" as const, text: display }, { id: ticket * 2, role: "buddy" as const, text: result.reply, activity: result.activity }].slice(-30));
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
    sequence.current++; abortRef.current?.abort(); lock.current = false; setBusy(false);
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

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Little Buddy home"><span className="brand-mark" aria-hidden="true">🐻</span><span>little buddy<span className="brand-dot">.</span></span></a>
      <span className="header-note"><span aria-hidden="true">☀</span> A little English. A lot of heart.</span>
      <button ref={resetButton} className="reset-button" onClick={() => setConfirmReset(true)} disabled={!ready}>Reset progress</button>
    </header>
    <main className="learning-layout">
      <aside className="buddy-sidebar" aria-label="Your learning journey">
        <div className="buddy-intro"><span className="hello-sticker">hello, friend!</span><span className="big-bear" role="img" aria-label="Buddy the friendly bear">🐻</span><h1>Little steps.<br /><span>Big smiles.</span></h1><p>Learn a little.<br />Play a little. Be you.</p></div>
        <section className="journey"><div className="section-heading"><h2>Your little journey</h2><span aria-hidden="true">✦</span></div>
          <ol className="level-trail" aria-label={`Current level ${summary.level}`}>
            {(["L1", "L2", "L3"] as const).map((level, index) => <li key={level} className={level === summary.level ? "current" : index < Number(summary.level[1]) - 1 ? "done" : "later"} aria-current={level === summary.level ? "step" : undefined}><span className="level-circle">{index < Number(summary.level[1]) - 1 ? "✓" : index + 1}</span><span>{["Words", "Sentences", "Stories"][index]}</span></li>)}
          </ol>
          <div className="progress-caption"><span>{summary.complete ? "Every skill practised!" : "One step at a time"}</span><strong>{summary.masteredSkills}/6 skills</strong></div>
          <progress max="6" value={summary.masteredSkills} aria-label={`${summary.masteredSkills} of 6 skills mastered`} />
          <div className="skill-list">{SKILLS.map(skill => <span key={skill} className={`skill ${isMastered(progress, skill) ? "mastered" : ""}`} title={`${SKILL_LABELS[skill]} — ${SKILL_LEVEL[skill]}${isMastered(progress, skill) ? ", mastered" : ""}`}><span aria-hidden="true">{isMastered(progress, skill) ? "✓" : SKILL_ICONS[skill]}</span>{SKILL_LABELS[skill]}</span>)}</div>
        </section>
        <p className="sidebar-reminder"><span aria-hidden="true">💛</span> Trying is how we grow.</p>
      </aside>
      <section className="chat-panel" aria-label="Chat with Buddy">
        <header className="chat-header"><span className="buddy-avatar" aria-hidden="true">🐻</span><div><h2>Buddy</h2><p>Your English practice pal</p></div><span className={`mode-indicator mode-${context.mode.toLowerCase()}`} role="status"><span aria-hidden="true">{MODE_ICON[context.mode]}</span>{MODE_LABEL[context.mode]}</span></header>
        <nav className="activity-nav" aria-label="Choose what to do">{([{ action: "learn", label: "Learn", icon: "✏️" }, { action: "play", label: "Play", icon: "🌈" }, { action: "talk", label: "Talk", icon: "💬" }] as const).map(item => <button key={item.action} disabled={unavailable} className={context.mode === ({ learn: "Learning", play: "Engagement", talk: "Conversation" }[item.action]) ? "selected" : ""} onClick={() => void send(item.action)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="chat-messages" role="log" aria-label="Conversation" aria-live="off" aria-busy={busy}>
          <p className="chat-day">A good day for a little discovery</p>
          {messages.map(message => <div key={message.id} className={`message-row ${message.role}`}>
            {message.role === "buddy" && <span className="message-avatar" aria-hidden="true">🐻</span>}
            <div className="message-bubble"><span className="speaker">{message.role === "buddy" ? "Buddy" : "You"}</span><p>{message.text}</p>{message.activity && <p className="question">{message.activity.prompt}</p>}</div>
          </div>)}
          {busy && <div className="thinking" role="status">🐻 Buddy is thinking…</div>}
          <div ref={chatEnd} />
        </div>
        <div className="chat-controls">
          <div className="answer-choices" aria-label={context.mode === "Learning" ? "Answer choices" : "Things you can say"}>{choices.map(choice => <button key={choice} disabled={unavailable} onClick={() => void send("message", choice)}><span aria-hidden="true">{choiceIcon(choice)}</span>{choice}</button>)}</div>
          {context.mode === "Learning" && active && <div className="lesson-tools"><button disabled={unavailable} onClick={() => void send("hint")}>💡 A little hint</button><button disabled={unavailable} onClick={() => void send("skip")}>Try another ↗</button></div>}
          {error && <div className="error-note" role="alert">{error}{retryAfter > 0 && <strong> {retryAfter}s</strong>}</div>}
          <form className="composer" onSubmit={submit}><label className="sr-only" htmlFor="chat-input">Your message to Buddy</label><input id="chat-input" name="message" placeholder="Say something to Buddy…" value={input} onChange={e => setInput(e.target.value)} maxLength={200} autoComplete="off" disabled={!ready || busy} aria-describedby="message-limit" /><button type="submit" disabled={unavailable || !input.trim()} aria-label="Send message"><span aria-hidden="true">↑</span></button></form>
          <div className="composer-meta"><span>Or tap a button above</span><span id="message-limit">{input.length}/200</span></div>
          <div className="feelings-row"><span>I feel…</span>{[{ text: "Happy", emoji: "😊" }, { text: "Sad", emoji: "💙" }, { text: "Tired", emoji: "😴" }].map(feeling => <button key={feeling.text} disabled={unavailable} onClick={() => void send("message", `I am ${feeling.text.toLowerCase()}`)}><span aria-hidden="true">{feeling.emoji}</span>{feeling.text}</button>)}</div>
        </div>
      </section>
    </main>
    <footer className="site-footer"><span>Made for little learners, with a little grown-up help.</span><span>No names or private details, please. Progress saves on this device.</span></footer>
    {storageNote && <p className="storage-note" role="status">{storageNote}</p>}
    <details className="privacy-note"><summary>A note for grown-ups</summary><p>Buddy estimates learning state with rules. It does not precisely recognise emotions. Progress stays in this browser; messages are not saved by the app. If AI replies are enabled, eligible chat messages are sent to Groq. Please supervise young learners and keep personal details out of chat.</p></details>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {confirmReset && <div className="dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="reset-dialog" onKeyDown={e => { if (e.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } if (e.key === "Tab") { e.preventDefault(); const buttons = e.currentTarget.querySelectorAll("button"); const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); } }}><span aria-hidden="true">🌱</span><h2 id="reset-title">Start a new little journey?</h2><p>This clears saved learning progress and starts again at level 1.</p><div><button autoFocus onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }}>Keep my progress</button><button onClick={doReset}>Yes, start fresh</button></div></section></div>}
  </div>;
}
