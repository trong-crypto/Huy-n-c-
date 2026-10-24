import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

const url = process.env.WS_URL ?? "ws://localhost:8080/ws";
const clients = [], evidence = [];
async function until(check, message) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
function connect(label) {
  return new Promise((resolve, reject) => {
    const state = { label, terminal: [], progress: [], protocol: [], closed: false, client: null };
    const timer = setTimeout(() => reject(new Error("Connection timeout")), 5000);
    state.client = new Client({
      webSocketFactory: () => new WebSocket(url), reconnectDelay: 0,
      onConnect: () => {
        clearTimeout(timer);
        for (const queue of ["progress", "results", "errors"]) {
          state.client.subscribe(`/user/queue/${queue}`, (message) => {
            const body = JSON.parse(message.body);
            (queue === "progress" ? state.progress : state.terminal).push(body);
            evidence.push({ label, queue, body });
          });
        }
        resolve(state);
      },
      onStompError: (frame) => {
        state.protocol.push(frame.headers.message);
        evidence.push({ label, protocol: frame.headers.message, body: frame.body });
      },
      onWebSocketError: () => { clearTimeout(timer); reject(new Error("WebSocket failed")); },
      onWebSocketClose: () => { state.closed = true; },
    });
    clients.push(state.client); state.client.activate();
  });
}
const linesPayload = { method: "LINES", linesBottomUp: [true, false, true, false, true, false], movingLine: 2 };
function publish(state, body, destination = "/app/mai-hoa/calculate") {
  state.client.publish({ destination, body, headers: { "content-type": "application/json" } });
}
async function request(state, payload, type = "MAI_HOA", id = crypto.randomUUID()) {
  const before = state.terminal.length;
  publish(state, JSON.stringify({ requestId: id, type, payload }), type === "MAI_HOA" ? "/app/mai-hoa/calculate" : "/app/tam-the/calculate");
  await until(() => state.terminal.length > before, "No terminal response");
  return { response: state.terminal.at(-1), progress: state.progress.filter((p) => p.requestId === id), id };
}
function prefix(result, steps) {
  assert.deepEqual(result.progress.map((p) => p.sequence), steps.map((_, i) => i + 1));
  assert.deepEqual(result.progress.map((p) => p.step), steps);
}

let passed = false;
try {
  const a = await connect("A");
  if (process.env.EXPECT_SERVER_TIMEOUT === "1") {
    const result = await request(a, linesPayload);
    assert.equal(result.response.status, "FAILED");
    assert.equal(result.response.error.code, "PROCESSING_TIMEOUT");
    assert.deepEqual(result.progress.map((p) => p.sequence), result.progress.map((_, i) => i + 1));
    // Observe for a late completion after the real DB query finishes; no production delay is injected.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(a.terminal.length, 1);
    assert.ok(a.terminal.every((r) => r.status === "FAILED"));
    console.log("Server timeout over real DB work passed: one PROCESSING_TIMEOUT, no late COMPLETED.");
  } else {
    for (const body of ["{", "{\"requestId\":\"x\",\"requestId\":\"y\"}", "{} {}"] ) {
      const before = a.terminal.length;
      publish(a, body);
      await until(() => a.terminal.length === before + 1, "Malformed JSON was not rejected");
      assert.equal(a.terminal.at(-1).error.code, "INVALID_INPUT");
      assert.equal(a.terminal.at(-1).requestId, null);
      assert.equal(a.progress.length, 0);
    }
    const invalid = await request(a, { ...linesPayload, movingLine: 7 });
    assert.equal(invalid.response.error.code, "INVALID_INPUT"); prefix(invalid, ["ACCEPTED", "VALIDATING"]);
    const unavailable = await request(a, { method: "TIME", datetime: "2026-10-24T08:00:00+07:00" });
    assert.equal(unavailable.response.error.code, "RULE_NOT_AVAILABLE"); prefix(unavailable, ["ACCEPTED", "VALIDATING"]);
    const tamThe = await request(a, { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false }, "TAM_THE");
    assert.equal(tamThe.response.error.code, "RULE_NOT_AVAILABLE"); prefix(tamThe, ["ACCEPTED", "VALIDATING"]);
    const valid = await request(a, linesPayload);
    assert.equal(valid.response.status, "COMPLETED"); prefix(valid, ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
    a.client.forceDisconnect();
    await until(() => a.closed, "Disconnect did not finish");
    const b = await connect("B");
    const afterReconnect = await request(b, linesPayload, "MAI_HOA", valid.id);
    assert.equal(afterReconnect.response.status, "COMPLETED"); prefix(afterReconnect, ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]);
    for (const [action, destination] of [
      ["subscribe", "/queue/progress-userVictim"], ["subscribe", "/user/Victim/queue/results"],
      ["send", "/queue/results"],
    ]) {
      const attacker = await connect(`denied-${action}-${destination}`);
      if (action === "subscribe") attacker.client.subscribe(destination, () => assert.fail("Forbidden queue delivered a message"));
      else publish(attacker, "{}", destination);
      await until(() => attacker.protocol.length > 0 && attacker.closed, "Forbidden destination not rejected");
      assert.equal(attacker.protocol[0], "STOMP_FRAME_REJECTED");
    }
    assert.equal(b.terminal.length, 1);
    console.log("Progress/error STOMP passed: JSON rejection and recovery, real step prefixes, reconnect, forbidden SUBSCRIBE/SEND rejected.");
  }
  passed = true;
} finally {
  await Promise.all(clients.map((client) => client.deactivate()));
  if (process.env.PROGRESS_REPORT_PATH) {
    const output = path.resolve(process.env.PROGRESS_REPORT_PATH);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ passed, evidence }, null, 2) + "\n");
  }
}
