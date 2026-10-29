import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import fixture from "../../../../docs/examples/mai-hoa-lines.response.json";
import { isCalculationResponse } from "@/types/contractValidation";
import { HexagramView, LineMark } from "./HexagramView";
import type { MaiHoaResult, SourceStatus } from "@/types/contract";

if (!isCalculationResponse(fixture) || fixture.status !== "COMPLETED" || fixture.type !== "MAI_HOA") throw new Error("Invalid official fixture");
const data: MaiHoaResult = fixture.data;
const quẻ = data.primaryHexagram;

describe("pure HexagramView", () => {
  it("renders official asymmetric data as Hào 6 down to Hào 1 without mutation", () => {
    const lines = Object.freeze([...quẻ.linesBottomUp]) as Readonly<typeof quẻ.linesBottomUp>;
    const before = [...lines];
    render(<HexagramView roleLabel="Quẻ chủ" {...quẻ} linesBottomUp={lines} />);
    const rows = within(screen.getByRole("list", { name: "Sáu hào của Quẻ chủ" })).getAllByRole("listitem");
    expect(rows.map(row => row.getAttribute("data-line-number"))).toEqual(["6", "5", "4", "3", "2", "1"]);
    expect(rows.map(row => row.textContent)).toEqual(["Hào 6 — Âm", "Hào 5 — Dương", "Hào 4 — Âm", "Hào 3 — Dương", "Hào 2 — Âm", "Hào 1 — Dương"]);
    expect(lines).toEqual(before);
    expect(screen.getByText("Ký tế")).toBeTruthy();
    expect(screen.getByText("H_KHAM_LY")).toBeTruthy();
  });
  it.each([true, false])("renders %j as one solid/two broken segments with decorative semantics", yang => {
    const { container } = render(<LineMark yang={yang} />);
    const mark = container.firstElementChild!;
    expect(mark.classList.contains(yang ? "line-mark--yang" : "line-mark--yin")).toBe(true);
    expect(mark.children).toHaveLength(yang ? 1 : 2);
    expect(mark.getAttribute("aria-hidden")).toBe("true");
  });
  it.each([1, 2, 6])("marks only explicitly supplied movingLine %i", movingLine => {
    render(<HexagramView roleLabel="Quẻ chủ" {...quẻ} movingLine={movingLine} />);
    const marker = screen.getByText("↔ Hào động");
    expect(marker.closest("li")?.getAttribute("data-line-number")).toBe(String(movingLine));
    expect(screen.getAllByText("↔ Hào động")).toHaveLength(1);
  });
  it("never supplies moving markers to any hexagram implicitly", () => {
    render(<><HexagramView roleLabel="Quẻ chủ" {...quẻ} /><HexagramView roleLabel="Quẻ hỗ" {...data.mutualHexagram} /><HexagramView roleLabel="Quẻ biến" {...data.changedHexagram} /></>);
    expect(screen.queryByText("↔ Hào động")).toBeNull();
    expect(screen.getAllByRole("figure")).toHaveLength(3);
  });
  it("handles null names and codes without deriving identity", () => {
    render(<HexagramView roleLabel="Quẻ chủ" linesBottomUp={quẻ.linesBottomUp} name={null} code={null} nameStatus={null} />);
    expect(screen.queryByText("Ký tế")).toBeNull();
    expect(screen.queryByText("H_KHAM_LY")).toBeNull();
    expect(screen.getByText("Chưa có tên đã duyệt")).toBeTruthy();
  });
  it.each<SourceStatus | null>(["DRAFT", "SOURCE_LOCATED", "SOURCE_AMBIGUOUS", "BLOCKED_SOURCE_CONFLICT", null])("hides a supplied name when status is %s", nameStatus => {
    render(<HexagramView roleLabel="Quẻ chủ" linesBottomUp={quẻ.linesBottomUp} name="Unapproved" nameStatus={nameStatus} />);
    expect(screen.queryByText("Unapproved")).toBeNull();
  });
  it("does not invent a name for VERIFIED/null", () => {
    render(<HexagramView roleLabel="Quẻ chủ" {...quẻ} name={null} />);
    expect(screen.getByText("Chưa có tên đã duyệt")).toBeTruthy();
  });
});
