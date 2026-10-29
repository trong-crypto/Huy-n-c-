// X01.5: real anonymous WebSockets. Reliability evidence is separate from latency samples.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as pause } from "node:timers/promises";
import { parseArgs } from "node:util";
import readline from "node:readline";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";
import { workload, validateLines, validateProgress } from "./lib/x01-benchmark.mjs";

const { values } = parseArgs({ options: { suite: { type: "string" }, target: { type: "string" }, output: { type: "string" } } });
assert.ok(["idempotency", "overload"].includes(values.suite));
const target = JSON.parse(fs.readFileSync(values.target, "utf8").replace(/^\uFEFF/, ""));
assert.match(target.database, /^huyenco_benchmark_test_\d{8}_\d{6}$/);
assert.equal(target.webSocketUrl, "ws://127.0.0.1:18091/ws");
assert.equal(target.origin, "http://127.0.0.1:3173");
fs.mkdirSync(values.output, { recursive: false });
const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const events = [], records = [], states = [], cases = [], fatal = [], pendingRpc = new Map();
let sequence = 0, rpcSequence = 0, failed = null;
const clock = () => performance.now();
function event(kind, fields = {}) { const row = { sequence: ++sequence, monoMs: clock(), kind, ...fields }; events.push(row); return row; }
const inputLines = readline.createInterface({ input: process.stdin });
inputLines.on("line", line => {
  const reply = JSON.parse(line), pending = pendingRpc.get(reply.rpcId);
  if (!pending) return;
  pendingRpc.delete(reply.rpcId); clearTimeout(pending.timer);
  if (reply.error) pending.reject(new Error(reply.error)); else pending.resolve(reply.result);
});
function control(action) {
  const rpcId = ++rpcSequence;
  event("CONTROL_REQUEST", { rpcId, action });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingRpc.delete(rpcId); reject(new Error(`Control timeout: ${action}`)); }, 6000);
    pendingRpc.set(rpcId, { resolve: result => { event("CONTROL_RESULT", { rpcId, action, result }); resolve(result); }, reject, timer });
    process.stdout.write(JSON.stringify({ rpcId, action }) + "\n");
  });
}
async function until(predicate, reason, timeout = 15000) {
  const end = clock() + timeout;
  while (!predicate()) {
    assert.equal(fatal.length, 0, JSON.stringify(fatal));
    if (clock() >= end) throw new Error(`Timeout: ${reason}`);
    await pause(5);
  }
}
function trace(record, offset = 0) { return record.frames.slice(offset); }
const terminal = frames => frames.filter(frame => frame.destination !== "progress");
const successful = frames => terminal(frames).filter(frame => frame.body.status === "COMPLETED");
const errors = frames => terminal(frames).filter(frame => frame.body.status === "FAILED");
function assertCycle(frames, errorCode = null) {
  const progress = frames.filter(frame => frame.destination === "progress").map(frame => frame.body);
  validateProgress(progress, errorCode === null);
  assert.equal(terminal(frames).length, 1, "Exactly one terminal required");
  if (errorCode) {
    assert.equal(errors(frames).length, 1); assert.equal(errors(frames)[0].body.error.code, errorCode);
    assert.equal(progress.length, 0, "Admission rejection must not execute business progress");
  } else assert.equal(successful(frames).length, 1);
}
function register(state, input, id = randomUUID(), label = "") {
  const key = id.toLowerCase(); assert.ok(!state.records.has(key));
  const record = { clientId: state.id, requestId: key, input, label, frames: [], sends: [] };
  state.records.set(key, record); records.push(record); return record;
}
function send(state, record, { input = record.input, uppercase = false, reordered = false, role = "original" } = {}) {
  const id = uppercase ? record.requestId.toUpperCase() : record.requestId;
  const request = reordered ? { payload: { movingLine: input.movingLine,
    linesBottomUp: input.payload.linesBottomUp, method: "LINES" }, type: "MAI_HOA", requestId: id }
    : { requestId: id, type: "MAI_HOA", payload: input.payload };
  const row = event("SEND", { clientId: state.id, requestId: record.requestId, wireRequestId: id, role, request });
  record.sends.push(row);
  state.client.publish({ destination: "/app/mai-hoa/calculate", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
  return row;
}
async function connect(label) {
  const state = { id: label, records: new Map(), closing: false, connected: false, httpStatus: null };
  states.push(state);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connect timeout")), 10000);
    state.client = new Client({
      webSocketFactory: () => {
        const socket = new WebSocket(target.webSocketUrl, { origin: target.origin, followRedirects: false });
        socket.on("upgrade", response => { state.httpStatus = response.statusCode; }); return socket;
      }, reconnectDelay: 0, connectionTimeout: 10000, heartbeatIncoming: 0, heartbeatOutgoing: 0,
      onConnect: () => {
        clearTimeout(timer); state.connected = true; event("CONNECTED", { clientId: state.id, httpStatus: state.httpStatus });
        for (const destination of ["progress", "results", "errors"]) state.client.subscribe(`/user/queue/${destination}`, frame => {
          try {
            const body = JSON.parse(frame.body), record = state.records.get(body.requestId?.toLowerCase());
            assert.ok(record, "Unknown ID or cross-session event"); assert.equal(body.type, "MAI_HOA");
            if (destination === "progress") assert.ok(Number.isInteger(body.sequence));
            else {
              assert.ok(isCalculationResponse(body), "Terminal contract differs");
              if (body.status === "COMPLETED") { assert.equal(destination, "results"); validateLines(body, record.input, isCalculationResponse); }
              else { assert.equal(destination, "errors"); assert.ok(["SERVER_BUSY", "INVALID_INPUT"].includes(body.error.code)); }
            }
            record.frames.push(event("RECEIVE", { clientId: state.id, requestId: record.requestId, destination, body }));
          } catch (error) { fatal.push(event("PROTOCOL_FAILURE", { clientId: state.id, reason: error.message })); }
        });
        resolve();
      },
      onStompError: () => { clearTimeout(timer); fatal.push(event("STOMP_ERROR", { clientId: state.id })); reject(new Error("STOMP error")); },
      onWebSocketError: () => { clearTimeout(timer); fatal.push(event("SOCKET_ERROR", { clientId: state.id })); reject(new Error("WS error")); },
      onWebSocketClose: () => { state.connected = false; event("DISCONNECTED", { clientId: state.id, intentional: state.closing });
        if (!state.closing) { clearTimeout(timer); fatal.push({ code: "Unexpected disconnect", clientId: state.id }); reject(new Error("Disconnect")); } },
    }); state.client.activate();
  });
  assert.equal(state.httpStatus, 101); return state;
}
async function disconnect(state) { state.closing = true; await state.client.deactivate(); }
async function complete(state, input, label = "", id = randomUUID()) {
  const record = register(state, input, id, label); send(state, record);
  await until(() => terminal(record.frames).length === 1, label); assertCycle(record.frames); return record;
}
async function quiet(ms = 180) { await pause(ms); assert.equal(fatal.length, 0, JSON.stringify(fatal)); }
async function test(name, action) {
  const start = event("CASE_START", { name });
  try { const details = await action(); cases.push({ name, status: "PASS", startSequence: start.sequence, endSequence: sequence, details }); }
  catch (error) { cases.push({ name, status: "FAIL", startSequence: start.sequence, endSequence: sequence, reason: error.message }); throw error; }
  event("CASE_END", { name, status: "PASS" }); process.stdout.write(JSON.stringify({ progress: name, status: "PASS" }) + "\n");
}

