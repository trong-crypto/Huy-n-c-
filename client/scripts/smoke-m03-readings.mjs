// Real Server/DB/STOMP/history acceptance. Never substitutes schema-only examples for service output.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";
const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const base = process.env.M03_HTTP_URL ?? "http://127.0.0.1:18087";
const origin = process.env.M03_ORIGIN ?? "http://localhost:3000";
const capture = process.env.M03_CAPTURE_FIXTURES === "1";
const url = file => new URL(`../../docs/examples/${file}`, import.meta.url);
const read = file => JSON.parse(fs.readFileSync(url(file), "utf8"));
const clients = [], ownerHashes = [], results = [];
let httpCount = 0;
const cleanupFile = new URL("../../scripts/generated/m03_owner_cleanup.json", import.meta.url);
if (fs.existsSync(cleanupFile)) {
  const pending = JSON.parse(fs.readFileSync(cleanupFile, "utf8")).tokenHashes;
  assert.ok(Array.isArray(pending) && pending.length <= 100 && pending.every(h => /^[0-9a-f]{64}$/.test(h)));
  ownerHashes.push(...pending);
}
const requestId = n => `550e8400-e29b-41d4-a716-44665544${String(n).padStart(4, "0")}`;

async function http(method, route, body, owner, expected = 200) {
  const headers = { Origin: origin, ...(owner ? { Cookie: owner.cookie } : {}) };
  if (method !== "GET") { headers["X-HuyenCo-Request"] = "1"; if (owner) headers["X-CSRF-Token"] = owner.csrf; }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  httpCount++; assert.equal(response.status, expected, `${method} ${route}`);
  return { response, value: await response.json() };
}
async function owner() {
  const { response, value } = await http("POST", "/api/v1/session", {});
  const cookie = response.headers.get("set-cookie").split(";")[0];
  ownerHashes.push(crypto.createHash("sha256").update(cookie.slice(cookie.indexOf("=") + 1)).digest("hex"));
  // Hashes only, never cookies/CSRF. The local acceptance runner removes exactly these test owners.
  fs.writeFileSync(cleanupFile, JSON.stringify({ tokenHashes: ownerHashes }) + "\n");
  return { cookie, csrf: value.data.csrfToken };
}
async function connect(label, identity) {
  return new Promise((resolve, reject) => {
    const state = { label, terminal: [], progress: [], identity };
    const timer = setTimeout(() => reject(new Error("M03 connect timeout")), 8000);
    const client = new Client({ webSocketFactory: () => new WebSocket(base.replace(/^http/, "ws") + "/ws",
      { headers: { Origin: origin, Cookie: identity.cookie } }), reconnectDelay: 0,
      onConnect: () => {
        for (const [route, list] of [["results", state.terminal], ["errors", state.terminal], ["progress", state.progress]]) {
          client.subscribe(`/user/queue/${route}`, frame => list.push(JSON.parse(frame.body)));
        }
        clearTimeout(timer); resolve(state);
      }, onWebSocketError: () => { clearTimeout(timer); reject(new Error("M03 WebSocket failed")); },
      onStompError: () => { clearTimeout(timer); reject(new Error("M03 STOMP rejected")); } });
    state.client = client; clients.push(client); client.activate();
  });
}
async function send(state, request) {
  const count = state.terminal.length;
  state.client.publish({ destination: `/app/${request.type === "MAI_HOA" ? "mai-hoa" : "tam-the"}/calculate`,
    body: JSON.stringify(request), headers: { "content-type": "application/json" } });
  const until = Date.now() + 5000;
  while (state.terminal.length === count && Date.now() < until) await new Promise(done => setTimeout(done, 10));
  assert.equal(state.terminal.length, count + 1); const response = state.terminal.at(-1);
  assert.equal(response.requestId, request.requestId); assert.equal(response.type, request.type);
  assert.equal(isCalculationResponse(response), true); results.push({ session: state.label, requestId: request.requestId, status: response.status, error: response.error?.code ?? null });
  return response;
}
function failed(response, code) { assert.equal(response.status, "FAILED"); assert.equal(response.error.code, code); }
function fixture(name, response) {
  if (capture) fs.writeFileSync(url(name), JSON.stringify(response, null, 2) + "\n");
  else assert.deepEqual(response, read(name));
}

