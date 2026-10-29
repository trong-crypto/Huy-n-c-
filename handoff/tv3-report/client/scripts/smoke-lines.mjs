import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

// Functional verification, not a latency/throughput benchmark.
const url = process.env.WS_URL ?? "ws://localhost:8080/ws";
const clients = [];
const frames = [];
const progressFrames = [];
const errors = [];
const capturedAt = new Date().toISOString();
const lines = (bits) => Array.from({ length: 6 }, (_, i) => Boolean(bits & (1 << i)));
const bits = (value) => value.reduce((sum, yang, i) => sum | (yang ? 1 << i : 0), 0);

function connect(label) {
  return new Promise((resolve, reject) => {
    const state = { label, inbox: [], pending: new Map(), client: null };
    const timer = setTimeout(() => { void state.client.deactivate(); reject(new Error("Connection timeout")); }, 8000);
    const client = new Client({
      webSocketFactory: () => new WebSocket(url), reconnectDelay: 0,
      onConnect: () => {
        clearTimeout(timer);
        for (const destination of ["/user/queue/progress", "/user/queue/results", "/user/queue/errors"]) {
          client.subscribe(destination, (message) => {
            try {
              const body = JSON.parse(message.body);
              if (destination === "/user/queue/progress") {
                progressFrames.push({ client: label, destination, body });
                const waiting = state.pending.get(body.requestId);
                if (!waiting) { errors.push(`${label}: unexpected/late progress`); return; }
                waiting.progress.push(body);
                return;
              }
              state.inbox.push({ destination, body });
              frames.push({ client: label, destination, body });
              const waiting = state.pending.get(body.requestId);
              if (!waiting) { errors.push(`${label}: unexpected/duplicate requestId`); return; }
              state.pending.delete(body.requestId);
              clearTimeout(waiting.timer);
              waiting.resolve({ destination, body, progress: waiting.progress });
            } catch (error) { errors.push(error.message); }
          });
        }
        resolve(state);
      },
      onWebSocketError: () => { clearTimeout(timer); reject(new Error("WebSocket connection failed")); },
      onStompError: () => { clearTimeout(timer); errors.push("STOMP protocol error"); reject(new Error("STOMP protocol error")); },
    });
    state.client = client;
    clients.push(client);
    client.activate();
  });
}

function send(state, payload, requestId = crypto.randomUUID()) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { state.pending.delete(requestId); reject(new Error(`${state.label}: response timeout`)); }, 10000);
    state.pending.set(requestId, { resolve, reject, timer, progress: [] });
    state.client.publish({ destination: "/app/mai-hoa/calculate", headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, type: "MAI_HOA", payload }) });
  });
}

