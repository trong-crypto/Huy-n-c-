import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import { isCalculationResponse } from "@/types/contractValidation";
import linesResponse from "../../../../docs/examples/mai-hoa-lines.response.json";
import { PublishedInterpretation } from "./PublishedInterpretation";
import tamTheResponse from "../../../../docs/examples/tam-the-love.response.json";
import { readReadingHandoff } from "@/components/chat/readingHandoff";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/config/client", async importOriginal => {
  const original = await importOriginal<typeof import("@/config/client")>();
  return { ...original, CLIENT_CONFIG: { ...original.CLIENT_CONFIG, hexagramInterpretations: true, accountHistory: true } };
});

const code = "H_CAN2_CAN";
const lines = [true, true, true, false, false, true];
const content = {
  overview: "Tổng quan thử nghiệm", image: "Trời trong núi", original: "大畜",
  paraphrase: "Diễn nghĩa thử nghiệm", application: "Suy ngẫm thử nghiệm",
  lines: ["Đoạn 1", "Đoạn 2", "Đoạn 3", "Đoạn 4", "", "Đoạn 6"],
};
const source = { id: "ZY", title: "Chu Dịch", author: null, edition: "Bản đối chiếu",
  locator: "Đại súc", url: "https://zh.wikisource.org/wiki/周易/大畜", reuseNote: "Bản Hán cổ", reviewStatus: "VERIFIED" };
function response(publication: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    requestId: "550e8400-e29b-41d4-a716-446655440003", status: "COMPLETED", error: null, data: { code, publication },
  })));
}

it("shows only the interpretation of the requested moving line in a calculation result", async () => {
  response({ content, status: "PUBLISHED", version: 2, sources: [source], publishedAt: "2026-11-10T01:00:00Z" });
  render(<PublishedInterpretation code={code} lines={lines} compact movingLine={4} />);
  expect(await screen.findByText("Đoạn 4")).toBeTruthy();
  expect(screen.getByText("Hào động 4 · Âm")).toBeTruthy();
  expect(screen.queryByText("Đoạn 3")).toBeNull();
  expect(screen.getByText("Chu Dịch")).toBeTruthy();
});

it("rejects drafts and shows a meaningful empty state for an unpublished quẻ", async () => {
  response({ content, status: "DRAFT", version: 1, sources: [source], publishedAt: "2026-11-10T01:00:00Z" });
  const { unmount } = render(<PublishedInterpretation code={code} lines={lines} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(content.overview)).toBeNull();
  unmount();
  response(null);
  render(<PublishedInterpretation code={code} lines={lines} />);
  expect(await screen.findByText("Quẻ này chưa có bài luận giải được công bố.")).toBeTruthy();
});

it("opens consultation with a Mai Hoa reading even when clipboard access is unavailable", async () => {
  const result: unknown = linesResponse;
  if (!isCalculationResponse(result)) throw new Error("Invalid Mai Hoa test fixture");
  const accountId = "550e8400-e29b-41d4-a716-446655440003";
  push.mockClear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/session")) return Response.json({ requestId: linesResponse.requestId,
      status: "COMPLETED", error: null, data: { account: { id: accountId, role: "USER", displayName: "Khách" },
        csrfToken: "a".repeat(43), expiresAt: "2099-01-01T00:00:00Z" } });
    const requestedCode = path.split("/").at(-2);
    const publication = { content: { ...content, overview: `Tổng quan ${requestedCode}` },
      status: "PUBLISHED", version: 2, sources: [source], publishedAt: "2026-11-10T01:00:00Z" };
    return Response.json({ requestId: linesResponse.requestId, status: "COMPLETED", error: null,
      data: { code: requestedCode, publication } });
  }));

  render(<ResultPanel connection="connected" requestState="completed" response={result} progress={[]} localError={null} />);
  const { primaryHexagram, mutualHexagram, changedHexagram } = linesResponse.data;
  for (const hexagram of [primaryHexagram, mutualHexagram, changedHexagram]) {
    expect(await screen.findByText(`Tổng quan ${hexagram.code}`)).toBeTruthy();
  }
  expect(screen.getByText("Hào động 2 · Âm")).toBeTruthy();
  expect(screen.queryByText("Đoạn 3")).toBeNull();
  expect(screen.getByRole("link", { name: "Hỏi AI về kết quả này" }).getAttribute("href"))
    .toBe(`/tu-van/hoi-ai?calculationRequestId=${linesResponse.requestId}`);
  fireEvent.click(screen.getByRole("button", { name: "Sao chép lá số để gửi tư vấn" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/tu-van"));
  const message = readReadingHandoff(accountId)?.text;
  expect(message).toContain("Quẻ chủ: Ký tế");
  expect(message).toContain("Quẻ hỗ: Vị tế");
  expect(message).toContain("Quẻ biến: Nhu");
  expect(message).toContain("Hào động: 2");
  sessionStorage.clear();
});

it("offers Chat and AI together on a Tam Thế result", () => {
  const response: unknown = tamTheResponse;
  if (!isCalculationResponse(response)) throw new Error("Invalid Tam Thế test fixture");
  render(<ResultPanel connection="connected" requestState="completed" response={response} progress={[]} localError={null} />);
  const copy = screen.getByRole("button", { name: "Sao chép lá số để gửi tư vấn" });
  const ask = screen.getByRole("link", { name: "Hỏi AI về kết quả này" });
  expect(ask.getAttribute("href")).toBe(`/tu-van/hoi-ai?calculationRequestId=${tamTheResponse.requestId}`);
  expect(copy.closest(".result-actions")).toBe(ask.closest(".result-actions"));
});

it("shows a published poem verbatim alongside the existing interpretation", async () => {
  const poem = { title: "Bài thơ thử nghiệm", body: "Dòng một\n\nDòng hai\n", author: "Nhóm biên soạn", source: "Nguồn thử nghiệm" };
  const publication = { content, status: "PUBLISHED", version: 2, sources: [source], publishedAt: "2026-11-10T01:00:00Z" };
  response(publication);
  const { unmount } = render(<PublishedInterpretation code={code} lines={lines} />);
  expect(await screen.findByText(content.overview)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Thơ diễn nghĩa quẻ" })).toBeNull();
  unmount();

  response({ ...publication, content: { ...content, poem } });
  render(<PublishedInterpretation code={code} lines={lines} />);
  const heading = await screen.findByRole("heading", { name: "Thơ diễn nghĩa quẻ" });
  expect(heading.parentElement?.querySelector(".interpretation-text")?.textContent).toBe(poem.body);
  expect(screen.getByRole("heading", { name: poem.title })).toBeTruthy();
  expect(screen.getByText("Tác giả hoặc đơn vị biên soạn: " + poem.author)).toBeTruthy();
  expect(screen.getByText("Nguồn: " + poem.source)).toBeTruthy();
  for (const text of [content.overview, content.image, content.original, content.paraphrase, "Đoạn 6"]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
});
