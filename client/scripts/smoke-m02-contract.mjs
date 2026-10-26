// Additive contract regression on the current D04 Server; schema-only examples are never runtime substitutes.
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";

const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const url = process.env.M02_WS_URL ?? "ws://127.0.0.1:18086/ws";
const origin = process.env.M02_ORIGIN ?? "http://localhost:3000";
const fixture = name => JSON.parse(fs.readFileSync(new URL(`../../docs/examples/${name}`, import.meta.url), "utf8"));
const id = n => `550e8400-e29b-41d4-a716-44665544${String(n).padStart(4, "0")}`;
const clients = [];

async function connect(label) {
  return new Promise((resolve, reject) => {
    const state = { label, terminal: [], progress: [] };
    const client = new Client({
      webSocketFactory: () => new WebSocket(url, { headers: { Origin: origin } }), reconnectDelay: 0,
      onConnect: () => {
        // Match the existing protocol clients: this simple broker does not acknowledge SUBSCRIBE receipts.
        // Server preserves receive order, so subscriptions precede subsequent SEND frames on this session.
        for (const [route, list] of [["results", state.terminal], ["errors", state.terminal], ["progress", state.progress]]) {
          client.subscribe(`/user/queue/${route}`, frame => list.push(JSON.parse(frame.body)));
        }
        clearTimeout(timer); resolve(state);
      },
      onStompError: () => { clearTimeout(timer); reject(new Error("STOMP rejected the connection")); },
      onWebSocketError: () => { clearTimeout(timer); reject(new Error("WebSocket connection failed")); },
    });
    const timer = setTimeout(() => reject(new Error("M02 connection/subscription timed out")), 8000);
    state.client = client; clients.push(client); client.activate();
  });
}
async function send(state, request) {
  const previous = state.terminal.length;
  state.client.publish({ destination: `/app/${request.type === "MAI_HOA" ? "mai-hoa" : "tam-the"}/calculate`,
    body: JSON.stringify(request), headers: { "content-type": "application/json" } });
  const until = Date.now() + 5000;
  while (state.terminal.length === previous && Date.now() < until) await new Promise(done => setTimeout(done, 10));
  assert.equal(state.terminal.length, previous + 1, "Exactly one terminal response is required");
  const response = state.terminal.at(-1);
  assert.equal(response.requestId, request.requestId); assert.equal(response.type, request.type);
  assert.equal(isCalculationResponse(response), true, "Real wire result must pass the shared Client guard");
  return response;
}
function failed(response, code, rule) {
  assert.equal(response.status, "FAILED"); assert.equal(response.error.code, code);
  if (rule) { assert.equal(response.error.ruleCode, rule); assert.equal(response.error.reason, "IMPLEMENTATION_UNAVAILABLE"); }
}

try {
  const a = await connect("A"), b = await connect("B");
  for (const name of ["lines-reading", "object-reading", "time-reading", "wealth-extended"]) {
    const request = fixture(`m02-${name}.request.json`);
    const response = await send(a, request);
    assert.equal(response.status, "COMPLETED");
    if (request.type === "MAI_HOA") assert.equal(response.data.detailedReading.phases.length, 4);
    else { assert.equal(response.data.coverageMode, "EXTENDED"); assert.equal(response.data.categories.find(c => c.category === "WEALTH").subreadings.length, 3); }
    assert.deepEqual(a.progress.filter(p => p.requestId === request.requestId).map(p => p.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  }
  const request = fixture("m02-lines-reading.request.json");
  assert.deepEqual(await send(a, request), a.terminal[0]); // Replay, no second execution.
  const changedTopic = structuredClone(request); changedTopic.payload.reading.topic = "CAREER";
  failed(await send(a, changedTopic), "INVALID_INPUT");
  const changedContext = structuredClone(request); changedContext.payload.reading.context.datetime = "2024-02-10T10:00:00+07:00";
  failed(await send(a, changedContext), "INVALID_INPUT");
  assert.equal(b.terminal.length, 0); assert.equal((await send(b, request)).status, "COMPLETED");
  const invalid = structuredClone(request); invalid.requestId = id(36); invalid.payload.reading = null;
  failed(await send(a, invalid), "INVALID_INPUT");
  const time = fixture("m02-time-reading.request.json"); time.requestId = id(37); time.payload.reading.context = {};
  failed(await send(a, time), "INVALID_INPUT");
  const wealth = fixture("m02-wealth-extended.request.json"); wealth.requestId = id(38); wealth.payload.categories = ["CAREER"];
  failed(await send(a, wealth), "INVALID_INPUT");
  const legacy = fixture("mai-hoa-lines.request.json"); legacy.requestId = id(39);
  assert.deepEqual((await send(a, legacy)).data, fixture("mai-hoa-lines.response.json").data);
  const loc = fixture("m02-wealth-legacy.request.json");
  assert.deepEqual((await send(a, loc)).data, fixture("tam-the-wealth.response.json").data);
  await new Promise(done => setTimeout(done, 100));
  assert.equal(a.terminal.length, 12); assert.equal(b.terminal.length, 1);
  const report = { task: "M02_CONTRACT", status: "PASS", sessions: 2, terminalResponses: 13,
    progressEvents: a.progress.length + b.progress.length, maiHoaDetailedReadingEnabled: true, tamTheExtendedEnabled: true,
    scope: "Current D04 contract regression: real Mai Hoa and extended Tam The, old LINES/LEGACY results and session routing",
    cases: [a, b].flatMap(s => s.terminal.map(r => ({ session: s.label, requestId: r.requestId,
      type: r.type, status: r.status, error: r.error?.code ?? null }))) };
  fs.writeFileSync(new URL("../../scripts/generated/m02_contract_smoke.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
} finally { await Promise.all(clients.map(client => client.deactivate())); }
