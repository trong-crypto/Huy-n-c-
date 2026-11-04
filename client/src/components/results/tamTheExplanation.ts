import type { InterpretationEntry, TamTheCategory } from "@/types/contract";
import explanations from "./tamTheExplanations.json";

type TextExplanation = {
  category: string;
  resultCode: string;
  original: string;
  meaning: string;
  couplets?: { lines: string; meaning: string }[];
};

// These are Client editorial reading aids, not additional verified source text.
// Do not apply an older explanation to revised Server wording or another category.
export function explainTamTheEntry(category: TamTheCategory, entry: InterpretationEntry): TextExplanation | null {
  const records: readonly TextExplanation[] = explanations;
  return records.find(record => record.category === category && record.resultCode === entry.resultCode
    && record.original === entry.content) ?? null;
}
