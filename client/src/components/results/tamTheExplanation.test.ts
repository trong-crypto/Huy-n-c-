import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { InterpretationEntry, TamTheCategory } from "@/types/contract";
import { explainTamTheEntry } from "./tamTheExplanation";
import explanations from "./tamTheExplanations.json";
import d02 from "../../../../data/tam_the_d02_source.json";
import m01 from "../../../../data/m01_reviewed_readings.json";

const careerText = readFileSync(resolve(process.cwd(), "../data/tam_the_career13_texts.csv"), "utf8");
const jobTitles = { MUA_BAN: "Mua bán", CAU_CHAI: "Câu/chài lưới/đáy rọ/mua thủy lợi", LAM_THO: "Làm thợ" };
function entry(row: typeof explanations[number]): InterpretationEntry {
  return { resultCode: row.resultCode, title: "Original title is retained by the renderer", content: row.original, sourceReferences: [] };
}

describe("Tam The editorial reading aids", () => {
  it("covers 12 poems, 15 career entries and 31 wealth entries with unique identities", () => {
    expect(explanations).toHaveLength(58);
    expect(new Set(explanations.map(row => row.resultCode)).size).toBe(58);
    expect(explanations.filter(row => row.category === "LOVE")).toHaveLength(12);
    expect(explanations.filter(row => row.category === "CAREER")).toHaveLength(15);
    expect(explanations.filter(row => row.category === "WEALTH")).toHaveLength(31);
  });
  it.each(explanations)("only explains exact source text for $resultCode without mutating it", row => {
    const input = entry(row);
    const original = JSON.stringify(input);
    const result = explainTamTheEntry(row.category as TamTheCategory, input);
    expect(result?.meaning).toBe(row.meaning);
    expect(row.meaning.length).toBeGreaterThan(30);
    if (row.resultCode.startsWith("LOVE_C")) {
      const index = Number(row.resultCode.slice(-2)) - 1;
      expect(row.original).toBe(d02.love.passages[index].text);
      expect(result?.couplets?.map(c => c.lines)).toEqual(["1–2", "3–4", "5–6", "7–8"]);
      expect(result?.couplets?.every(c => c.meaning.length > 25)).toBe(true);
    } else if (row.resultCode.startsWith("WEALTH_C")) {
      expect(row.original).toBe(d02.wealth.passages[Number(row.resultCode.slice(-2)) - 1].text);
    } else if (row.resultCode.startsWith("TT-")) {
      expect(row.original).toBe(m01.tamTheResults.find(item => item.code === row.resultCode)?.content);
    } else if (row.resultCode.startsWith("CAREER13_")) {
      const csvRow = careerText.split(/\r?\n/).find(line => line.includes(`,${row.resultCode},`));
      expect(csvRow).toContain(`"${row.original.replaceAll('"', '""')}"`);
    } else {
      expect(row.original).toBe(`Bảng Số 11 ghi nghề: ${jobTitles[row.resultCode as keyof typeof jobTitles]}.`);
    }
    expect(JSON.stringify(input)).toBe(original);
  });
  it.each(["code", "content", "category"])("leaves unknown or revised %s without a fabricated explanation", changed => {
    const source = explanations.find(row => row.resultCode === "LOVE_C05")!;
    const input = entry(source);
    if (changed === "code") input.resultCode = "LOVE_NEW";
    if (changed === "content") input.content += " Nội dung mới.";
    expect(explainTamTheEntry(changed === "category" ? "CAREER" : "LOVE", input)).toBeNull();
  });
  it("does not silently resolve unclear wording, source aliases or claims of bodily harm", () => {
    const byCode = (code: string) => explanations.find(row => row.resultCode === code)!;
    expect(byCode("LOVE_C05").couplets?.[2].meaning).toContain("chưa rõ nghĩa");
    expect(byCode("WEALTH_C01").meaning).toContain("[CHU_MO]");
    expect(byCode("TT-DIEN-SAN-06").meaning).toContain("quyết định biên tập");
    expect(byCode("CAREER13_C10").meaning).toContain("không có nghĩa người dùng sẽ bị tật");
    expect(byCode("LOVE_C08").couplets?.[2].meaning).toContain("Không dùng lời này để kết luận");
  });
});
