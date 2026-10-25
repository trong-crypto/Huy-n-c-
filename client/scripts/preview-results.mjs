// Isolated visual QA server. Never imported by app routes or used as a success fallback.
// Run after npm run build: node scripts/preview-results.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadUiModule } from "./lib/load-ui-module.mjs";

const { ResultPanel } = await loadUiModule("components/ResultPanel.tsx");
const root = new URL("../", import.meta.url);
const readExample = name => JSON.parse(fs.readFileSync(new URL(`../../docs/examples/${name}`, import.meta.url), "utf8"));
const cases = {
  lines: "LINES — fixture chính thức",
  objects: "OBJECT_COUNT — fixture chính thức",
  long: "Biến thể kiểm thử — tên nguồn dài / bước mới",
  nulls: "Biến thể kiểm thử — tên và metadata null",
  invalid: "Biến thể kiểm thử — DTO hỏng",
  failed: "RULE_NOT_AVAILABLE — fixture chính thức",
  timeout: "Biến thể kiểm thử — timeout cục bộ",
};
function propsFor(name) {
  let response = readExample(name === "objects" ? "mai-hoa-object-count.response.json" : "mai-hoa-lines.response.json");
  let requestState = "completed";
  let localError = null;
  if (name === "long") {
    response.data.sourceReferences[0].title = "[KIỂM THỬ BỐ CỤC] " + "Nguồn tham chiếu có tên dài cần xuống dòng trên màn hình hẹp. ".repeat(7);
    response.data.calculationSteps.push({ code: "FUTURE_STEP", message: "[KIỂM THỬ] Bước chưa có tên trong Client; giữ nguyên nội dung phản hồi.", values: { note: "<script>text only</script>", flags: [true, false] } });
  }
  if (name === "nulls") {
    Object.assign(response.data.primaryHexagram, { name: null, nameStatus: null, code: null });
    response.data.sourceReferences.forEach(source => Object.assign(source, { printedPage: null, pdfPage: null, sha256: null, url: null }));
  }
  if (name === "invalid") response.data.mutualHexagram.linesBottomUp.pop();
  if (name === "failed") { response = readExample("rule-not-available.response.json"); requestState = "failed"; }
  if (name === "timeout") { response = null; requestState = "timeout"; localError = "REQUEST_TIMEOUT: Quá thời gian chờ phản hồi."; }
  return { connection: "connected", requestState, response, localError, progress: [] };
}
function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(file) : entry.name.endsWith(".css") ? [file] : [];
  });
}
const css = cssFiles(fileURLToPath(new URL(".next/static/css/", root))).map(file => fs.readFileSync(file, "utf8")).join("\n")
  + "\n.qa-harness{border:1px solid var(--primary);padding:20px;border-radius:12px;margin-bottom:24px;background:var(--surface);font-size:13px}.qa-harness strong{color:var(--primary-hover)}.qa-harness p{color:var(--secondary);margin:8px 0}.qa-harness nav{display:flex;flex-wrap:wrap;gap:8px}.qa-harness a{display:block;min-height:44px;padding:10px;color:var(--primary-hover);border:1px solid var(--border);border-radius:6px}.qa-harness a[aria-current]{background:var(--soft)}";
const port = Number(process.env.PREVIEW_PORT ?? 3174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PREVIEW_PORT");
createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/preview.css") { response.setHeader("Content-Type", "text/css; charset=utf-8"); response.end(css); return; }
  const name = url.searchParams.get("case") ?? "lines";
  if (url.pathname !== "/" || !Object.hasOwn(cases, name)) { response.writeHead(404); response.end("Unknown UI test case"); return; }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = h("html", { lang: "vi" },
    h("head", null, h("meta", { charSet: "utf-8" }), h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), h("title", null, "Huyền Cơ — UI TEST HARNESS"), h("link", { rel: "stylesheet", href: "/preview.css" })),
    h("body", null, h("main", { className: "page-container" },
      h("header", { className: "qa-harness" }, h("strong", null, "UI TEST HARNESS — KHÔNG PHẢI KẾT QUẢ TÍNH TRỰC TIẾP"), h("p", null, "Fixture chính thức hoặc biến thể kiểm thử được ghi nhãn. Trạng thái kết nối bên dưới là đầu vào kiểm thử, không xác nhận Server đang chạy."), h("p", null, cases[name]),
        h("nav", { "aria-label": "Ca kiểm thử" }, Object.entries(cases).map(([key, title]) => h("a", { key, href: `/?case=${key}`, "aria-current": key === name ? "page" : undefined }, title)))),
      h(ResultPanel, propsFor(name)))));
  response.end("<!doctype html>" + renderToStaticMarkup(html));
}).listen(port, "127.0.0.1", () => console.log(`UI TEST HARNESS only: http://127.0.0.1:${port} — not a live Server calculation.`));
