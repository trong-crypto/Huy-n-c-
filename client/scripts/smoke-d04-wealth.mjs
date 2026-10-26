// Real Server/DB/STOMP/history acceptance. Never substitutes schema-only examples for service output.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";
const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const base = process.env.D04_HTTP_URL ?? "http://127.0.0.1:18088";
const origin = process.env.D04_ORIGIN ?? "http://localhost:3000";
const capture = process.env.D04_CAPTURE_FIXTURES === "1";
const url = file => new URL(`../../docs/examples/${file}`, import.meta.url);
const read = file => JSON.parse(fs.readFileSync(url(file), "utf8"));
const clients = [], ownerHashes = [], results = [];
let httpCount = 0;
const cleanupFile = new URL("../../scripts/generated/d04_owner_cleanup.json", import.meta.url);
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
    const timer = setTimeout(() => reject(new Error("D04 connect timeout")), 8000);
    const client = new Client({ webSocketFactory: () => new WebSocket(base.replace(/^http/, "ws") + "/ws",
      { headers: { Origin: origin, Cookie: identity.cookie } }), reconnectDelay: 0,
      onConnect: () => {
        for (const [route, list] of [["results", state.terminal], ["errors", state.terminal], ["progress", state.progress]]) {
          client.subscribe(`/user/queue/${route}`, frame => list.push(JSON.parse(frame.body)));
        }
        clearTimeout(timer); resolve(state);
      }, onWebSocketError: () => { clearTimeout(timer); reject(new Error("D04 WebSocket failed")); },
      onStompError: () => { clearTimeout(timer); reject(new Error("D04 STOMP rejected")); } });
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

