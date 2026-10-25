import type { MaiHoaPayload, SixLines } from "@/types/contract";

export type LinesPayload = Extract<MaiHoaPayload, { method: "LINES" }>;
export type LinesErrors = { lines?: string; movingLine?: string };

// Input validation/whitelisting only. No result DTO, network or book calculations.
export function buildLinesPayload(lines: readonly unknown[], movingLine: unknown):
  { ok: true; payload: LinesPayload } | { ok: false; errors: LinesErrors } {
  const errors: LinesErrors = {};
  if (lines.length !== 6 || Array.from(lines).some(line => typeof line !== "boolean")) {
    errors.lines = "Chọn Âm hoặc Dương cho đủ sáu hào.";
  }
  if (typeof movingLine !== "number" || !Number.isInteger(movingLine) || movingLine < 1 || movingLine > 6) {
    errors.movingLine = "Chọn một hào động từ 1 đến 6.";
  }
  if (errors.lines || errors.movingLine) return { ok: false, errors };
  return { ok: true, payload: { method: "LINES", linesBottomUp: [...lines] as SixLines, movingLine: movingLine as number } };
}
