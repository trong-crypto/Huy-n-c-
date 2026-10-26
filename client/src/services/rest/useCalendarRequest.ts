"use client";
import { useEffect, useRef, useState } from "react";
import { calculateCanChi, convertCalendar, type CalendarOutput, type CalendarSubmission } from "./calendar";

type State = { status: "idle" | "loading"; data: null; input: null; error: null }
  | { status: "completed"; data: CalendarOutput; input: CalendarSubmission; error: null }
  | { status: "failed"; data: null; input: null; error: unknown };
const idle: State = { status: "idle", data: null, input: null, error: null };
export function useCalendarRequest(kind: "convert" | "can-chi") {
  const [state, setState] = useState<State>(idle);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  function cancel() { generation.current++; pending.current?.abort(); pending.current = null; }
  useEffect(() => () => { generation.current++; pending.current?.abort(); }, []);
  function clear() { cancel(); setState(idle); }
  function submit(input: CalendarSubmission) {
    if (pending.current !== null) return;
    const snapshot = { date: { ...input.date }, ...(input.time === undefined ? {} : { time: input.time }) };
    const id = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    setState({ status: "loading", data: null, input: null, error: null });
    const request = kind === "convert" ? convertCalendar(snapshot.date, controller.signal) : calculateCanChi(snapshot, controller.signal);
    request.then(data => {
      if (generation.current === id) setState({ status: "completed", data, input: snapshot, error: null });
    }, error => {
      if (generation.current === id) setState({ status: "failed", data: null, input: null, error });
    }).finally(() => { if (generation.current === id) pending.current = null; });
  }
  return { ...state, clear, submit };
}
