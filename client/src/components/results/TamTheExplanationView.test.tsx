import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InterpretationEntry, TamTheResult } from "@/types/contract";
import { TamTheResultView } from "./TamTheResultView";
import d02 from "../../../../data/tam_the_d02_source.json";
import d04 from "../../../../docs/examples/d04-wealth-no-loc.response.json";
import explanations from "./tamTheExplanations.json";

function dataWith(category: "LOVE" | "CAREER", entries: InterpretationEntry[]): TamTheResult {
  return { ...structuredClone(d04.data), categories: [{ category, entries }] } as TamTheResult;
}
const references = d04.data.categories[0].entries[0].sourceReferences;

describe("plain-language Tam The presentation", () => {
  it.each(d02.love.passages.map((passage, index) => ({ ...passage, code: `LOVE_C${String(index + 1).padStart(2, "0")}` })))
  ("keeps the eight original lines and explains all four couplets of $label", passage => {
    const data = dataWith("LOVE", [{ resultCode: passage.code, title: passage.label, content: passage.text, sourceReferences: references }]);
    const original = JSON.stringify(data);
    const { container } = render(<TamTheResultView data={data} />);
    expect(container.querySelector("blockquote")?.textContent).toBe(passage.text);
    expect(container.querySelector("blockquote")?.textContent?.split("\n")).toHaveLength(8);
    const meaning = screen.getByRole("region", { name: `Giải nghĩa bài thơ ${passage.label}` });
    expect(within(meaning).getByRole("heading", { name: "Bài thơ nói gì?" })).toBeTruthy();
    const items = within(meaning).getAllByRole("listitem");
    const explanation = explanations.find(row => row.resultCode === passage.code)!;
    expect(items).toHaveLength(4);
    explanation.couplets?.forEach((couplet, index) => {
      expect(items[index].textContent).toContain(`Câu ${couplet.lines}`);
      expect(items[index].textContent).toContain(couplet.meaning);
    });
    expect(screen.getByText(/Phần giải nghĩa là nội dung biên tập hỗ trợ đọc văn bản/)).toBeTruthy();
    expect(JSON.stringify(data)).toBe(original);
  });
  it("explains Tài Phùng without asserting that a user must become a tailor to avoid bodily harm", () => {
    const row = explanations.find(item => item.resultCode === "CAREER13_C10")!;
    render(<TamTheResultView data={dataWith("CAREER", [{ resultCode: row.resultCode, title: "Tài Phùng", content: row.original, sourceReferences: references }])} />);
    const meaning = screen.getByRole("region", { name: "Giải nghĩa Tài Phùng" });
    expect(meaning.textContent).toContain("nghề may vá");
    expect(meaning.textContent).toContain("không có nghĩa người dùng sẽ bị tật");
    const original = screen.getByText("Xem lời gốc và nguồn của Tài Phùng", { selector: "summary" }).closest("details")!;
    expect(original.open).toBe(false);
    fireEvent.click(original.querySelector("summary")!);
    expect(original.textContent).toContain(row.original);
  });
  it("does not fill a missing LOC result and keeps the other independently returned entries", () => {
    const data = structuredClone(d04.data) as TamTheResult;
    const original = JSON.stringify(data);
    render(<TamTheResultView data={data} />);
    const loc = screen.getByRole("region", { name: "Tiểu mục Lộc" });
    expect(loc.textContent).toContain("không có nghĩa bạn không có tài lộc");
    expect(loc.querySelectorAll(".interpretation-entry")).toHaveLength(0);
    expect(screen.getByRole("region", { name: "Giải nghĩa Lục Hại" }).textContent).toContain("sự không hòa hợp với người thân");
    expect(screen.getByRole("region", { name: "Giải nghĩa Phú / Phá" }).textContent).toContain("quyết định biên tập");
    expect(JSON.stringify(data)).toBe(original);
  });
  it("keeps revised or unknown poems as supplied instead of interpreting them from their title", () => {
    const revised = `${d02.love.passages[4].text}\nNội dung bổ sung từ Server.`;
    render(<TamTheResultView data={dataWith("LOVE", [{ resultCode: "LOVE_C05", title: "Đế vượng", content: revised, sourceReferences: references }])} />);
    expect(screen.getByText(/Đang hiển thị nguyên văn từ Server/)).toBeTruthy();
    expect(screen.getByText((_text, element) => element?.tagName === "P" && element.textContent === revised)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Giải nghĩa bài thơ Đế vượng" })).toBeNull();
  });
});
