import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import linesFixture from "../../../../docs/examples/mai-hoa-lines.response.json";
import objectFixture from "../../../../docs/examples/mai-hoa-object-count.response.json";
import timeFixture from "../../../../docs/examples/mai-hoa-time.response.json";
import unavailable from "../../../../docs/examples/rule-not-available.response.json";
import tamTheUnavailable from "../../../../docs/examples/tam-the-unavailable.response.json";
import { ResultPanel } from "@/components/ResultPanel";
import { isCalculationResponse } from "@/types/contractValidation";
import type { CalculationResponse, SourceReference } from "@/types/contract";
import type { RequestState } from "@/services/websocket/useCalculation";
import { DecisionReferences, SourceReferences } from "./Evidence";

function official(value: unknown) {
  if (!isCalculationResponse(value) || value.status !== "COMPLETED" || value.type !== "MAI_HOA") throw new Error("Invalid official fixture");
  return value;
}
const lines = official(linesFixture);
const objects = official(objectFixture);
function mount(value: unknown = lines, requestState: RequestState = "completed") {
  return render(<ResultPanel connection="connected" requestState={requestState} response={value as CalculationResponse} progress={[]} localError={null} />);
}
function section(title: string) { return within(screen.getByRole("heading", { name: title }).closest("section")!); }

