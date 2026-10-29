import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import { isCalculationResponse } from "@/types/contractValidation";
import type { CalculationResponse } from "@/types/contract";
import m03Lines from "../../../../docs/examples/m03-lines-reading.response.json";
import m03Object from "../../../../docs/examples/m03-object-reading.response.json";
import m03Time from "../../../../docs/examples/m03-time-reading.response.json";
import m03Season from "../../../../docs/examples/m03-lines-season.response.json";
import d04Matched from "../../../../docs/examples/d04-wealth-matched.response.json";
import d04Missing from "../../../../docs/examples/d04-wealth-no-loc.response.json";
import d04Aliases from "../../../../docs/examples/d04-label-aliases.response.json";
import d04Leap from "../../../../docs/examples/d04-leap-lunar.response.json";
import d04Solar from "../../../../docs/examples/d04-solar-equivalent.response.json";
import legacyTamThe from "../../../../docs/examples/tam-the.response.json";

function mount(value: unknown) {
  if (!isCalculationResponse(value)) throw new Error("Invalid canonical fixture");
  render(<ResultPanel connection="connected" requestState={value.status === "COMPLETED" ? "completed" : "failed"} response={value} progress={[]} localError={null} />);
}
function reading(value: unknown) {
  if (!isCalculationResponse(value) || value.status !== "COMPLETED" || value.type !== "MAI_HOA" || !value.data.detailedReading) throw new Error("Expected canonical M03");
  return value.data.detailedReading;
}