const rootData = file => JSON.parse(fs.readFileSync(new URL(`../../data/${file}`, import.meta.url), "utf8"));
const approved = rootData("m01_reviewed_readings.json"), oldData = rootData("tam_the_d02_source.json");
const cycle = fs.readFileSync(new URL("../../data/tam_the_year_elements.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map(r => r.split(","));
const mapping = new Map(approved.tamTheMappings.map(r => [`${r.ruleCode}/${r.lookupKey}`, r.resultCode]));
const texts = new Map(approved.tamTheResults.map(r => [r.code, r]));
const lunar = (year, month) => ({ birthDate: `${year}-${String(month).padStart(2, "0")}-01`, birthTime: "08:30",
  calendarType: "LUNAR", isLeapMonth: false, wealthMode: "EXTENDED" });
function extended(response) {
  assert.equal(response.status, "COMPLETED"); assert.equal(response.data.coverageMode, "EXTENDED");
  assert.equal(response.data.bundleId, approved.bundleId);
  const wealth = response.data.categories.find(c => c.category === "WEALTH");
  assert.deepEqual(wealth.subreadings.map(s => s.code), ["LOC", "SANG_HEN", "DIEN_SAN"]);
  assert.deepEqual(wealth.entries, wealth.subreadings.flatMap(s => s.entries));
  for (const sub of wealth.subreadings.slice(1)) {
    assert.equal(sub.status, "MATCHED"); assert.equal(sub.entries.length, 1);
    const code = mapping.get(`${sub.ruleCode}/${sub.lookupKey}`), expected = texts.get(code);
    assert.equal(sub.entries[0].resultCode, code); assert.equal(sub.entries[0].content, expected.content);
    assert.equal(sub.entries[0].title, expected.title); assert.equal(sub.entries[0].subreadingCode, sub.code);
    assert.deepEqual(sub.decisionReferences.map(d => d.decisionId), expected.decisionIds);
    for (const d of sub.decisionReferences) {
      assert.equal(d.ruleBasis, "TEAM_DECISION"); assert.equal(d.sourceStatus, "SOURCE_AMBIGUOUS");
      assert.ok(response.data.editorialDecisions.some(e => e.decisionId === d.decisionId));
    }
    assert.ok(sub.sourceReferences.length);
  }
  return wealth.subreadings;
}

try {
  const oa = await owner(), ob = await owner(); const a = await connect("A", oa), b = await connect("B", ob);
  const completed = [];
  for (const name of ["wealth-matched", "wealth-no-loc", "label-aliases", "leap-lunar", "solar-equivalent"]) {
    const request = read(`d04-${name}.request.json`), response = await send(a, request);
    extended(response); fixture(`d04-${name}.response.json`, response); completed.push(response);
    assert.deepEqual(a.progress.filter(p => p.requestId === request.requestId).map(p => p.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  }
  assert.equal(extended(completed[0])[0].entries.length, 2);
  assert.equal(extended(completed[0])[2].entries[0].title, "Phú / Phá");
  assert.equal(extended(completed[1])[0].status, "NO_SOURCE_MATCH");
  assert.equal(extended(completed[1])[0].reason, "NO_PRINTED_INTERSECTION");
  assert.deepEqual(completed[1].data.categories.map(c => c.category), ["CAREER", "WEALTH", "LOVE"]);
  assert.equal(extended(completed[2])[1].entries[0].title, "Thiên an / Phiên An");
  assert.deepEqual(completed[3].data, completed[4].data);
  const original = read("d04-wealth-matched.request.json"), progressBefore = a.progress.length;
  assert.deepEqual(await send(a, original), completed[0]); assert.equal(a.progress.length, progressBefore);
  const mode = structuredClone(original); mode.payload.wealthMode = "LEGACY"; failed(await send(a, mode), "INVALID_INPUT");
  const date = structuredClone(original); date.payload.birthDate = "1984-02-01"; failed(await send(a, date), "INVALID_INPUT");
  const categories = structuredClone(original); delete categories.payload.categories; failed(await send(a, categories), "INVALID_INPUT");
  assert.equal(b.terminal.length, 0);
  const other = structuredClone(original); other.payload.birthDate = "1984-02-01";
  assert.equal(extended(await send(b, other))[0].status, "NO_SOURCE_MATCH");
  const invalid = structuredClone(original); invalid.requestId = requestId(95); invalid.payload.categories = ["CAREER"];
  failed(await send(a, invalid), "INVALID_INPUT");
  const badDate = structuredClone(original); badDate.requestId = requestId(96); badDate.payload.birthDate = "2100-01-01"; badDate.payload.calendarType = "SOLAR";
  failed(await send(a, badDate), "INVALID_DATE");
  for (const [i, name] of ["tam-the-wealth", "tam-the-career", "tam-the-love"].entries()) {
    const request = read(`${name}.request.json`); request.requestId = requestId(97 + i);
    assert.deepEqual((await send(a, request)).data, read(`${name}.response.json`).data);
  }
  const missing = { requestId: requestId(100), type: "TAM_THE", payload: { ...lunar(1984, 2), wealthMode: "LEGACY" } };
  const noLoc = await send(a, missing); failed(noLoc, "RULE_NOT_AVAILABLE"); assert.equal(noLoc.error.reason, "LOOKUP_NOT_AVAILABLE");
  const maiHoa = read("m03-lines-reading.request.json"); maiHoa.requestId = requestId(101);
  assert.deepEqual((await send(a, maiHoa)).data, read("m03-lines-reading.response.json").data);
  let locMatched = 0, locMissing = 0;
  for (let year = 1984; year < 2044; year++) for (let month = 1; month <= 12; month++) {
    const request = { requestId: requestId(200 + (year - 1984) * 12 + month), type: "TAM_THE", payload: lunar(year, month) };
    const response = await send(a, request), subs = extended(response), row = cycle[year - 1984], suffix = String(month).padStart(2, "0");
    assert.deepEqual(response.data.categories.map(c => c.category), ["CAREER", "WEALTH", "LOVE"]);
    assert.deepEqual(subs.map(s => s.lookupKey), [`STEM:${row[1]}|MONTH:${suffix}`, `BRANCH:${row[2]}|MONTH:${suffix}`, `ELEMENT:${row[3]}|MONTH:${suffix}`]);
    const expectedLoc = oldData.wealth.rows[row[1]].flatMap((m, i) => m === month ? [`WEALTH_C${String(i + 1).padStart(2, "0")}`] : []);
    assert.deepEqual(subs[0].entries.map(e => e.resultCode), expectedLoc);
    if (expectedLoc.length) { locMatched++; assert.equal(subs[0].status, "MATCHED"); }
    else { locMissing++; assert.equal(subs[0].status, "NO_SOURCE_MATCH"); assert.equal(subs[0].reason, "NO_PRINTED_INTERSECTION"); }
    assert.deepEqual(a.progress.filter(p => p.requestId === request.requestId).map(p => p.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  }
  assert.equal(locMatched, 360); assert.equal(locMissing, 360);
  // Save actual Server-created snapshots, including missing Loc and leap-month cases.
  for (const response of completed) {
    const saved = (await http("POST", "/api/v1/history", { calculationRequestId: response.requestId, title: "D04 service acceptance" }, oa, 201)).value;
    assert.deepEqual(saved.data.result, response.data);
    assert.deepEqual((await http("GET", `/api/v1/history/${saved.data.id}`, undefined, oa)).value.data.result, response.data);
    await http("GET", `/api/v1/history/${saved.data.id}`, undefined, ob, 404);
    await http("DELETE", `/api/v1/history/${saved.data.id}`, undefined, ob, 404);
    await http("DELETE", `/api/v1/history/${saved.data.id}`, undefined, oa);
  }
  await new Promise(done => setTimeout(done, 100)); assert.equal(b.terminal.length, 1);
  const report = { task: "D04", status: "PASS", sessions: 2, terminalResponses: results.length,
    progressEvents: a.progress.length + b.progress.length, httpRequests: httpCount, realResultsSavedAndRead: completed.length,
    yearMonthCases: 720, locMatched, locMissing, fixturesCaptured: capture,
    scope: "Real extended Tam The for all 720 year-months, honest Loc no-match, aliases, solar/lunar leap, owner/history, replay/session, legacy and M03", cases: results };
  fs.writeFileSync(new URL("../../scripts/generated/d04_live_acceptance.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
} finally { await Promise.all(clients.map(client => client.deactivate())); }

