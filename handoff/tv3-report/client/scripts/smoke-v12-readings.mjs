// Deployment acceptance: anonymous STOMP and GET only. Never creates owners or writes history.
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";

const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const base = process.env.V12_HTTP_URL ?? "http://127.0.0.1:18089";
const origin = process.env.V12_ORIGIN ?? "http://localhost:3000";
const fixture = name => JSON.parse(fs.readFileSync(new URL(`../../docs/examples/${name}`, import.meta.url), "utf8"));
const data = name => JSON.parse(fs.readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const approved = data("m01_reviewed_readings.json"), loc = data("tam_the_d02_source.json");
const mappings = new Map(approved.tamTheMappings.map(row => [`${row.ruleCode}/${row.lookupKey}`, row.resultCode]));
const texts = new Map(approved.tamTheResults.map(row => [row.code, row]));
const years = fs.readFileSync(new URL("../../data/tam_the_year_elements.csv", import.meta.url), "utf8")
  .trim().split(/\r?\n/).slice(1).map(row => row.split(","));
const id = n => `550e8400-e29b-41d4-a716-44665544${String(n).padStart(4, "0")}`;
const clients = [], cases = [];
const sourceOrderFixturesRefreshed = [];
function normalizeSourceOrder(value) {
  if (Array.isArray(value)) return value.map(normalizeSourceOrder);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const normalized = normalizeSourceOrder(child);
    if (key === "sourceReferences" && Array.isArray(normalized)) {
      const identity = source => JSON.stringify(Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b))));
      normalized.sort((a, b) => identity(a).localeCompare(identity(b)));
    }
    return [key, normalized];
  }));
  return value;
}
function matchFixture(name, response) {
  const expected = fixture(`${name}.response.json`);
  try { assert.deepEqual(response, expected); }
  catch (failure) {
    if (process.env.V12_CAPTURE_SOURCE_ORDER_FIX !== "1" || !name.startsWith("d04-")) throw failure;
    // This one-time migration check can refresh source array order only; any text/key/source-set change still fails.
    assert.deepEqual(normalizeSourceOrder(response), normalizeSourceOrder(expected));
    fs.writeFileSync(new URL(`../../docs/examples/${name}.response.json`, import.meta.url), JSON.stringify(response, null, 2) + "\n");
    sourceOrderFixturesRefreshed.push(name);
  }
}