describe("I02 real M03 result presentation", () => {
  it.each([["LINES", m03Lines], ["OBJECT_COUNT", m03Object], ["TIME", m03Time], ["LINES with season", m03Season]])("renders canonical %s with original hexagrams and ordered four-phase text", (_name, fixture) => {
    const original = JSON.stringify(fixture);
    mount(fixture);
    expect(screen.getAllByRole("figure")).toHaveLength(3);
    const section = within(screen.getByRole("region", { name: "Luận giải chi tiết Mai Hoa" }));
    const items = Array.from(section.getByRole("list", { name: "Bốn giai đoạn luận giải" }).children);
    expect(items.map(item => within(item as HTMLElement).getByRole("heading", { level: 3 }).textContent))
      .toEqual(["Ban đầu — Dụng", "Giữa — Hỗ Thể", "Giữa — Hỗ Dụng", "Cuối — Dụng sau biến"]);
    const detail = reading(fixture);
    detail.phases.forEach((phase, index) => {
      expect(items[index].textContent).toContain(phase.content);
      expect(within(items[index] as HTMLElement).getByText("Theo nguồn đã duyệt")).toBeTruthy();
      expect(within(items[index] as HTMLElement).getByText("Nguồn đã được đối chiếu")).toBeTruthy();
    });
    expect(section.getByRole("region", { name: "Tóm tắt luận giải" }).textContent).toContain(detail.summary);
    expect(section.getByRole("region", { name: "Thể từ Server" })).toBeTruthy();
    expect(section.getByRole("region", { name: "Dụng từ Server" })).toBeTruthy();
    expect(JSON.stringify(fixture)).toBe(original);
  });
  it("keeps aggregate team provenance separate from verified phases and typed reading decisions", () => {
    mount(m03Lines);
    const root = within(screen.getByRole("region", { name: "Căn cứ của phép tính" }));
    expect(root.getByText("Theo quy ước nhóm")).toBeTruthy();
    expect(root.getByText("Nguồn còn điểm cần đối chiếu")).toBeTruthy();
    const decisions = screen.getByRole("region", { name: "Quyết định tính toán của lời luận" });
    for (const decision of reading(m03Lines).calculationDecisions) {
      const code = within(decisions).getByText(decision.decisionId, { selector: "summary code" });
      fireEvent.click(code.closest("summary")!);
      const details = code.closest("details")!;
      expect(details.textContent).toContain(decision.description);
      expect(details.textContent).toContain(decision.limitation);
      expect(details.textContent).toContain(decision.policy);
      expect(within(details).getByText("Theo quy ước nhóm")).toBeTruthy();
    }
  });
  it("honestly leaves season unevaluated when no reading time was supplied", () => {
    mount(m03Lines);
    const section = within(screen.getByRole("region", { name: "Mùa và thời điểm luận" }));
    expect(section.getByText(/Chưa xét mùa vì chưa cung cấp thời điểm luận/)).toBeTruthy();
    expect(section.queryByText("Xuân")).toBeNull();
    expect(section.queryByText("Vượng theo quy ước mùa")).toBeNull();
  });
  it("renders evaluated season, original datetime and the returned strength", () => {
    mount(m03Time);
    const section = within(screen.getByRole("region", { name: "Mùa và thời điểm luận" }));
    expect(section.getByText("Xuân")).toBeTruthy();
    expect(section.getByText("Suy theo quy ước mùa")).toBeTruthy();
    const season = reading(m03Time).season;
    if (season.status !== "EVALUATED") throw new Error("Expected evaluated canonical fixture");
    expect(section.getByText(season.datetime)).toBeTruthy();
    expect(section.queryByText(/Chưa xét mùa/)).toBeNull();
  });
  it("rejects corrupted phase ordering through the existing runtime guard", () => {
    const invalid = structuredClone(m03Lines);
    invalid.data.detailedReading.phases.reverse();
    render(<ResultPanel connection="connected" requestState="completed" response={invalid as unknown as CalculationResponse} progress={[]} localError={null} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Luận giải chi tiết Mai Hoa" })).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
});

describe("I02 real D04 and legacy Tam The results", () => {
  it.each([["matched", d04Matched], ["no LOC", d04Missing], ["aliases", d04Aliases], ["leap lunar", d04Leap], ["solar equivalent", d04Solar]])("renders %s in Server order without duplicate flattened entries", (_name, fixture) => {
    const original = JSON.stringify(fixture);
    mount(fixture);
    const wealth = screen.getByRole("region", { name: "Kết quả Tài lộc" });
    expect(Array.from(wealth.querySelectorAll(".wealth-subreading h3")).map(h => h.textContent)).toEqual(["Lộc", "Sang hèn", "Điền sản"]);
    const category = fixture.data.categories.find(c => c.category === "WEALTH")!;
    expect(wealth.querySelectorAll(".interpretation-entry")).toHaveLength(category.entries.length);
    category.entries.forEach(entry => expect(within(wealth).getAllByText(entry.title, { selector: "h4" })).toHaveLength(1));
    expect(screen.getByText("Xử lý thành công")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(JSON.stringify(fixture)).toBe(original);
  });
  it("shows LOC no-match as a local source limitation, retaining other successful categories", () => {
    mount(d04Missing);
    const loc = screen.getByRole("region", { name: "Tiểu mục Lộc" });
    expect(loc.querySelectorAll(".interpretation-entry")).toHaveLength(0);
    expect(within(loc).getByText(/Bản in không có giao điểm Lộc/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Tiểu mục Sang hèn" }).querySelectorAll(".interpretation-entry")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Tiểu mục Điền sản" }).querySelectorAll(".interpretation-entry")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Kết quả Công danh" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Kết quả Tình duyên" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("preserves printed aliases and separates editorial decisions from verified content", () => {
    mount(d04Aliases);
    expect(screen.getByRole("heading", { name: "Thiên an / Phiên An" })).toBeTruthy();
    const root = within(screen.getByRole("region", { name: "Căn cứ nội dung Tam Thế" }));
    expect(root.getByText("Theo nguồn đã duyệt")).toBeTruthy();
    const editorial = screen.getByRole("region", { name: "Quyết định biên tập Tam Thế" });
    const decision = d04Aliases.data.editorialDecisions[0];
    const summary = within(editorial).getByText(decision.decisionId, { selector: "summary code" }).closest("summary")!;
    fireEvent.click(summary);
    expect(summary.closest("details")?.textContent).toContain(decision.limitation);
    expect(within(summary.closest("details")!).getByText("Nguồn còn điểm cần đối chiếu")).toBeTruthy();
  });
  it("keeps basic categories, original text and optional technical JSON accessible", () => {
    mount(legacyTamThe);
    expect(screen.getByText("Tra cứu cơ bản")).toBeTruthy();
    for (const title of ["Công danh", "Tài lộc", "Tình duyên"]) expect(screen.getByRole("region", { name: `Kết quả ${title}` })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Tiểu mục Lộc" })).toBeNull();
    expect(screen.getByText("Xem JSON phản hồi")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
