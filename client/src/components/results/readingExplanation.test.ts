import { describe, expect, it } from "vitest";
import type { DetailedReading, ReadingPhase } from "@/types/readingContract";
import { explainReadingPhase } from "./readingExplanation";
import sourceReadings from "../../../../data/m01_reviewed_readings.json";
import canonical from "../../../../docs/examples/m03-lines-reading.response.json";

function phaseFor(template: typeof sourceReadings.maiHoaTemplates[number]): ReadingPhase {
  return {
    ...canonical.data.detailedReading.phases[0],
    relation: template.relation,
    templateCode: template.code,
    content: template.content,
  } as ReadingPhase;
}

describe("plain language for reviewed Mai Hoa templates", () => {
  it.each(sourceReadings.maiHoaTemplates)("explains the exact reviewed $code without mutating it", template => {
    const phase = phaseFor(template);
    const original = JSON.stringify(phase);
    const result = explainReadingPhase(template.topic as DetailedReading["topic"], phase);
    expect(result).toBeTruthy();
    expect(result).not.toMatch(/Thể|Dụng|tỷ hòa|tiết khí|quái/);
    expect(result).not.toMatch(/chắc chắn|tháng tới|\d+%/);
    expect(JSON.stringify(phase)).toBe(original);
  });

  it.each(["content", "templateCode", "topic", "relation"])("does not invent an explanation when %s differs from the reviewed template", field => {
    const phase = phaseFor(sourceReadings.maiHoaTemplates[0]);
    if (field === "content") phase.content += " Nội dung bổ sung.";
    if (field === "templateCode") phase.templateCode += "-V2";
    if (field === "relation") phase.relation = "USE_CONTROLS_BODY";
    expect(explainReadingPhase(field === "topic" ? "WEALTH" : "GENERAL", phase)).toBeNull();
  });

  it("retains topic-specific qualifications instead of reducing every relation to good or bad", () => {
    function text(code: string) {
      const template = sourceReadings.maiHoaTemplates.find(item => item.code === code)!;
      return explainReadingPhase(template.topic as DetailedReading["topic"], phaseFor(template));
    }
    expect(text("MH-WEALTH-BODY_CONTROLS_USE")).toContain("khả năng");
    expect(text("MH-CAREER-BODY_CONTROLS_USE")).toContain("chậm");
    expect(text("MH-LOVE-BODY_CONTROLS_USE")).toContain("chậm");
    expect(text("MH-LOVE-BODY_CONTROLS_USE")).toContain("hôn nhân");
    expect(text("MH-CAREER-BODY_GENERATES_USE")).toContain("hoặc");
    expect(text("MH-WEALTH-BODY_GENERATES_USE")).toContain("hao tổn");
  });
});
