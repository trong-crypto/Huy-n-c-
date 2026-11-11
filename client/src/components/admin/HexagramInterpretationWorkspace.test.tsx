import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { InterpretationSource, InterpretationState } from "@/services/rest/hexagramInterpretations";
import { HexagramInterpretationWorkspace } from "./HexagramInterpretationWorkspace";

const fixtures = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  session: { account: { id: "reviewer" }, csrfToken: "test-csrf" },
  handleError: vi.fn(),
}));
vi.mock("./AdminSessionGate", () => ({ useAdminSession: () => fixtures }));
vi.mock("@/services/rest/hexagramInterpretations", () => ({
  getInterpretationState: fixtures.load,
  saveInterpretation: fixtures.save,
}));

const code = "H_CAN_CAN";
const lines = [true, true, true, true, true, true];
const content = { overview: "Tổng quan", image: "", original: "", paraphrase: "", application: "", lines: Array(6).fill("") };
const source: InterpretationSource = {
  id: "ZHOUYI-H_CAN_CAN", title: "Chu Dịch", author: null, edition: "Bản đối chiếu",
  locator: "Càn", url: "https://example.org/can", reuseNote: "Văn bản cổ", reviewStatus: "VERIFIED",
};
const draft: InterpretationState = {
  code, version: 1, status: "DRAFT",
  latest: { version: 1, content, sources: [{ ...source, reviewStatus: "SOURCE_LOCATED" }], createdBy: "editor", createdAt: "2026-11-10T00:00:00Z" },
  publishedVersion: null, revisions: [1], sources: [source], reviewNote: null,
};

beforeEach(() => vi.clearAllMocks());

it("lets the editor save an updated source snapshot with unchanged text and source IDs", async () => {
  fixtures.load.mockResolvedValue(draft);
  fixtures.save.mockResolvedValue({
    ...draft, version: 2, latest: { ...draft.latest, version: 2, sources: [source] }, revisions: [2, 1],
  });
  render(<HexagramInterpretationWorkspace code={code} lines={lines} />);
  const save = await screen.findByRole<HTMLButtonElement>("button", { name: "Lưu bản nháp" });
  const submit = screen.getByRole<HTMLButtonElement>("button", { name: "Gửi duyệt" });
  expect(save.disabled).toBe(false);
  expect(submit.disabled).toBe(true);
  fireEvent.click(save);
  await waitFor(() => expect(fixtures.save).toHaveBeenCalledWith(code, 1, content, [source.id], "test-csrf", expect.any(AbortSignal)));
  await waitFor(() => expect(submit.disabled).toBe(false));
  expect(save.disabled).toBe(true);
});

it("blocks publication when a verified source has changed since the saved revision", async () => {
  fixtures.load.mockResolvedValue({
    ...draft, status: "PENDING_REVIEW", latest: { ...draft.latest, sources: [{ ...source, locator: "Càn, bản trước" }] },
  });
  render(<HexagramInterpretationWorkspace code={code} lines={lines} />);
  const note = await screen.findByLabelText("Ghi chú đối chiếu");
  fireEvent.change(note, { target: { value: "Đã xem bản biên soạn" } });
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Công bố luận giải" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Trả về bản nháp" }).disabled).toBe(false);
});
