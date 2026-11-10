import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import { isCalculationResponse } from "@/types/contractValidation";
import linesResponse from "../../../../docs/examples/mai-hoa-lines.response.json";
import { PublishedInterpretation } from "./PublishedInterpretation";

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

it("keeps chat copy, published readings and the AI link together on a Mai Hoa result", async () => {
  const result: unknown = linesResponse;
  if (!isCalculationResponse(result)) throw new Error("Invalid Mai Hoa test fixture");
  const writeText = vi.fn(async (_text: string) => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
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
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(writeText.mock.calls[0][0]).toContain("Quẻ chủ: Ký tế");
  expect(writeText.mock.calls[0][0]).toContain("Quẻ hỗ: Vị tế");
  expect(writeText.mock.calls[0][0]).toContain("Quẻ biến: Nhu");
  expect(writeText.mock.calls[0][0]).toContain("Hào động: 2");
  expect(await screen.findByText(/^Đã sao chép\./)).toBeTruthy();
});
