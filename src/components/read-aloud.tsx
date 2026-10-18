"use client";
import { useEffect, useRef, useState } from "react";
let stopCurrent: (() => void) | undefined;

export default function ReadAloud({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => { if (utterance.current) { window.speechSynthesis?.cancel(); utterance.current = null; } };
  }, []);
  function speak() {
    if (!supported) return;
    if (speaking) { utterance.current = null; setSpeaking(false); window.speechSynthesis.cancel(); return; }
    stopCurrent?.();
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const english = voices.find(voice => voice.localService && /^en(?:-|_)/i.test(voice.lang)) ?? voices.find(voice => /^en(?:-|_)/i.test(voice.lang));
    if (!english && voices.length > 0) { setNotice("English audio is not ready here. A grown-up can read with you."); return; }
    const next = new SpeechSynthesisUtterance(text);
    next.lang = english?.lang ?? "en-US";
    if (english) next.voice = english;
    next.rate = 0.78; next.pitch = 1.05; next.volume = 1;
    next.onend = () => { utterance.current = null; setSpeaking(false); };
    next.onerror = event => { if (utterance.current !== next) return; utterance.current = null; setSpeaking(false); if (event.error !== "canceled" && event.error !== "interrupted") setNotice("Audio needs a little rest. Try again."); };
    stopCurrent = () => { utterance.current = null; setSpeaking(false); };
    utterance.current = next; setNotice(""); setSpeaking(true);
    window.speechSynthesis.speak(next);
  }
  return <div className="read-aloud"><button className="listen-button" type="button" aria-label={speaking ? "Stop reading Buddy's message" : "Listen to Buddy's message"} aria-pressed={speaking} onClick={speak} disabled={!supported} title={supported ? "Listen in English" : "Speech is unavailable in this browser"}>
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{speaking ? <><path d="M8 5v14M16 5v14" /></> : <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>}</svg><span className="listen-label">{speaking ? "Stop" : "Listen"}</span>
  </button>{notice && <p className="audio-notice" role="status">{notice}</p>}</div>;
}
