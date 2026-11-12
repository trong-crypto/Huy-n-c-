import type { AiReadingRef } from "@/config/aiConsultation";
import { isRecord } from "@/types/contractValidation";
import { customerOptions } from "./customerAuth";
import { requestJson } from "./transport";

type Mode = "demo" | "live";
type Availability = { mode: Mode | "off" };
export type AiTurn = { question: string; answer: string };
type AiSource = { title: string; section: string; printedPage: string; pdfPage: number | null; url?: string | null };
type AiHexagram = { code: string; name: string; nameStatus: string };
type ReadingFacts = {
  method: string; primary: AiHexagram; mutual: AiHexagram; changed: AiHexagram; movingLine: number;
  sourceStatus: string; ruleBasis: string;
};
type TamTheFacts = { type: "TAM_THE"; categories: string[]; sourceStatus: string; ruleBasis: string };
export type AiAnswer = { answer: string; mode: Mode; sources: AiSource[]; reading: ReadingFacts | TamTheFacts | null };

function isAvailability(value: unknown): value is Availability {
  return isRecord(value) && (value.mode === "demo" || value.mode === "live" || value.mode === "off");
}

function isSource(value: unknown): value is AiSource {
  return isRecord(value) && typeof value.title === "string" && typeof value.section === "string"
    && typeof value.printedPage === "string"
    && (value.url == null || typeof value.url === "string" && isHttpsSource(value.url))
    && (value.pdfPage === null || typeof value.pdfPage === "number" && Number.isInteger(value.pdfPage) && value.pdfPage > 0);
}

function isHttpsSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isHexagram(value: unknown): value is AiHexagram {
  return isRecord(value) && typeof value.code === "string" && typeof value.name === "string" && typeof value.nameStatus === "string";
}

function isReading(value: unknown): value is ReadingFacts | TamTheFacts {
  if (!isRecord(value) || typeof value.sourceStatus !== "string" || typeof value.ruleBasis !== "string") return false;
  if (value.type === "TAM_THE") return Array.isArray(value.categories) && value.categories.length > 0
    && value.categories.every(item => ["Công danh", "Tài lộc", "Tình duyên"].includes(item));
  return typeof value.method === "string" && isHexagram(value.primary)
    && isHexagram(value.mutual) && isHexagram(value.changed) && typeof value.movingLine === "number"
    && Number.isInteger(value.movingLine) && value.movingLine >= 1 && value.movingLine <= 6;
}

function isAnswer(value: unknown): value is AiAnswer {
  return isRecord(value) && typeof value.answer === "string" && value.answer.trim().length > 0
    && (value.mode === "demo" || value.mode === "live") && Array.isArray(value.sources) && value.sources.every(isSource)
    && (value.reading === null || isReading(value.reading));
}

export function getAiAvailability(signal: AbortSignal) {
  return requestJson("/ai/status", isAvailability, signal);
}

export function askAi(question: string, turns: AiTurn[], reading: AiReadingRef | undefined, csrf: string, signal: AbortSignal) {
  const options = customerOptions();
  return requestJson("/ai/ask", isAnswer, signal, { question, turns, ...reading }, {
    ...options, headers: { ...options.headers, "X-CSRF-Token": csrf }, timeoutMs: 65_000,
  });
}