async function connect(label) {
  return new Promise((resolve, reject) => {
    const state = { label, terminal: [], progress: [] };
    const timer = setTimeout(() => reject(new Error("V12 STOMP connect timeout")), 8000);
    const client = new Client({ webSocketFactory: () => new WebSocket(base.replace(/^http/, "ws") + "/ws", { headers: { Origin: origin } }),
      reconnectDelay: 0, onConnect: () => {
        for (const [route, list] of [["results", state.terminal], ["errors", state.terminal], ["progress", state.progress]]) {
          client.subscribe(`/user/queue/${route}`, frame => list.push(JSON.parse(frame.body)));
        }
        clearTimeout(timer); resolve(state);
      }, onStompError: () => { clearTimeout(timer); reject(new Error("V12 STOMP rejected")); },
      onWebSocketError: () => { clearTimeout(timer); reject(new Error("V12 WebSocket unavailable")); } });
    state.client = client; clients.push(client); client.activate();
  });
}
async function send(state, request) {
  const before = state.terminal.length;
  state.client.publish({ destination: `/app/${request.type === "MAI_HOA" ? "mai-hoa" : "tam-the"}/calculate`,
    headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
  const until = Date.now() + 8000;
  while (state.terminal.length === before && Date.now() < until) await new Promise(done => setTimeout(done, 10));
  assert.equal(state.terminal.length, before + 1);
  const response = state.terminal.at(-1);
  assert.equal(response.requestId, request.requestId); assert.equal(response.type, request.type);
  assert.equal(isCalculationResponse(response), true);
  cases.push({ session: state.label, requestId: request.requestId, status: response.status, error: response.error?.code ?? null });
  return response;
}
function progress(state, request) {
  const events = state.progress.filter(p => p.requestId === request.requestId);
  assert.deepEqual(events.map(p => p.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  assert.deepEqual(events.map(p => p.sequence), [1, 2, 3, 4]);
}

try {
  const health = await fetch(base + "/api/v1/health"); assert.equal(health.status, 200); assert.equal((await health.json()).status, "UP");
  const readiness = await fetch(base + "/api/v1/readiness"); assert.equal(readiness.status, 200); assert.equal((await readiness.json()).status, "READY");
  const a = await connect("A"), b = await connect("B");
  for (const name of ["m03-lines-reading", "m03-object-reading", "m03-time-reading", "m03-lines-season",
    "d04-wealth-matched", "d04-wealth-no-loc", "d04-label-aliases", "d04-leap-lunar", "d04-solar-equivalent"]) {
    const request = fixture(`${name}.request.json`);
    matchFixture(name, await send(a, request)); progress(a, request);
  }
  for (const [i, name] of ["mai-hoa-lines", "mai-hoa-object-count", "mai-hoa-time", "tam-the-career", "tam-the-wealth", "tam-the-love"].entries()) {
    const request = fixture(`${name}.request.json`); request.requestId = id(1000 + i);
    assert.deepEqual((await send(a, request)).data, fixture(`${name}.response.json`).data); progress(a, request);
  }
  const replay = fixture("d04-wealth-matched.request.json"), before = a.progress.length;
  assert.deepEqual(await send(a, replay), fixture("d04-wealth-matched.response.json")); assert.equal(a.progress.length, before);
  const conflict = structuredClone(replay); conflict.payload.wealthMode = "LEGACY";
  assert.equal((await send(a, conflict)).error.code, "INVALID_INPUT");
  assert.equal(b.terminal.length, 0);
  const other = structuredClone(replay); other.payload.birthDate = "1984-02-01";
  assert.equal((await send(b, other)).data.categories[0].subreadings[0].status, "NO_SOURCE_MATCH");
  const oldNoLoc = { requestId: id(1010), type: "TAM_THE", payload: { ...other.payload, wealthMode: "LEGACY" } };
  assert.equal((await send(a, oldNoLoc)).error.reason, "LOOKUP_NOT_AVAILABLE");
  let matched = 0, missing = 0;
  for (let year = 1984; year < 2044; year++) for (let month = 1; month <= 12; month++) {
    const request = { requestId: id(2000 + (year - 1984) * 12 + month), type: "TAM_THE", payload: {
      birthDate: `${year}-${String(month).padStart(2, "0")}-01`, birthTime: "08:30", calendarType: "LUNAR", isLeapMonth: false, wealthMode: "EXTENDED" } };
    const response = await send(a, request); assert.equal(response.status, "COMPLETED"); progress(a, request);
    assert.deepEqual(response.data.categories.map(c => c.category), ["CAREER", "WEALTH", "LOVE"]);
    const wealth = response.data.categories[1], subs = wealth.subreadings, row = years[year - 1984], suffix = String(month).padStart(2, "0");
    assert.equal(response.data.coverageMode, "EXTENDED"); assert.equal(response.data.bundleId, approved.bundleId);
    assert.deepEqual(subs.map(s => s.code), ["LOC", "SANG_HEN", "DIEN_SAN"]);
    assert.deepEqual(subs.map(s => s.lookupKey), [`STEM:${row[1]}|MONTH:${suffix}`, `BRANCH:${row[2]}|MONTH:${suffix}`, `ELEMENT:${row[3]}|MONTH:${suffix}`]);
    assert.deepEqual(wealth.entries, subs.flatMap(s => s.entries));
    const expectedLoc = loc.wealth.rows[row[1]].flatMap((m, i) => m === month ? [`WEALTH_C${String(i + 1).padStart(2, "0")}`] : []);
    assert.deepEqual(subs[0].entries.map(e => e.resultCode), expectedLoc);
    if (expectedLoc.length) { matched++; assert.equal(subs[0].status, "MATCHED"); }
    else { missing++; assert.equal(subs[0].status, "NO_SOURCE_MATCH"); assert.equal(subs[0].reason, "NO_PRINTED_INTERSECTION"); }
    for (const sub of subs.slice(1)) {
      const expected = texts.get(mappings.get(`${sub.ruleCode}/${sub.lookupKey}`));
      assert.equal(sub.entries[0].resultCode, expected.code); assert.equal(sub.entries[0].title, expected.title);
      assert.equal(sub.entries[0].content, expected.content);
      assert.deepEqual(sub.decisionReferences.map(d => d.decisionId), expected.decisionIds);
      assert.ok(sub.decisionReferences.every(d => d.ruleBasis === "TEAM_DECISION" && d.sourceStatus === "SOURCE_AMBIGUOUS"));
    }
  }
  assert.equal(matched, 360); assert.equal(missing, 360); assert.equal(b.terminal.length, 1);
  const report = { status: "PASS", scope: "V12 deployment: actual database, anonymous STOMP and GET only", fixturesMatched: 9,
    legacySuccesses: 6, yearMonthCases: 720, locMatched: matched, locNoSourceMatch: missing,
    sessions: 2, terminalResponses: cases.length, progressEvents: a.progress.length + b.progress.length,
    httpGetRequests: 2, persistentOwnersCreated: 0, historyWritesPerformed: 0, cases };
  report.sourceOrderFixturesRefreshed = sourceOrderFixturesRefreshed;
  fs.writeFileSync(new URL("../../scripts/generated/v12_main_acceptance.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
} finally { await Promise.all(clients.map(client => client.deactivate())); }
