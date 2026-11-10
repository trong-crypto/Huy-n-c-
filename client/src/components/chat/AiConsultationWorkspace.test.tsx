import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AiConsultationPage from "@/app/tu-van/hoi-ai/page";
import { SessionProvider } from "@/services/session/SessionProvider";

vi.mock("@/config/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@/config/client")>();
  return { ...actual, CLIENT_CONFIG: { ...actual.CLIENT_CONFIG, accountHistory: true, apiBaseUrl: "/api/v1" } };
});

const id = "550e8400-e29b-41d4-a716-446655440003";
const csrfToken = "a".repeat(43);
const ok = (data: unknown) => Response.json({ requestId: id, status: "COMPLETED", data, error: null });
const error = (code: string, status: number) => Response.json({ requestId: id, status: "FAILED", data: null,
  error: { code, message: code, ruleCode: null, reason: null } }, { status });
const session = () => ok({ expiresAt: new Date(Date.now() + 60_000).toISOString(), csrfToken });
const reply = (answer: string) => ({ answer, mode: "demo", reading: null, sources: [] });
const reading = {
  method: "LINES", primary: { code: "H_DOAI_LY", name: "Cách", nameStatus: "VERIFIED" },
  mutual: { code: "H_CAN_TON", name: "Cấu", nameStatus: "VERIFIED" },
  changed: { code: "H_DOAI_CHAN", name: "", nameStatus: "DRAFT" }, movingLine: 3,
  sourceStatus: "SOURCE_AMBIGUOUS", ruleBasis: "TEAM_DECISION",
};

async function open(params: { readingId?: string; calculationRequestId?: string } = {}) {
  render(<SessionProvider>{await AiConsultationPage({ searchParams: Promise.resolve(params) })}</SessionProvider>);
}

async function ask(question: string) {
  const input = await screen.findByRole("textbox");
  await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
}

it("opens Hỏi AI and sends a bounded follow-up without touching Chat", async () => {
  const sent: unknown[] = [];
  const socket = vi.fn();
  vi.stubGlobal("WebSocket", socket);
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.endsWith("/session")) return session();
    if (path.endsWith("/ai/status")) return ok({ mode: "demo" });
    if (path.endsWith("/ai/ask")) {
      expect(options).toMatchObject({ method: "POST", credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken, "X-HuyenCo-Request": "1" } });
      sent.push(JSON.parse(String(options.body)));
      return ok(reply(sent.length === 1 ? "Quẻ chủ là hình ban đầu." : "Hào động là hào đổi."));
    }
    throw new Error("Unexpected request");
  }));

  await open();
  expect(screen.getByRole("link", { name: "Chat với tư vấn viên" }).getAttribute("href")).toBe("/tu-van");
  const input = await screen.findByRole("textbox");
  await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(input, { target: { value: "Quẻ chủ là gì?" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("Quẻ chủ là hình ban đầu.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Trợ lý AI · DEMO" })).toBeTruthy();
  await ask("Hào động là gì?");
  expect(await screen.findByText("Hào động là hào đổi.")).toBeTruthy();
  expect(sent).toEqual([{ question: "Quẻ chủ là gì?", turns: [] }, { question: "Hào động là gì?",
    turns: [{ question: "Quẻ chủ là gì?", answer: "Quẻ chủ là hình ban đầu." }] }]);
  expect(socket).not.toHaveBeenCalled();
});

it("passes only a Mai Hoa reference and renders Server evidence", async () => {
  const post = vi.fn((_body: unknown) => ok({ ...reply("Dữ kiện đi kèm"), reading,
    sources: [{ title: "Mai Hoa Dịch Số", section: "Lập quẻ", printedPage: "12", pdfPage: 15 }] }));
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.endsWith("/session")) return session();
    if (path.endsWith("/ai/status")) return ok({ mode: "demo" });
    return post(JSON.parse(String(options.body)));
  }));
  await open({ calculationRequestId: id });
  await ask("Hào nào thay đổi?");
  fireEvent.click(await screen.findByText("Nguồn đi kèm kết quả từ Server"));
  expect(await screen.findByText("Cách")).toBeTruthy();
  expect(screen.getByText("Cấu")).toBeTruthy();
  expect(screen.getByText(/H_DOAI_CHAN .*tên chưa xác minh/)).toBeTruthy();
  expect(screen.getByText(/Hào động 3/)).toBeTruthy();
  expect(screen.getByText("Mai Hoa Dịch Số")).toBeTruthy();
  expect(post).toHaveBeenCalledWith({ question: "Hào nào thay đổi?", calculationRequestId: id, turns: [] });
});

it("announces external disclosure before send and preserves the failed draft for retry", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/session")) return session();
    if (path.endsWith("/ai/status")) return ok({ mode: "live" });
    if (++attempts === 1) throw new TypeError("offline");
    return ok({ ...reply("Đã trả lời"), mode: "live" });
  }));
  await open();
  expect(await screen.findByText(/chuyển tới nhà cung cấp AI bên ngoài/)).toBeTruthy();
  expect(attempts).toBe(0);
  await ask("Giải thích giúp tôi");
  expect((await screen.findByRole("alert")).textContent).toContain("Mất kết nối");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Giải thích giúp tôi");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Đã trả lời")).toBeTruthy();
  expect(attempts).toBe(2);
});

it("handles an inaccessible History reference without falling back to a general answer", async () => {
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/session")) return session();
    if (path.endsWith("/ai/status")) return ok({ mode: "demo" });
    return error("NOT_FOUND", 404);
  }));
  await open({ readingId: id });
  await ask("Cho tôi xem quẻ");
  expect((await screen.findByRole("alert")).textContent).toContain("không khả dụng trong tài khoản");
  expect(screen.getByRole("link", { name: "Hỏi AI không kèm kết quả" }).getAttribute("href")).toBe("/tu-van/hoi-ai");
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("keeps the question form closed for a guest", async () => {
  const fetch = vi.fn(async () => error("INVALID_SESSION", 401));
  vi.stubGlobal("fetch", fetch);
  await open();
  expect(await screen.findByRole("link", { name: "Đăng nhập" })).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(fetch.mock.calls).toHaveLength(1);
});