try {
  const connected = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => connect(`client-${i + 1}`)));
  assert.ok(connected.every(result => result.status === "fulfilled"));
  // Sequential fixtures avoid making connection readiness itself an overload trial.
  for (let i = 0; i < 20; i++) await complete(states[i], workload(i, 0), "readiness");
  event("ALL_READY", { clients: 20 });
  if (values.suite === "idempotency") {
    const a = states[0], input = workload(0, 21);
    let original, originalTerminalAt;
    await test("in_flight_dedupe_and_conflict", async () => {
      await control("hold_lock");
      try {
        original = register(a, input, randomUUID(), "inflight"); send(a, original);
        const before = await control("wait_blocked_one"); assert.ok(before.blocked.length >= 1);
        const reorderedSend = send(a, original, { reordered: true, role: "duplicate-reordered" });
        const uppercaseSend = send(a, original, { uppercase: true, role: "duplicate-uppercase" });
        send(a, original, { input: workload(0, 22), role: "conflict-inflight" });
        await until(() => errors(original.frames).length === 1, "inflight conflict", 2000);
        const after = await control("wait_blocked_one"); assert.ok(after.blocked.length >= 1);
        assert.equal(successful(original.frames).length, 0);
        assert.equal(errors(original.frames)[0].body.error.code, "INVALID_INPUT");
        await control("release_lock");
        await until(() => successful(original.frames).length === 1, "original completion"); await quiet();
        assertCycle(original.frames.filter(frame => frame.destination !== "errors"));
        assert.equal(terminal(original.frames).length, 2);
        originalTerminalAt = successful(original.frames)[0].monoMs;
        assert.ok(reorderedSend.monoMs < originalTerminalAt && uppercaseSend.monoMs < originalTerminalAt);
        return { lockBefore: before, lockAfterDuplicate: after, duplicateSendSequences: [reorderedSend.sequence, uppercaseSend.sequence],
          originalTerminalAt, progress: 4, successTerminals: 1, conflicts: 1 };
      } finally { await control("release_lock"); }
    });
    await test("terminal_replay_and_conflict_preserves_original", async () => {
      let offset = original.frames.length;
      send(a, original, { reordered: true, role: "terminal-replay" });
      await until(() => trace(original, offset).length >= 1, "replay"); await quiet();
      const replay = trace(original, offset); assert.equal(replay.length, 1); assert.equal(replay[0].destination, "results");
      assert.deepEqual(replay[0].body, successful(original.frames)[0].body);
      offset = original.frames.length;
      send(a, original, { input: workload(0, 23), role: "conflict-after-terminal" });
      await until(() => trace(original, offset).length >= 1, "completed conflict"); await quiet();
      assertCycle(trace(original, offset), "INVALID_INPUT");
      offset = original.frames.length; send(a, original, { role: "replay-after-conflict" });
      await until(() => trace(original, offset).length >= 1, "original retained"); await quiet();
      assert.equal(trace(original, offset).length, 1);
      assert.deepEqual(trace(original, offset)[0].body, successful(original.frames)[0].body);
      return { requestId: original.requestId, replayProgress: 0, successfulReplays: 2, conflict: "INVALID_INPUT" };
    });
    await test("twenty_sessions_same_id_independent_inputs", async () => {
      const id = randomUUID();
      const group = states.map((state, i) => register(state, workload(i, 13), id, "same-id-independent"));
      group.forEach((record, i) => send(states[i], record));
      await until(() => group.every(record => terminal(record.frames).length === 1), "20 independent sessions"); await quiet();
      group.forEach(record => assertCycle(record.frames));
      assert.equal(new Set(group.map(record => record.input.pattern)).size, 20);
      return { clients: 20, requestId: id, distinctInputs: 20, independentProgressChains: 20, correctResults: 20 };
    });
    await test("reconnect_starts_new_work", async () => {
      const old = await complete(states[1], workload(1, 27), "before-reconnect");
      await disconnect(states[1]); const next = await connect("client-2-reconnected");
      const fresh = await complete(next, old.input, "after-reconnect", old.requestId); await quiet();
      assertCycle(old.frames); assertCycle(fresh.frames);
      return { requestId: old.requestId, previousClient: old.clientId, newClient: fresh.clientId, newProgress: 4, newHttpStatus: next.httpStatus };
    });
    await test("expired_default_60s_ttl_recomputes", async () => {
      const waitUntil = originalTerminalAt + 61500;
      event("TTL_WAIT", { requestId: original.requestId, ttlSeconds: 60, extraMarginMs: 1500, waitUntil });
      process.stdout.write(JSON.stringify({ progress: "Waiting for original 60-second TTL", remainingMs: Math.max(0, waitUntil - clock()) }) + "\n");
      while (clock() < waitUntil) { await pause(Math.min(1000, Math.ceil(waitUntil - clock()))); assert.equal(fatal.length, 0); }
      const offset = original.frames.length;
      const resend = send(a, original, { role: "after-default-ttl" });
      await until(() => terminal(trace(original, offset)).length === 1, "TTL recomputation"); await quiet();
      assertCycle(trace(original, offset));
      return { ttlSeconds: 60, elapsedSinceOriginalTerminalMs: resend.monoMs - originalTerminalAt, newProgress: 4, successTerminals: 1 };
    });
  } else {
    async function burst(controlled) {
      if (controlled) await control("hold_lock");
      try {
        const group = states.flatMap((state, i) => Array.from({ length: 8 }, (_, n) => register(state, workload(i, n + 100), randomUUID(), controlled ? "controlled-burst" : "natural-burst")));
        group.forEach((record, index) => send(states[Math.floor(index / 8)], record));
        let blocked = null;
        if (controlled) {
          blocked = await control("wait_blocked_two"); assert.equal(blocked.blocked.length, 2);
          await until(() => group.filter(record => errors(record.frames).length).length === 154, "154 dispatcher rejections", 2000);
          assert.equal(group.filter(record => successful(record.frames).length).length, 0);
          blocked = await control("wait_blocked_two");
          await control("release_lock");
        }
        await until(() => group.every(record => terminal(record.frames).length === 1), "burst drain"); await quiet();
        const busy = group.filter(record => errors(record.frames).length), done = group.filter(record => successful(record.frames).length);
        done.forEach(record => assertCycle(record.frames)); busy.forEach(record => assertCycle(record.frames, "SERVER_BUSY"));
        assert.equal(done.length + busy.length, 160);
        if (controlled) { assert.equal(done.length, 6); assert.equal(busy.length, 154); }
        // An explicit test resend after recovery, not automatic retry hidden in a benchmark sample.
        let retry = null;
        if (busy.length) {
          const record = busy[0], state = states.find(item => item.id === record.clientId), offset = record.frames.length;
          send(state, record, { role: "explicit-retry-rejected-id" });
          await until(() => terminal(trace(record, offset)).length === 1, "busy ID not cached"); await quiet();
          assertCycle(trace(record, offset)); retry = { requestId: record.requestId, progress: 4, completed: true };
        }
        const recovery = await complete(states[0], workload(0, 300), "fresh-after-burst");
        return { sent: 160, completed: done.length, serverBusy: busy.length, blocked,
          workers: 2, queueCapacity: 4, maxPerClient: 8, maxActive: 160, otherLimits: { perSession: 16, active: 1000, registry: 10000 },
          sameIdRecovery: retry, freshIdRecovery: recovery.requestId, queueSaturationObserved: busy.length > 0,
          controlledDatabaseContention: controlled };
      } finally { if (controlled) await control("release_lock"); }
    }
    await test("natural_burst_20x8_and_recovery", () => burst(false));
    await test("observed_full_2worker_4queue_and_non_cached_rejection", () => burst(true));
  }
  await quiet(400);
  assert.equal(fatal.length, 0);
} catch (error) { failed = error.message; event("SUITE_FAILURE", { reason: failed }); }
finally {
  await Promise.allSettled(states.map(state => disconnect(state)));
  inputLines.close();
  const summary = { task: "X01.5", suite: values.suite, passed: !failed && !fatal.length,
    database: target.database, endpoint: target.webSocketUrl, origin: target.origin,
    reliabilityOnly: true, automaticReconnect: false, automaticRetry: false, cookies: false,
    cases, failure: failed, fatalCount: fatal.length, connections: states.map(state => ({ clientId: state.id, httpStatus: state.httpStatus, disconnected: !state.connected })),
    counts: { sends: events.filter(row => row.kind === "SEND").length, progress: events.filter(row => row.kind === "RECEIVE" && row.destination === "progress").length,
      successes: events.filter(row => row.kind === "RECEIVE" && row.body?.status === "COMPLETED").length,
      errors: events.filter(row => row.kind === "RECEIVE" && row.body?.status === "FAILED").reduce((map, row) => ({ ...map, [row.body.error.code]: (map[row.body.error.code] ?? 0) + 1 }), {}) } };
  fs.writeFileSync(path.join(values.output, "events.jsonl"), events.map(row => JSON.stringify(row)).join("\n") + "\n");
  fs.writeFileSync(path.join(values.output, "records.json"), JSON.stringify(records.map(({ frames, sends, ...record }) => record), null, 2) + "\n");
  fs.writeFileSync(path.join(values.output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ summary: { suite: values.suite, passed: summary.passed, counts: summary.counts, failure: failed } }) + "\n");
  if (!summary.passed) process.exitCode = 1;
}