describe("validated Mai Hoa result presentation", () => {
  it.each([["LINES", linesFixture], ["OBJECT_COUNT", objectFixture]])("accepts the official %s response without a parallel decoder", (_name, fixture) => {
    expect(isCalculationResponse(fixture)).toBe(true);
    mount(fixture);
    expect(screen.getAllByRole("figure")).toHaveLength(3);
  });
  it("renders three independent Server hexagrams in bottom-up data/top-down visual order without mutation", () => {
    const response = structuredClone(lines);
    const original = JSON.stringify(response);
    [response.data.primaryHexagram, response.data.mutualHexagram, response.data.changedHexagram].forEach(hex => Object.freeze(hex.linesBottomUp));
    mount(response);
    const expected = [response.data.primaryHexagram, response.data.mutualHexagram, response.data.changedHexagram];
    ["Quẻ chủ", "Quẻ hỗ", "Quẻ biến"].forEach((role, i) => {
      const card = within(screen.getByRole("figure", { name: role }));
      expect(card.getByText(expected[i].name!)).toBeTruthy();
      expect(card.getByText(expected[i].code!)).toBeTruthy();
      const rows = card.getAllByRole("listitem");
      expect(rows.map(row => row.getAttribute("data-line-number"))).toEqual(["6", "5", "4", "3", "2", "1"]);
      expect(rows.map(row => Boolean(row.querySelector(".line-mark--yang")))).toEqual([...expected[i].linesBottomUp].reverse());
    });
    expect(JSON.stringify(response)).toBe(original);
  });
  it.each([1, 2, 6])("marks only primary movingLine=%i, never mutual/changed", movingLine => {
    const response = structuredClone(lines); response.data.movingLine = movingLine;
    mount(response);
    const primary = within(screen.getByRole("figure", { name: "Quẻ chủ" }));
    expect(primary.getByText("↔ Hào động").closest("li")?.getAttribute("data-line-number")).toBe(String(movingLine));
    expect(within(screen.getByRole("figure", { name: "Quẻ hỗ" })).queryByText("↔ Hào động")).toBeNull();
    expect(within(screen.getByRole("figure", { name: "Quẻ biến" })).queryByText("↔ Hào động")).toBeNull();
    expect(screen.getByRole("region", { name: "Hào động của quẻ chủ" }).textContent).toContain(`Hào động: ${movingLine}`);
  });
  it.each(["VERIFIED", "SOURCE_LOCATED", null] as const)("does not invent a missing name/code for nameStatus=%s", nameStatus => {
    const response = structuredClone(lines);
    response.data.primaryHexagram = { ...response.data.primaryHexagram, code: null, name: null, nameStatus };
    mount(response);
    const card = within(screen.getByRole("figure", { name: "Quẻ chủ" }));
    expect(card.queryByText("Ký tế")).toBeNull();
    expect(card.queryByText("H_KHAM_LY")).toBeNull();
    expect(card.getByText("Chưa có tên đã duyệt")).toBeTruthy();
  });
  it("rejects an unapproved supplied name instead of disguising an invalid DTO as success", () => {
    const response = structuredClone(lines) as unknown as { data: { primaryHexagram: { nameStatus: string } } };
    response.data.primaryHexagram.nameStatus = "SOURCE_LOCATED";
    mount(response);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
  it("keeps root calculation status independent from the three verified names", () => {
    mount(objects);
    const root = within(screen.getByRole("region", { name: "Căn cứ của phép tính" }));
    expect(root.getByText("Theo quy ước nhóm")).toBeTruthy();
    expect(root.getByText("Nguồn còn điểm cần đối chiếu")).toBeTruthy();
    expect(root.queryByText("Nguồn đã được đối chiếu")).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("căn cứ trong nguồn vẫn còn điểm cần đối chiếu");
    expect(screen.getAllByText("Tên quẻ đã được đối chiếu")).toHaveLength(3);
    expect(screen.getByText("Dự")).toBeTruthy(); expect(screen.getByText("Kiển")).toBeTruthy(); expect(screen.getByText("Giải")).toBeTruthy();
  });
  it("shows SOURCE_VERIFIED for the official LINES calculation without a team warning", () => {
    mount(lines);
    const root = within(screen.getByRole("region", { name: "Căn cứ của phép tính" }));
    expect(root.getByText("Theo nguồn đã duyệt")).toBeTruthy();
    expect(root.getByText("Nguồn đã được đối chiếu")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("renders each Server step/message/value separately from live progress", () => {
    mount(objects);
    const steps = within(screen.getByRole("list", { name: "Các bước tính từ Server" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    objects.data.calculationSteps.forEach((step, i) => {
      expect(within(steps[i]).getByText(step.message)).toBeTruthy();
      expect(within(steps[i]).getByText(step.code)).toBeTruthy();
    });
    expect(within(steps[0]).getByText("20")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tiến trình xử lý" })).toBeNull();
  });
  it("renders unknown step codes and arbitrary values safely as text", () => {
    const response = structuredClone(lines);
    response.data.calculationSteps = [{ code: "FUTURE_STEP", message: "<img src=x onerror=alert(1)>", values: JSON.parse('{"constructor":"<script>bad</script>","flag":false,"zero":0,"lines":[true,false]}') }];
    const { container } = mount(response);
    const steps = within(screen.getByRole("list", { name: "Các bước tính từ Server" }));
    expect(steps.getByText("FUTURE_STEP")).toBeTruthy();
    expect(steps.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(steps.getByText("constructor")).toBeTruthy();
    expect(steps.getByText("<script>bad</script>")).toBeTruthy();
    expect(steps.getByText("false")).toBeTruthy(); expect(steps.getByText("0")).toBeTruthy(); expect(steps.getByText("[true,false]")).toBeTruthy();
    expect(container.querySelector("script,img")).toBeNull();
  });
  it("renders exact aggregate source metadata with no invented name provenance or URL", () => {
    mount(lines);
    const sources = section("Nguồn tham chiếu");
    expect(sources.getAllByText("Mai Hoa Dịch Số")).toHaveLength(2);
    expect(sources.getByText("MH-QUE-HO-BIEN")).toBeTruthy();
    expect(sources.getByText("47")).toBeTruthy(); expect(sources.getByText("42")).toBeTruthy();
    expect(sources.getByText("46")).toBeTruthy(); expect(sources.getByText("41")).toBeTruthy();
    expect(sources.getAllByText(lines.data.sourceReferences[0].version)).toHaveLength(2);
    expect(sources.getAllByText(lines.data.sourceReferences[0].sha256!)).toHaveLength(2);
    expect(sources.queryAllByRole("link")).toHaveLength(0);
    expect(sources.getByText(/không phải chứng cứ riêng cho tên từng quẻ/)).toBeTruthy();
  });
  it("preserves each rule's own policy, version, basis and evidence", () => {
    mount(objects);
    const rules = section("Căn cứ từng quy tắc");
    const all = rules.getAllByText("MH-OBJECT-COUNT", { selector: "code" });
    const rule = within(all[0].closest("details")!);
    expect(rule.getByText("Thực thi theo quyết định nhóm")).toBeTruthy();
    expect(rule.getByText("Theo quy ước nhóm")).toBeTruthy();
    expect(rule.getByText("Phiên bản 1.0")).toBeTruthy();
    expect(rule.getByText("51")).toBeTruthy(); expect(rule.getByText("46")).toBeTruthy();
    expect(rule.getByText("DEC-20261022-MH-OBJECT-COUNT")).toBeTruthy();
  });
  it("omits an empty decisions section but renders all supplied decision fields as text", () => {
    const { unmount } = mount(lines);
    expect(screen.queryByRole("region", { name: "Quyết định nhóm của phép tính" })).toBeNull();
    unmount(); mount(objects);
    const region = within(screen.getByRole("region", { name: "Quyết định nhóm của phép tính" }));
    const decision = objects.data.decisionReferences[0];
    [decision.decisionId, decision.decidedAt, decision.document, decision.description].forEach(value => expect(region.getByText(value)).toBeTruthy());
    expect(region.queryAllByRole("link")).toHaveLength(0);
  });
  it.each([unavailable, tamTheUnavailable])("keeps official RULE_NOT_AVAILABLE failures outside the result renderer", response => {
    mount(response, "failed");
    expect(screen.getByText(/Lỗi Server RULE_NOT_AVAILABLE/)).toBeTruthy();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
  });
  it.each(["primaryHexagram", "mutualHexagram", "changedHexagram", "sourceReferences", "calculationSteps", "rules", "movingLine"])("rejects missing %s atomically with no fixture fallback", field => {
    const response = structuredClone(lines) as unknown as { data: Record<string, unknown> };
    delete response.data[field]; mount(response);
    expect(screen.getByRole("alert").textContent).toContain("không đúng hợp đồng");
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByText("Ký tế")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Nguồn tham chiếu" })).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
  it("rejects short line arrays instead of filling missing lines", () => {
    const response = structuredClone(lines); response.data.mutualHexagram.linesBottomUp.pop();
    mount(response); expect(screen.getByRole("alert")).toBeTruthy(); expect(screen.queryAllByRole("figure")).toHaveLength(0);
  });
  it.each(["waiting", "timeout", "failed"] as const)("never renders old success while request state is %s", state => {
    mount(lines, state); expect(screen.queryAllByRole("figure")).toHaveLength(0); expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
  it("keeps raw JSON secondary behind closed native technical details", () => {
    mount(lines);
    const summary = screen.getByText("Thông tin kỹ thuật", { selector: "summary" });
    expect(summary.closest("details")?.open).toBe(false);
    expect(screen.getByText(/"name": "Ký tế"/).closest("details")?.open).toBe(false);
    expect(screen.getAllByRole("figure")).toHaveLength(3);
  });
  it("routes the canonical TIME fixture through the existing three-hexagram presentation", () => {
    mount(timeFixture);
    expect(screen.getByText("MAI HOA DỊCH SỐ · Theo thời gian")).toBeTruthy();
    ["Bác", "Khôn", "Mông"].forEach((name, i) => expect(within(screen.getAllByRole("figure")[i]).getByText(name)).toBeTruthy());
    expect(screen.getByRole("region", { name: "Hào động của quẻ chủ" }).textContent).toContain("Hào động: 2");
    const lunar = within(screen.getByRole("region", { name: "Ngày âm từ Server" }));
    expect(lunar.getByRole("heading", { name: "Ngày âm: 01/01/2024" })).toBeTruthy();
    expect(lunar.getByText(/Tháng thường \(không nhuận\)/)).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Các bước tính từ Server" })).getAllByRole("listitem");
    expect(steps.map(step => step.querySelector("code")?.textContent)).toEqual(["TIME_NUMBERS", "MUTUAL", "CHANGE"]);
  });
  it("renders an alternate leap-month DTO without calculating a different date or hexagram", () => {
    const response = structuredClone(timeFixture);
    response.data.lunarDate = { year: 2023, month: 2, day: 1, isLeapMonth: true };
    Object.assign(response.data.calculationSteps[0].values, { lunarYear: 2023, lunarMonth: 2, lunarDay: 1, isLeapMonth: true });
    mount(response);
    const lunar = within(screen.getByRole("region", { name: "Ngày âm từ Server" }));
    expect(lunar.getByText("Ngày âm: 01/02/2023")).toBeTruthy();
    expect(lunar.getByText(/Tháng 2 nhuận/)).toBeTruthy();
    const first = within(within(screen.getByRole("list", { name: "Các bước tính từ Server" })).getAllByRole("listitem")[0]);
    expect(first.getByText("Có")).toBeTruthy();
  });
  it.each([linesFixture, objectFixture])("does not invent a lunar summary for $data.method", fixture => {
    mount(fixture);
    expect(screen.queryByRole("region", { name: "Ngày âm từ Server" })).toBeNull();
  });
  it("displays supported lunar year 1899 without replacing it with a Gregorian year", () => {
    const response = structuredClone(timeFixture);
    Object.assign(response.data.lunarDate, { year: 1899, month: 12, day: 1 });
    Object.assign(response.data.calculationSteps[0].values, { lunarYear: 1899, lunarMonth: 12, lunarDay: 1 });
    mount(response);
    expect(screen.getByRole("region", { name: "Ngày âm từ Server" }).textContent).toContain("01/12/1899");
  });
  it("renders all TIME value labels, one project-convention warning and the actual evidence", () => {
    mount(timeFixture);
    const first = within(within(screen.getByRole("list", { name: "Các bước tính từ Server" })).getAllByRole("listitem")[0]);
    for (const label of ["Năm âm", "Tháng âm", "Ngày âm", "Tháng nhuận", "Chỉ số Chi năm", "Chỉ số Chi giờ", "Tổng năm/tháng/ngày", "Tổng có giờ", "Số thượng quái", "Số hạ quái", "Hào động", "Múi giờ tính", "Mốc đổi ngày", "Quy ước tháng nhuận"]) {
      expect(first.getByText(label, { selector: "dt" })).toBeTruthy();
    }
    expect(first.getByText("Không")).toBeTruthy(); expect(first.getByText("Giữ cùng số tháng")).toBeTruthy();
    const basis = within(screen.getByRole("region", { name: "Căn cứ của phép tính" }));
    expect(basis.getByText("Theo quy ước nhóm")).toBeTruthy(); expect(basis.getByText("Nguồn đã được đối chiếu")).toBeTruthy();
    expect(screen.getAllByRole("note")).toHaveLength(1);
    expect(screen.getByRole("note").textContent).toContain("bản in còn khác biệt");
    const rules = section("Căn cứ từng quy tắc");
    expect(rules.getAllByText(/^Phiên bản 1.0$/)).toHaveLength(5);
    timeFixture.data.rules.forEach(rule => expect(rules.getByText(rule.ruleCode, { selector: "code" })).toBeTruthy());
    const decisions = within(screen.getByRole("region", { name: "Quyết định nhóm của phép tính" }));
    timeFixture.data.decisionReferences.forEach(decision => expect(decisions.getByText(decision.decisionId)).toBeTruthy());
    const sources = section("Nguồn tham chiếu");
    expect(sources.getByText("C01-VN-FIXED7")).toBeTruthy();
    expect(sources.getAllByText("Không cung cấp")).toHaveLength(2);
    expect(sources.getByRole("link").getAttribute("href")).toBe(timeFixture.data.sourceReferences[0].url);
  });
  it("escapes long TIME source/step text and preserves unknown safe value labels", () => {
    const response = structuredClone(timeFixture);
    const longText = "Nguồn lịch đã cung cấp ".repeat(30) + "<script>unsafe</script>";
    response.data.sourceReferences[0].section = longText;
    response.data.calculationSteps[0].message = longText;
    Object.assign(response.data.calculationSteps[0].values, { futureKey: "<img src=x onerror=bad()>" });
    const { container } = mount(response);
    expect(section("Nguồn tham chiếu").getByText(longText)).toBeTruthy();
    expect(screen.getByText("futureKey")).toBeTruthy();
    expect(screen.getByText("<img src=x onerror=bad()>")).toBeTruthy();
    expect(container.querySelector("script,img")).toBeNull();
  });
  it("rejects empty TAM_THE content instead of displaying partial success", () => {
    mount({ ...lines, type: "TAM_THE", data: { ruleVersion: "1.0", ruleBasis: "SOURCE_VERIFIED", sourceStatus: "VERIFIED", rules: [], sourceReferences: [], decisionReferences: [], categories: [] } });
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("không đúng hợp đồng");
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByText(/"categories":/)).toBeNull();
  });
});

describe("source and decision link boundaries", () => {
  const source: SourceReference = lines.data.sourceReferences[0];
  it("handles nullable pages/hash/url without fabricated metadata", () => {
    render(<SourceReferences sources={[{ ...source, printedPage: null, pdfPage: null, sha256: null, url: null }]} />);
    expect(screen.getAllByText("Không cung cấp")).toHaveLength(2);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText("Dấu vân tay tệp SHA-256")).toBeNull();
  });
  it("links exactly the supplied HTTPS URL", () => {
    const url = "https://example.org/source?edition=1#section";
    render(<SourceReferences sources={[{ ...source, url }]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(url);
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///tmp/source.pdf", "/fake-pdf?page=42", "not a url", "https://user:password@example.org"])("never activates unsafe or constructed URL %s", url => {
    render(<SourceReferences sources={[{ ...source, url }]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(`Địa chỉ được cung cấp (không mở liên kết): ${url}`)).toBeTruthy();
  });
  it("keeps arbitrary decision document strings as escaped text", () => {
    const { container } = render(<DecisionReferences decisions={[{ ...objects.data.decisionReferences[0], document: "javascript:<script>alert(1)</script>" }]} />);
    expect(screen.getByText("javascript:<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("a,script")).toBeNull();
  });
});
