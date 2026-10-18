"use client";
import { useEffect, useRef, useState } from "react";
import { BUDDY_SPEECH, pickBuddyVoice, speechChunks } from "@/lib/chat/buddy-voice";

let stopCurrent: (() => void) | undefined;

export default function ReadAloud({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const queue = useRef<SpeechSynthesisUtterance[]>([]);
  const active = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const ok = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setSupported(ok);
    if (!ok) return;
    const warm = () => { window.speechSynthesis.getVoices(); };
    warm();
    window.speechSynthesis.addEventListener("voiceschanged", warm);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", warm);
      stopCurrent?.();
      window.speechSynthesis.cancel();
      queue.current = [];
      active.current = null;
    };
  }, []);

  function halt() {
    queue.current = [];
    active.current = null;
    setSpeaking(false);
    window.speechSynthesis.cancel();
  }

  function speakNext() {
    const next = queue.current.shift();
    if (!next) { active.current = null; setSpeaking(false); return; }
    active.current = next;
    window.speechSynthesis.speak(next);
  }

  function speak() {
    if (!supported) return;
    if (speaking) { halt(); return; }
    stopCurrent?.();
    window.speechSynthesis.cancel();
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener("voiceschanged", () => speak(), { once: true });
      return;
    }
    const chosen = pickBuddyVoice(voices);
    if (!chosen && voices.length > 0) {
      setNotice("English audio is not ready here. A grown-up can read with you.");
      return;
    }
    const chunks = speechChunks(text);
    queue.current = chunks.map((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = chosen?.lang ?? "en-US";
      if (chosen) utterance.voice = chosen;
      utterance.rate = BUDDY_SPEECH.rate;
      utterance.pitch = BUDDY_SPEECH.pitch + (index % 2 === 0 ? 0.04 : -0.02);
      utterance.volume = BUDDY_SPEECH.volume;
      utterance.onend = () => { if (active.current === utterance) speakNext(); };
      utterance.onerror = event => {
        if (active.current !== utterance) return;
        halt();
        if (event.error !== "canceled" && event.error !== "interrupted") setNotice("Audio needs a little rest. Try again.");
      };
      return utterance;
    });
    stopCurrent = halt;
    setNotice("");
    setSpeaking(true);
    speakNext();
  }

  return <div className="read-aloud"><button className="listen-button" type="button" aria-label={speaking ? "Stop reading Buddy's message" : "Listen to Buddy's message"} aria-pressed={speaking} onClick={speak} disabled={!supported} title={supported ? "Listen in a warm English voice" : "Speech is unavailable in this browser"}>
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{speaking ? <><path d="M8 5v14M16 5v14" /></> : <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>}</svg><span className="listen-label">{speaking ? "Stop" : "Listen"}</span>
  </button>{notice && <p className="audio-notice" role="status">{notice}</p>}</div>;
}
