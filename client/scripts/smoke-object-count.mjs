import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

// Functional verification against a bit oracle, not a performance benchmark.
const url = process.env.WS_URL ?? "ws://localhost:8080/ws";
const clients = [], frames = [], faults = [];
const patterns = [0, 7, 3, 5, 1, 6, 2, 4, 0];
const codes = ["", "CAN", "DOAI", "LY", "CHAN", "TON", "KHAM", "CAN2", "KHON"];
const bits = (value) => value.reduce((sum, yang, i) => sum | (yang ? 1 << i : 0), 0);
const payload = (objectCount, hourIndex) => ({ method: "OBJECT_COUNT", objectCount, hourIndex });

function connect(label) {
  return new Promise((resolve, reject) => {
    const pending = new Map();
    const timer = setTimeout(() => { void client.deactivate(); reject(new Error("Connect timeout")); }, 8000);
    const client = new Client({
      webSocketFactory: () => new WebSocket(url), reconnectDelay: 0,
      onConnect: () => {
        clearTimeout(timer);
        for (const queue of ["progress", "results", "errors"]) {
          client.subscribe(`/user/queue/${queue}`, (message) => {
            try {
              const body = JSON.parse(message.body);
              frames.push({ label, queue, body });
              const waiting = pending.get(body.requestId);
              if (!waiting) { faults.push(`${label}: unexpected/late/duplicate frame`); return; }
              if (queue === "progress") waiting.progress.push(body);
              else {
                pending.delete(body.requestId); clearTimeout(waiting.timer);
                waiting.resolve({ body, queue, progress: waiting.progress });
              }
            } catch (error) { faults.push(error.message); }
          });
        }
        resolve({ label, client, pending });
      },
      onWebSocketError: () => { clearTimeout(timer); reject(new Error("WebSocket failed")); },
      onStompError: () => { clearTimeout(timer); faults.push("STOMP protocol error"); reject(new Error("STOMP rejected")); },
    });
    clients.push(client); client.activate();
  });
}
function send(state, input, requestId = crypto.randomUUID()) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { state.pending.delete(requestId); reject(new Error("Response timeout")); }, 10000);
    state.pending.set(requestId, { resolve, timer, progress: [] });
    state.client.publish({ destination: "/app/mai-hoa/calculate", headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, type: "MAI_HOA", payload: input }) });
  });
}
function steps(result, expected) {
  assert.deepEqual(result.progress.map((p) => p.step), expected);
  assert.deepEqual(result.progress.map((p) => p.sequence), expected.map((_, i) => i + 1));
  assert.ok(result.progress.every((p) => p.requestId === result.body.requestId && p.type === "MAI_HOA"));
}
function verify(result, count, hour) {
  steps(result, ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  assert.equal(result.queue, "results"); assert.equal(result.body.status, "COMPLETED");
  assert.equal(result.body.error, null); assert.equal(result.body.type, "MAI_HOA");
  const d = result.body.data;
  const upper = (count - 1) % 8 + 1, lower = (hour - 1) % 8 + 1, moving = (count + hour - 1) % 6 + 1;
  const primary = patterns[lower] | (patterns[upper] << 3);
  assert.equal(d.method, "OBJECT_COUNT"); assert.equal(d.ruleVersion, "1.0");
  assert.equal(d.ruleBasis, "TEAM_DECISION"); assert.equal(d.sourceStatus, "SOURCE_AMBIGUOUS");
  assert.deepEqual(d.rules.map((r) => r.ruleCode), ["MH-OBJECT-COUNT", "MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE"]);
  assert.equal(d.rules[0].executionPolicy, "TEAM_DECISION"); assert.equal(d.rules[0].sourceStatus, "SOURCE_AMBIGUOUS");
  assert.ok(d.rules.slice(1).every((r) => r.sourceStatus === "VERIFIED" && r.executionPolicy === "SOURCE_VERIFIED"));
  assert.deepEqual(d.sourceReferences.map((s) => s.pdfPage), [46, 39, 42, 41]);
  assert.ok(d.sourceReferences.every((s) => s.sourceId === "MH" && s.printedPage && /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(d.decisionReferences[0].decisionId, "DEC-20261022-MH-OBJECT-COUNT");
  assert.deepEqual(Object.keys(d.decisionReferences[0]).sort(), ["decidedAt", "decisionId", "description", "document"]);
  assert.deepEqual(Object.keys(d.rules[0].decisionReferences[0]).sort(), ["decidedAt", "decisionId", "description", "document"]);
  assert.equal(d.movingLine, moving); assert.equal(d.lunarDate, null);
  assert.deepEqual(d.calculationSteps.map((s) => s.code), ["OBJECT_COUNT_NUMBERS", "MUTUAL", "CHANGE"]);
  assert.equal(d.calculationSteps[0].values.movingLineSum, count + hour);
  assert.equal(d.primaryHexagram.code, `H_${codes[upper]}_${codes[lower]}`);
  assert.equal(bits(d.primaryHexagram.linesBottomUp), primary);
  assert.equal(bits(d.mutualHexagram.linesBottomUp), ((primary >> 1) & 7) | (((primary >> 2) & 7) << 3));
  assert.equal(bits(d.changedHexagram.linesBottomUp), primary ^ (1 << (moving - 1)));
  for (const h of [d.primaryHexagram, d.mutualHexagram, d.changedHexagram]) {
    assert.equal(h.nameStatus, "VERIFIED"); assert.ok(h.name);
    assert.equal(h.linesBottomUp.length, 6); assert.ok(h.linesBottomUp.every((v) => typeof v === "boolean"));
  }
  assert.ok(!JSON.stringify(result.body).includes("private-question-sentinel"));
}

let passed = false;
try {
  const a = await connect("A"), b = await connect("B");
  const sharedId = crypto.randomUUID();
  const [firstA, firstB] = await Promise.all([
    send(a, { ...payload(12, 8), question: "private-question-sentinel" }, sharedId), send(b, payload(24, 12), sharedId),
  ]);
  verify(firstA, 12, 8); verify(firstB, 24, 12);
  assert.deepEqual([firstA.body.data.primaryHexagram.name, firstA.body.data.mutualHexagram.name,
    firstA.body.data.changedHexagram.name], ["Dự", "Kiển", "Giải"]);
  const counts = [...Array.from({ length: 24 }, (_, i) => i + 1), 999998, 999999];
  await Promise.all([a, b].map(async (state, clientIndex) => {
    for (let i = clientIndex; i < counts.length; i += 2) {
      for (let hour = 1; hour <= 12; hour++) verify(await send(state, payload(counts[i], hour)), counts[i], hour);
    }
  }));
  for (const input of [payload(-1, 8), payload(0, 8), payload(1000000, 8), payload(1.5, 8),
    payload("12", 8), payload(null, 8), payload(12, 0), payload(12, 13), payload(4294967297, 8), payload(12, 4294967297)]) {
    const result = await send(a, input);
    steps(result, ["ACCEPTED", "VALIDATING"]);
    assert.equal(result.queue, "errors"); assert.equal(result.body.error.code, "INVALID_INPUT");
    assert.equal(result.body.status, "FAILED"); assert.equal(result.body.data, null);
  }
  assert.deepEqual(faults, []);
  assert.equal(frames.filter((f) => f.queue !== "progress").length, 324);
  assert.equal(frames.filter((f) => f.queue === "progress").length, 1276);
  passed = true;
  console.log("OBJECT_COUNT passed: 314 valid + 10 invalid terminal responses, 1276 progress; full 24x12 cycle, extremes, source policy and two-session isolation.");
} finally {
  await Promise.all(clients.map((c) => c.deactivate()));
  if (process.env.OBJECT_COUNT_REPORT_PATH) {
    const output = path.resolve(process.env.OBJECT_COUNT_REPORT_PATH);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ passed, faults, frames }, null, 2) + "\n");
  }
}
