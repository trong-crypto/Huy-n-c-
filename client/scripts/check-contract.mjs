import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Check the actual JSON fixtures against the same TypeScript types used by the UI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examples = path.resolve(root, "../docs/examples");
const virtualPath = path.resolve(root, "src/types/__contract_fixtures__.ts");
const declarations = [
  'import type { CalculationRequest, CalculationResponse, ProgressEvent, CalendarInput, CanChiInput, CalendarResult, CanChiResult, RestResponse, HistorySaveRequest, HistoryItem, HistoryDetail, HistoryDeleteResult, Page, HexagramRecord, HexagramDetail } from "./contract";',
];
let count = 0;
for (const filename of fs.readdirSync(examples).filter((name) => name.endsWith(".json")).sort()) {
  const body = fs.readFileSync(path.join(examples, filename), "utf8");
  const value = JSON.parse(body);
  let type;
  if (filename.endsWith(".request.json") && value.type) type = "CalculationRequest";
  else if (filename.endsWith(".response.json") && value.type) type = "CalculationResponse";
  else if (filename === "calculation.progress.json") type = "ProgressEvent";
  else if (filename === "calendar-convert.request.json") type = "CalendarInput";
  else if (filename === "calendar-can-chi.request.json") type = "CanChiInput";
  else if (filename === "calendar-convert.response.json" || filename === "calendar-invalid-date.response.json") type = "RestResponse<CalendarResult>";
  else if (filename === "calendar-can-chi.response.json") type = "RestResponse<CanChiResult>";
  else if (filename === "history-save.request.json") type = "HistorySaveRequest";
  else if (filename === "history-list.response.json") type = "RestResponse<Page<HistoryItem>>";
  else if (filename === "history-deleted.response.json") type = "RestResponse<HistoryDeleteResult>";
  else if (filename.startsWith("history-") && filename.endsWith(".response.json")) type = "RestResponse<HistoryDetail>";
  else if (filename === "hexagrams-list.response.json") type = "RestResponse<Page<HexagramRecord>>";
  else if (filename.startsWith("hexagram-") && filename.endsWith(".response.json")) type = "RestResponse<HexagramDetail>";
  else throw new Error(`Fixture has no contract type: ${filename}`);
  declarations.push(`// ${filename}\nconst fixture${count++}: ${type} = ${body};`);
}
const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const options = { ...config.options, noEmit: true, incremental: false };
const host = ts.createCompilerHost(options);
const getSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (filename, languageVersion, ...rest) => path.resolve(filename) === virtualPath
  ? ts.createSourceFile(filename, declarations.join("\n"), languageVersion, true)
  : getSourceFile(filename, languageVersion, ...rest);
const program = ts.createProgram([virtualPath], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else {
  console.log(`Contract v1.2: ${count} JSON fixtures match Client TypeScript types.`);
}
