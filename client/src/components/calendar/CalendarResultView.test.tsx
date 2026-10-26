import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import fixture from "../../../../docs/examples/calendar-convert.response.json";
import request from "../../../../docs/examples/calendar-convert.request.json";
import can from "../../../../docs/examples/calendar-can-chi.response.json";
import timed from "../../../../docs/examples/calendar-can-chi.request.json";
import type { CalendarInput, CalendarResult, CanChiResult } from "@/types/contract";
import { CalendarResultView } from "./CalendarResultView";

describe("C01 source-backed result presentation", () => {
  it("preserves source URL/version/status without fabricating book pages", () => {
    render(<CalendarResultView data={fixture.data as CalendarResult} input={{ date: request as CalendarInput }} />);
    const summary = screen.getByText("Nguồn và quy tắc lịch", { exact: true }); fireEvent.click(summary);
    expect(screen.getAllByText("Không cung cấp", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Mở nguồn tham chiếu ↗" }).every(link => link.getAttribute("href") === fixture.data.sourceReferences[0].url)).toBe(true);
    expect(summary.closest("details")?.textContent).toContain(fixture.data.sourceReferences[0].version);
    expect(screen.getAllByText("Theo nguồn đã duyệt", { exact: true })).toHaveLength(2);
  });
  it("does not promote a team decision and preserves actual returned decision text", () => {
    const decision = { decisionId: "DISPLAY-ONLY-TEST", decidedAt: "2026-10-26", document: "test", description: "Test limitation" };
    render(<CalendarResultView data={{ ...fixture.data, ruleBasis: "TEAM_DECISION", sourceStatus: "SOURCE_AMBIGUOUS", decisionReferences: [decision] } as CalendarResult} input={{ date: request as CalendarInput }} />);
    expect(screen.getByText("Theo quy ước nhóm", { exact: true })).toBeTruthy();
    expect(screen.getByText("Nguồn còn điểm cần đối chiếu", { exact: true })).toBeTruthy(); fireEvent.click(screen.getByText("Nguồn và quy tắc lịch", { exact: true }));
    expect(screen.getByText(decision.description, { exact: true })).toBeTruthy();
  });
  it("does not confuse Chi TI with TY", () => {
    render(<CalendarResultView data={{ ...can.data, hour: { stem: "GIAP", branch: "TI" } } as CanChiResult} input={timed as { date: CalendarInput; time: string }} />);
    expect(screen.getByText("Giáp Tỵ", { exact: true })).toBeTruthy(); expect(screen.queryByText("Giáp Tý", { exact: true })).toBeNull();
  });
});