function verify(result, pattern, movingLine) {
  assert.deepEqual(result.progress.map((event) => event.sequence), [1, 2, 3, 4]);
  assert.deepEqual(result.progress.map((event) => event.step), ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
  assert.ok(result.progress.every((event) => event.requestId === result.body.requestId && event.type === "MAI_HOA"));
  assert.equal(result.destination, "/user/queue/results");
  const response = result.body;
  assert.equal(response.status, "COMPLETED");
  assert.equal(response.type, "MAI_HOA");
  assert.equal(response.error, null);
  const data = response.data;
  assert.equal(data.method, "LINES");
  assert.equal(data.ruleVersion, "1.0");
  assert.equal(data.ruleBasis, "SOURCE_VERIFIED");
  assert.equal(data.sourceStatus, "VERIFIED");
  assert.equal(data.movingLine, movingLine);
  assert.equal(data.lunarDate, null);
  assert.deepEqual(data.rules.map((r) => r.ruleCode), ["MH-MUTUAL", "MH-CHANGE"]);
  assert.ok(data.rules.every((r) => r.sourceStatus === "VERIFIED" && r.executionPolicy === "SOURCE_VERIFIED"));
  assert.deepEqual(data.sourceReferences.map((s) => s.pdfPage), [42, 41]);
  assert.ok(data.sourceReferences.every((s) => s.sourceId === "MH" && s.printedPage && /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.deepEqual(data.decisionReferences, []);
  assert.deepEqual(data.calculationSteps.map((step) => step.code), ["MUTUAL", "CHANGE"]);
  for (const hexagram of [data.primaryHexagram, data.mutualHexagram, data.changedHexagram]) {
    assert.match(hexagram.code, /^H_[A-Z0-9]+_[A-Z0-9]+$/);
    assert.equal(hexagram.linesBottomUp.length, 6);
    assert.ok(hexagram.linesBottomUp.every((line) => typeof line === "boolean"));
    if (hexagram.nameStatus !== "VERIFIED") assert.equal(hexagram.name, null);
  }
  assert.equal(bits(data.primaryHexagram.linesBottomUp), pattern);
  assert.equal(bits(data.mutualHexagram.linesBottomUp), ((pattern >> 1) & 7) | (((pattern >> 2) & 7) << 3));
  assert.equal(bits(data.changedHexagram.linesBottomUp), pattern ^ (1 << (movingLine - 1)));
}

let passed = false;
try {
  const a = await connect("A"), b = await connect("B");
  const sharedId = crypto.randomUUID();
  const [firstA, firstB] = await Promise.all([
    send(a, { method: "LINES", linesBottomUp: lines(21), movingLine: 2 }, sharedId),
    send(b, { method: "LINES", linesBottomUp: lines(63), movingLine: 6 }, sharedId),
  ]);
  verify(firstA, 21, 2); verify(firstB, 63, 6);
  assert.equal(firstA.body.data.primaryHexagram.code, "H_KHAM_LY");
  assert.equal(firstA.body.data.mutualHexagram.code, "H_LY_KHAM");
  assert.equal(firstA.body.data.changedHexagram.code, "H_KHAM_CAN");
  assert.equal(firstA.body.data.primaryHexagram.name, "Ký tế");
  assert.equal(firstA.body.data.mutualHexagram.name, "Vị tế");
  assert.equal(firstA.body.data.changedHexagram.name, "Nhu");
  // Run both sessions concurrently, with at most one request in flight per session.
  await Promise.all([a, b].map(async (state, clientIndex) => {
    for (let pattern = clientIndex; pattern < 64; pattern += 2) {
      for (let movingLine = 1; movingLine <= 6; movingLine++) {
        verify(await send(state, { method: "LINES", linesBottomUp: lines(pattern), movingLine }), pattern, movingLine);
      }
    }
  }));
  const invalid = await send(a, { method: "LINES", linesBottomUp: lines(21), movingLine: 7 });
  assert.equal(invalid.destination, "/user/queue/errors");
  assert.equal(invalid.body.status, "FAILED");
  assert.equal(invalid.body.error.code, "INVALID_INPUT");
  assert.equal(invalid.body.data, null);
  assert.deepEqual(invalid.progress.map((event) => event.sequence), [1, 2]);
  assert.deepEqual(invalid.progress.map((event) => event.step), ["ACCEPTED", "VALIDATING"]);
  assert.equal(a.inbox.length, 194);
  assert.equal(b.inbox.length, 193);
  assert.deepEqual(errors, []);
  passed = true;
  assert.equal(progressFrames.length, 1546);
  console.log("LINES STOMP passed: 387 terminal responses, 1546 ordered progress events; two sessions sharing one requestId stay isolated.");
} finally {
  await Promise.all(clients.map((client) => client.deactivate()));
  if (errors.length) passed = false;
  if (process.env.LINES_REPORT_PATH) {
    const output = path.resolve(process.env.LINES_REPORT_PATH);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ capturedAt, passed, frames, progressFrames, errors }, null, 2) + "\n");
  }
  assert.deepEqual(errors, [], "No protocol/duplicate/cross-session messages may arrive during disconnect");
}
