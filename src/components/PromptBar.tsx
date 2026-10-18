"use client";
/**
 * Adapted from React Bits Prompt Bar, installed with:
 * npx shadcn@latest add @react-bits/PromptBar-TS-CSS
 * Copyright (c) 2026 David Haz. MIT + Commons Clause.
 * Full license: public/licenses/react-bits.txt.
 * Child-focused adaptation: controlled one-line draft, no model picker,
 * sources, attachments, dictation, menus, canvas, or animation runtime.
 */
import type { FormEvent } from "react";
import "./PromptBar.css";

export interface PromptBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  sendDisabled?: boolean;
  busy?: boolean;
}
export default function PromptBar({ value, onChange, onSubmit, disabled, sendDisabled, busy }: PromptBarProps) {
  return <form className="prompt-bar" onSubmit={onSubmit} aria-label="Write to Buddy">
    <div className="prompt-bar__field">
      <label className="sr-only" htmlFor="chat-input">Your message to Buddy</label>
      <input id="chat-input" className="prompt-bar__input" name="message" placeholder="Tell Buddy…" value={value} onChange={event => onChange(event.target.value)} maxLength={200} autoComplete="off" disabled={disabled} aria-describedby="message-limit" />
      <div className="prompt-bar__footer">
        <span className="prompt-bar__hint" id="message-limit">{value.length > 0 ? `${value.length}/200` : "Type or tap above"}</span>
        <button className="prompt-bar__send" type="submit" aria-label="Send message" disabled={sendDisabled || !value.trim()} data-armed={!!value.trim() && !sendDisabled || undefined}>
          <svg className="prompt-bar__glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={busy ? "M7 7h10v10H7Z" : "M12 4.5L18.5 11H14.25V19.5H9.75V11H5.5Z"} /></svg>
        </button>
      </div>
    </div>
  </form>;
}
