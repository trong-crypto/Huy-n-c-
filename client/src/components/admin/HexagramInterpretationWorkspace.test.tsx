import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { InterpretationSource, InterpretationState } from "@/services/rest/hexagramInterpretations";
import { RestError } from "@/services/rest/transport";
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
    ...draft, version: 2, status: "PUBLISHED", publishedVersion: 2, latest: { ...draft.latest, version: 2, sources: [source] }, revisions: [2, 1],
  });
  render(<HexagramInterpretationWorkspace code={code} lines={lines} />);
  const save = await screen.findByRole<HTMLButtonElement>("button", { name: "Lưu và cập nhật" });
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await waitFor(() => expect(fixtures.save).toHaveBeenCalledWith(code, 1, content, [source.id], "test-csrf", expect.any(AbortSignal)));
  expect(await screen.findByText("Đã lưu và cập nhật luận giải.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Gửi duyệt" })).toBeNull();
  expect(save.disabled).toBe(true);
});

it("keeps entered content when direct publication rejects an unverified source", async () => {
  fixtures.load.mockResolvedValue({
    ...draft, status: "PENDING_REVIEW", sources: [{ ...source, reviewStatus: "SOURCE_LOCATED" }],
  });
  fixtures.save.mockRejectedValueOnce(new RestError("INVALID_SOURCE"));
  render(<HexagramInterpretationWorkspace code={code} lines={lines} />);
  const overview = await screen.findByLabelText<HTMLTextAreaElement>("Ý nghĩa tổng quan");
  fireEvent.change(overview, { target: { value: "Bản sửa chưa công bố" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu và cập nhật" }));
  expect((await screen.findByRole("alert")).textContent).toContain("nguồn đã xác minh");
  expect(overview.value).toBe("Bản sửa chưa công bố");
  expect(fixtures.save).toHaveBeenCalledTimes(1);
});

it("adds, edits and removes an optional poem through direct publication", async () => {
  const existing = { ...draft, latest: { ...draft.latest!, sources: [source] } };
  fixtures.load.mockResolvedValue(existing);
  const poem = { title: "Bài thơ", body: "Dòng một\n\nDòng hai", author: "Nhóm biên soạn", source: "Ghi chú nguồn" };
  const amended = { ...poem, title: "Bài thơ đã sửa" };
  fixtures.save.mockResolvedValueOnce({ ...existing, version: 2, latest: { ...existing.latest, content: { ...content, poem } } });
  fixtures.save.mockResolvedValueOnce({ ...existing, version: 3, latest: { ...existing.latest, content: { ...content, poem: amended } } });
  fixtures.save.mockResolvedValueOnce({ ...existing, version: 4 });
  render(<HexagramInterpretationWorkspace code={code} lines={lines} />);

  fireEvent.click(await screen.findByRole("button", { name: "Thêm bài thơ" }));
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "Lưu và cập nhật" });
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Tiêu đề bài thơ"), { target: { value: poem.title } });
  fireEvent.change(screen.getByLabelText("Nội dung bài thơ"), { target: { value: poem.body } });
  fireEvent.change(screen.getByLabelText("Tác giả hoặc đơn vị biên soạn"), { target: { value: poem.author } });
  fireEvent.change(screen.getByLabelText("Nguồn tham khảo bài thơ (tùy chọn)"), { target: { value: poem.source } });
  fireEvent.click(save);
  await waitFor(() => expect(save.disabled).toBe(true));
  expect(fixtures.save).toHaveBeenNthCalledWith(1, code, 1, { ...content, poem }, [source.id], "test-csrf", expect.any(AbortSignal));

  fireEvent.change(screen.getByLabelText("Tiêu đề bài thơ"), { target: { value: amended.title } });
  fireEvent.click(save);
  await waitFor(() => expect(save.disabled).toBe(true));
  expect(fixtures.save).toHaveBeenNthCalledWith(2, code, 2, { ...content, poem: amended }, [source.id], "test-csrf", expect.any(AbortSignal));

  fireEvent.click(screen.getByRole("button", { name: "Xóa bài thơ" }));
  fireEvent.click(save);
  await waitFor(() => expect(save.disabled).toBe(true));
  expect(fixtures.save).toHaveBeenNthCalledWith(3, code, 3, { ...content, poem: null }, [source.id], "test-csrf", expect.any(AbortSignal));
  expect(screen.getByText("Chưa có bài thơ.")).toBeTruthy();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Ý nghĩa tổng quan").value).toBe(content.overview);
});
