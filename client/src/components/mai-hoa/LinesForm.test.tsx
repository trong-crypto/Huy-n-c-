import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import request from "../../../../docs/examples/mai-hoa-lines.request.json";
import { LinesForm } from "./LinesForm";

function chooseLines(skip?: number) {
  request.payload.linesBottomUp.forEach((yang, index) => {
    if (index === skip) return;
    const group = screen.getByRole("group", { name: `Hào ${index + 1}` });
    fireEvent.click(within(group).getByRole("radio", { name: yang ? "Dương — nét liền" : "Âm — nét đứt" }));
  });
}

describe("LinesForm", () => {
  it("starts with exactly six required radio groups, none selected, movingLine unselected", () => {
    render(<LinesForm onSubmit={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(12);
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    for (let n = 1; n <= 6; n++) {
      const radios = within(screen.getByRole("group", { name: `Hào ${n}` })).getAllByRole("radio");
      expect(radios).toHaveLength(2);
      radios.forEach(radio => expect((radio as HTMLInputElement).required).toBe(true));
    }
    expect((screen.getByLabelText("Hào động") as HTMLSelectElement).value).toBe("");
    expect(screen.getAllByRole("group").filter(group => /^Hào [1-6]$/.test(group.querySelector("legend")?.textContent ?? ""))
      .map(group => group.querySelector("legend")?.textContent)).toEqual(["Hào 6", "Hào 5", "Hào 4", "Hào 3", "Hào 2", "Hào 1"]);
  });
  it("rejects empty input and exposes errors and focus", () => {
    const submit = vi.fn();
    render(<LinesForm onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    const first = within(screen.getByRole("group", { name: "Hào 6" })).getAllByRole("radio")[0];
    expect(first.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(first);
    expect(document.getElementById(first.getAttribute("aria-describedby")!)?.textContent).toContain("đủ sáu hào");
  });
  it("rejects a missing line even if movingLine is valid", () => {
    const submit = vi.fn();
    render(<LinesForm onSubmit={submit} />);
    chooseLines(2);
    fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("đủ sáu hào");
    expect(document.activeElement).toBe(within(screen.getByRole("group", { name: "Hào 3" })).getAllByRole("radio")[0]);
  });
  it("clears the line error after the last missing choice is corrected", () => {
    render(<LinesForm onSubmit={vi.fn()} />);
    chooseLines(2);
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(screen.getByText("Chọn Âm hoặc Dương cho đủ sáu hào.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Hào 3" })).getByRole("radio", { name: "Dương — nét liền" }));
    expect(screen.queryByText("Chọn Âm hoặc Dương cho đủ sáu hào.")).toBeNull();
    expect(screen.queryAllByRole("radio").some(radio => radio.getAttribute("aria-invalid") === "true")).toBe(false);
  });
  it("rejects an unselected movingLine and focuses its native select", () => {
    const submit = vi.fn();
    render(<LinesForm onSubmit={submit} />);
    chooseLines();
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Hào động"));
    expect(screen.getByLabelText("Hào động").getAttribute("aria-invalid")).toBe("true");
  });
  it.each([1, 6])("submits movingLine %i with exact whitelist and bottom-up array", movingLine => {
    const submit = vi.fn();
    render(<LinesForm onSubmit={submit} />);
    chooseLines();
    fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: String(movingLine) } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith({ ...request.payload, movingLine });
    expect(Object.keys(submit.mock.calls[0][0]).sort()).toEqual(["linesBottomUp", "method", "movingLine"]);
  });
  it("keeps Yin and Yang mutually exclusive, with visible labels and native keyboard controls", () => {
    render(<LinesForm onSubmit={vi.fn()} />);
    const [yin, yang] = within(screen.getByRole("group", { name: "Hào 1" })).getAllByRole("radio") as HTMLInputElement[];
    expect(yin.type).toBe("radio"); expect(yin.name).toBe(yang.name);
    yin.focus(); expect(document.activeElement).toBe(yin);
    fireEvent.click(yin); fireEvent.click(yang);
    expect(yin.checked).toBe(false); expect(yang.checked).toBe(true);
  });
  it.each([{ disabled: true }, { busy: true }])("does not submit while unavailable: %j", props => {
    const submit = vi.fn();
    render(<LinesForm onSubmit={submit} {...props} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Nhập sáu hào" }));
    expect(submit).not.toHaveBeenCalled();
  });
});
