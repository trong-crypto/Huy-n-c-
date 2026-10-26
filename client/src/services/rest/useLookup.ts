"use client";

import { useEffect, useState } from "react";
type LookupState<T> = { status: "loading"; data: null; error: null }
  | { status: "completed"; data: T; error: null } | { status: "failed"; data: null; error: unknown };

export function useLookup<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [stored, setStored] = useState<{ key: string; attempt: number; result: LookupState<T> } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    load(controller.signal).then(data => {
      if (active) setStored({ key, attempt, result: { status: "completed", data, error: null } });
    }, error => {
      if (active) setStored({ key, attempt, result: { status: "failed", data: null, error } });
    });
    // Guard even a fetch implementation that ignores abort; settle only this effect's request.
    return () => { active = false; controller.abort(); };
  }, [key, load, attempt]);
  const state: LookupState<T> = stored?.key === key && stored.attempt === attempt ? stored.result : { status: "loading", data: null, error: null };
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
