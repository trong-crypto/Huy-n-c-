import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadUiModule } from "./lib/load-ui-module.mjs";

const { initialState, reduceCalculation: reduce, parseProgress, parseTerminal, CLIENT_TIMEOUT_MS } =
  await loadUiModule("services/websocket/calculationState.ts");
const success = JSON.parse(fs.readFileSync(new URL("../../docs/examples/mai-hoa-lines.response.json", import.meta.url), "utf8"));
const id = success.requestId;
const steps = ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"];
const begin = () => reduce(initialState, { kind: "begin", requestId: id, type: "MAI_HOA" });
const event = (sequence, changes = {}) => ({ requestId: id, type: "MAI_HOA", sequence, step: steps[sequence - 1], message: "Real stage", ...changes });

test("TIME runtime fixture passes the shared terminal guard with calendar and team-decision metadata", () => {
  const response=JSON.parse(fs.readFileSync(new URL("../../docs/examples/mai-hoa-time.response.json",import.meta.url),"utf8"));
  const parsed=parseTerminal(response);
  assert.equal(parsed.data.method,"TIME");
  assert.equal(parsed.data.lunarDate.year,2024);
  assert.equal(parsed.data.ruleBasis,"TEAM_DECISION");
  assert.equal(parsed.data.sourceStatus,"VERIFIED");
  assert.equal(parsed.data.sourceReferences[0].pdfPage,null);
});

test("Tam The runtime fixtures pass success and missing-lookup guards without a partial result", () => {
  for(const name of ["tam-the","tam-the-career","tam-the-wealth","tam-the-love"]) {
    const response=JSON.parse(fs.readFileSync(new URL(`../../docs/examples/${name}.response.json`,import.meta.url),"utf8"));
    const parsed=parseTerminal(response);
    assert.equal(parsed.type,"TAM_THE");assert.equal(parsed.status,"COMPLETED");
    assert.equal(parsed.data.ruleBasis,"SOURCE_VERIFIED");
    const state=reduce(reduce(initialState,{kind:"begin",requestId:parsed.requestId,type:"TAM_THE"}),{kind:"terminal",response:parsed});
    assert.equal(state.requestState,"completed");
  }
  const failed=parseTerminal(JSON.parse(fs.readFileSync(new URL("../../docs/examples/tam-the-unavailable.response.json",import.meta.url),"utf8")));
  assert.equal(failed.error.reason,"LOOKUP_NOT_AVAILABLE");assert.equal(failed.data,null);
});

test("ordered progress and terminal result complete the pending request", () => {
  let state = begin();
  for (let i = 1; i <= 4; i++) state = reduce(state, { kind: "progress", event: parseProgress(event(i)) });
  state = reduce(state, { kind: "terminal", response: parseTerminal(success) });
  assert.equal(state.requestState, "completed"); assert.equal(state.requestId, null);
  assert.equal(state.progress.length, 4); assert.equal(state.response.data.primaryHexagram.name, "Ký tế");
  assert.equal(reduce(state, { kind: "progress", event: event(1) }), state);
});

test("duplicate and old progress cannot move the display backwards", () => {
  let state = reduce(begin(), { kind: "progress", event: event(1) });
  state = reduce(state, { kind: "progress", event: event(2) });
  assert.equal(reduce(state, { kind: "progress", event: event(1) }), state);
  assert.equal(state.progress.length, 2);
});

test("a gap or incompatible step fails visibly instead of fabricating missing stages", () => {
  for (const bad of [event(2), event(1, { step: "LOOKUP" })]) {
    const state = reduce(begin(), { kind: "progress", event: bad });
    assert.equal(state.requestState, "failed"); assert.match(state.localError, /INVALID_RESPONSE/);
    assert.equal(reduce(state, { kind: "terminal", response: success }), state);
  }
});

test("other request IDs and other modules are ignored", () => {
  const state = begin();
  assert.equal(reduce(state, { kind: "progress", event: event(1, { requestId: "other" }) }), state);
  assert.equal(reduce(state, { kind: "progress", event: event(1, { type: "TAM_THE" }) }), state);
  assert.equal(reduce(state, { kind: "terminal", response: { ...success, requestId: "other" } }), state);
});

test("15 second total deadline is not replaced by progress and late success is ignored", () => {
  assert.equal(CLIENT_TIMEOUT_MS, 15000);
  const running = reduce(begin(), { kind: "progress", event: event(1) });
  const state = reduce(running, { kind: "timeout", requestId: id });
  assert.equal(state.requestState, "timeout"); assert.equal(state.progress.length, 1);
  assert.equal(reduce(state, { kind: "terminal", response: success }), state);
});

test("disconnect settles waiting work and old responses cannot affect a new request", () => {
  let state = reduce(begin(), { kind: "disconnect" });
  assert.equal(state.requestState, "failed"); assert.match(state.localError, /DISCONNECTED/);
  state = reduce(state, { kind: "begin", requestId: "new", type: "MAI_HOA" });
  assert.equal(reduce(state, { kind: "terminal", response: success }), state);
  assert.equal(reduce(state, { kind: "timeout", requestId: id }), state);
  assert.equal(state.requestState, "waiting");
});

test("validation failure keeps its actual two progress stages without claiming calculation", () => {
  let state = begin();
  for (let i = 1; i <= 2; i++) state = reduce(state, { kind: "progress", event: event(i) });
  const failure = { ...success, status: "FAILED", data: null,
    error: { code: "INVALID_INPUT", message: "Invalid input", ruleCode: null, reason: null } };
  state = reduce(state, { kind: "terminal", response: parseTerminal(failure) });
  assert.equal(state.requestState, "failed"); assert.equal(state.response.status, "FAILED");
  assert.deepEqual(state.progress.map((e) => e.step), ["ACCEPTED", "VALIDATING"]);
});

test("invalid frames fail guards and protocol errors settle the timer state", () => {
  for (const bad of [null, [], {}, event(1, { sequence: 0 }), event(1, { step: "DONE" })])
    assert.throws(() => parseProgress(bad));
  for (const bad of [null, [], { ...success, data: null }, { ...success, status: "WAITING" }])
    assert.throws(() => parseTerminal(bad));
  const state = reduce(begin(), { kind: "error", message: "INVALID_RESPONSE" });
  assert.equal(state.requestState, "failed"); assert.equal(state.requestId, null);
});

test("a second submit cannot replace a still pending request", () => {
  const state = begin();
  assert.equal(reduce(state, { kind: "begin", requestId: "replacement", type: "MAI_HOA" }), state);
});

test("the result panel renders real progress safely and keeps failure visible", async () => {
  const { ResultPanel } = await loadUiModule("components/ResultPanel.tsx");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const html = renderToStaticMarkup(createElement(ResultPanel, {
    connection: "connected", requestState: "failed", response: null, localError: "REQUEST_TIMEOUT",
    progress: [event(1, { message: "<script>untrusted</script>" })],
  }));
  assert.ok(html.includes('aria-label="Tiến trình xử lý"'));
  assert.ok(html.includes("REQUEST_TIMEOUT")); assert.ok(!html.includes("<script>untrusted"));
  assert.ok(html.includes("&lt;script&gt;"));
});