try {
  const oa = await owner(), ob = await owner(); const a = await connect("A", oa), b = await connect("B", ob);
  const completed = [];
  for (const name of ["lines-reading", "object-reading", "time-reading", "lines-season"]) {
    const request = read(`m03-${name}.request.json`); const response = await send(a, request);
    assert.equal(response.status, "COMPLETED"); const detail = response.data.detailedReading;
    assert.equal(detail.bundleId, "M01-READINGS-20261026-V1"); assert.equal(detail.phases.length, 4);
    assert.equal(response.data.ruleBasis, "TEAM_DECISION"); assert.equal(response.data.sourceStatus, "SOURCE_AMBIGUOUS");
    assert.equal(detail.season.status, ["time-reading", "lines-season"].includes(name) ? "EVALUATED" : "NOT_EVALUATED");
    assert.deepEqual(a.progress.filter(p => p.requestId === request.requestId).map(p => p.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
    assert.ok(response.data.calculationSteps.some(s => s.code === "READING_BODY_USE"));
    assert.ok(detail.phases.every(p => p.ruleBasis === "SOURCE_VERIFIED" && p.sourceStatus === "VERIFIED" && p.sourceReferences.length));
    fixture(`m03-${name}.response.json`, response); completed.push(response);
  }
  assert.deepEqual(completed[0].data.detailedReading.phases.map(p => p.relation),
    ["USE_CONTROLS_BODY", "SAME_ELEMENT", "BODY_CONTROLS_USE", "USE_GENERATES_BODY"]);
  assert.equal(completed[0].data.primaryHexagram.name, "Cách"); assert.equal(completed[0].data.changedHexagram.name, "Hàm");
  const lines = read("m03-lines-reading.request.json");
  assert.deepEqual(await send(a, lines), completed[0]);
  const topic = structuredClone(lines); topic.payload.reading.topic = "CAREER"; failed(await send(a, topic), "INVALID_INPUT");
  const changedContext = structuredClone(lines); changedContext.payload.reading.context = { datetime: "2024-02-10T09:00:00+07:00" };
  failed(await send(a, changedContext), "INVALID_INPUT");
  assert.equal(b.terminal.length, 0); assert.deepEqual((await send(b, lines)).data, completed[0].data);
  const missingTopic = structuredClone(lines); missingTopic.requestId = requestId(74); missingTopic.payload.reading = null;
  failed(await send(a, missingTopic), "INVALID_INPUT");
  const time = read("m03-time-reading.request.json"); time.requestId = requestId(75); time.payload.reading.context = {};
  failed(await send(a, time), "INVALID_INPUT");
  const extended = read("m02-wealth-extended.request.json"); extended.requestId = requestId(76);
  const expanded = await send(a, extended); assert.equal(expanded.status, "COMPLETED");
  assert.equal(expanded.data.coverageMode, "EXTENDED");
  for (const [i, name] of ["mai-hoa-lines", "mai-hoa-object-count", "mai-hoa-time", "tam-the-wealth"].entries()) {
    const legacy = read(`${name}.request.json`); legacy.requestId = requestId(80 + i);
    assert.deepEqual((await send(a, legacy)).data, read(`${name}.response.json`).data);
  }
  // Store actual Server-generated results, not client-provided snapshots or schema examples.
  for (const response of completed) {
    const saved = (await http("POST", "/api/v1/history", { calculationRequestId: response.requestId, title: "M03 service acceptance" }, oa, 201)).value;
    assert.deepEqual(saved.data.result, response.data);
    const detail = (await http("GET", `/api/v1/history/${saved.data.id}`, undefined, oa)).value;
    assert.deepEqual(detail.data.result, response.data);
    await http("GET", `/api/v1/history/${saved.data.id}`, undefined, ob, 404);
    await http("DELETE", `/api/v1/history/${saved.data.id}`, undefined, ob, 404);
    await http("DELETE", `/api/v1/history/${saved.data.id}`, undefined, oa);
  }
  await new Promise(done => setTimeout(done, 100)); assert.equal(a.terminal.length, 14); assert.equal(b.terminal.length, 1);
  const report = { task: "M03", status: "PASS", sessions: 2, terminalResponses: results.length,
    progressEvents: a.progress.length + b.progress.length, httpRequests: httpCount, realResultsSavedAndRead: completed.length,
    fixturesCaptured: capture, scope: "Real Mai Hoa readings for LINES/OBJECT_COUNT/TIME, optional season, history/owner, replay/session and legacy; Tam The EXTENDED compatibility after D04", cases: results };
  fs.writeFileSync(new URL("../../scripts/generated/m03_live_acceptance.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
} finally { await Promise.all(clients.map(client => client.deactivate())); }
