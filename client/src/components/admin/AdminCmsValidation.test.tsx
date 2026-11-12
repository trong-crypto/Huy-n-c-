import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { cmsTextError } from "./adminContentValidation";
import { HexagramGlossWorkspace } from "./HexagramGlossWorkspace";
import { MethodGuideEditor } from "./MethodGuideWorkspace";

vi.mock("./AdminSessionGate", () => {
  const auth = { session: { account: { id: "550e8400-e29b-41d4-a716-446655440001" }, csrfToken: "token" }, handleError: vi.fn() };
  return { useAdminSession: () => auth };
});

const requestId = "550e8400-e29b-41d4-a716-446655440001";
const completed = (data: unknown) => Response.json({ requestId, status: "COMPLETED", data, error: null });
const failed = (status: number, code: string, reason: string | null = null) => Response.json({
  requestId, status: "FAILED", data: null, error: { code, reason, ruleCode: null, message: "<b>Unsafe server text</b>" },
}, { status });

it("counts Unicode code points and allows line breaks only for multiline CMS fields", () => {
  expect(cmsTextError("😀".repeat(120), 120, "Tiêu đề")).toBe("");
  expect(cmsTextError("😀".repeat(121), 120, "Tiêu đề")).toContain("tối đa 120");
  expect(cmsTextError("a\nb", 120, "Nội dung", true)).toBe("");
  expect(cmsTextError("a\nb", 120, "Tiêu đề")).toContain("ký tự");
  expect(cmsTextError("\uD800", 120, "Tiêu đề")).toContain("ký tự");
});

it("connects a guide validation error to its field and retains the unsaved title", async () => {
  const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(
    init.method === "POST" ? failed(400, "INVALID_INPUT", "title")
      : failed(404, "NOT_FOUND")));
  vi.stubGlobal("fetch", fetch);
  render(<MethodGuideEditor method={{ code: "TIME", title: "Theo thời điểm", body: "Lập quẻ theo thời điểm." }} />);
  const title = await screen.findByLabelText("Tiêu đề") as HTMLInputElement;
  fireEvent.change(title, { target: { value: "Bản nhập chưa lưu" } });
  fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Nội dung kiểm thử" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Kiểm tra tiêu đề bài hướng dẫn.");
  expect(title.getAttribute("aria-describedby")).toBe("guide-title-error");
  expect(title.value).toBe("Bản nhập chưa lưu");
  fireEvent.change(title, { target: { value: "Tiêu đề đã sửa" } });
  expect(screen.queryByRole("alert")).toBeNull();
});

it("shows the gloss source error inline, then keeps unsaved content on a conflict", async () => {
  const code = "H_KHAM_TON";
  const path = "/admin/hexagrams/" + code;
  let writes = 0;
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, init: RequestInit) => Promise.resolve(
    init.method === "POST" ? ++writes === 1 ? failed(400, "INVALID_SOURCE", "sourceSectionId")
      : failed(409, "GLOSS_DRAFT_EXISTS")
      : url.endsWith(path) ? completed({ hexagram: { code }, nameGloss: null, nameSource: {
        sectionId: "42", reference: { sourceId: "MH", title: "Mẫu", version: "1", section: "Quẻ",
          pdfPage: 1, printedPage: "1", sha256: null, url: null },
      } }) : failed(404, "NOT_FOUND"))));
  render(<HexagramGlossWorkspace code={code} refreshPublic={vi.fn()} />);
  const content = await screen.findByLabelText("Nghĩa tên đề xuất") as HTMLInputElement;
  fireEvent.change(content, { target: { value: "<b>Nội dung giữ lại</b>" } });
  const save = screen.getByRole("button", { name: "Lưu bản nháp" }) as HTMLButtonElement;
  fireEvent.click(save);
  expect((await screen.findByRole("alert")).textContent).toBe("Chọn trang nguồn có đủ thông tin đối chiếu.");
  expect(screen.getByLabelText("Trang nguồn đối chiếu").getAttribute("aria-describedby")).toBe("hexagram-gloss-source-error");
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await screen.findByText("Quẻ đã có bản nháp. Hãy tải phiên bản mới.");
  expect(content.value).toBe("<b>Nội dung giữ lại</b>");
  expect(save.matches(":disabled")).toBe(true);
  expect(screen.queryByText("Unsafe server text")).toBeNull();
});
