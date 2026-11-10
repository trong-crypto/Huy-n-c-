"use client";

import type { ReactNode } from "react";
import styles from "./chat.module.css";

export function ChatIcon({ kind = "chat" }: { kind?: "chat" | "send" | "plus" | "spark" }) {
  const paths = {
    chat: "M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5ZM9 11.5h.01m3.5 0h.01m3.5 0h.01",
    send: "m4 5 16 7-16 7 3-7-3-7Zm3 7h13",
    plus: "M12 5v14M5 12h14",
    spark: "M12 3c.7 5.1 2.9 7.3 8 8-5.1.7-7.3 2.9-8 8-.7-5.1-2.9-7.3-8-8 5.1-.7 7.3-2.9 8-8Zm6.5 12v5m-2.5-2.5h5",
  };
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export function ChatComposer({ id, label, value, onChange, onSend, disabled, readOnly, sendDisabled, sendLabel,
  placeholder, maxLength, invalid, hint, error, children }: {
  id: string; label: string; value: string; onChange: (text: string) => void; onSend: () => void;
  disabled?: boolean; readOnly?: boolean; sendDisabled?: boolean; sendLabel: string; placeholder: string;
  maxLength?: number; invalid?: boolean; hint?: ReactNode; error?: ReactNode; children?: ReactNode;
}) {
  return <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (!disabled && !sendDisabled) onSend(); }}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <div className={styles.composerRow}>
      <textarea id={id} rows={1} value={value} maxLength={maxLength} placeholder={placeholder}
        disabled={disabled} readOnly={readOnly} aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          if (!disabled && !sendDisabled) event.currentTarget.form?.requestSubmit();
        }} />
      <button type="submit" className={styles.send} aria-label={sendLabel} title={sendLabel}
        disabled={disabled || sendDisabled}><ChatIcon kind="send" /></button>
    </div>
    <div className={styles.composerFoot}>
      <p id={`${id}-hint`}>{hint}</p>
      {children}
    </div>
    {error && <p role="alert" id={`${id}-error`} className="field-error">{error}</p>}
  </form>;
}
