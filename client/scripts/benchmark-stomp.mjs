// X01: independent anonymous STOMP connections, no UI, cookies or automatic retry.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { setTimeout as pause } from "node:timers/promises";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";
import { loadUiModule } from "./lib/load-ui-module.mjs";
import { workload, nextSendSlot, publishBeforeDeadline, validateProgress, validateLines, summarize, csv, validateOptions } from "./lib/x01-benchmark.mjs";

const ROOT = new URL("../../", import.meta.url);
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

export async function runBenchmark(options, target) {
  validateOptions(options, target);
  fs.mkdirSync(options.output, { recursive: false }); // Refuse to overwrite earlier evidence.
  const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
  const rows = [], events = [], states = [], records = new Map(), resources = [];
  const abort = new AbortController();
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  const startedAt = new Date().toISOString();
  let closing = false, measurement = null, connectedPeak = 0, deadlineSkipped = 0;
  const clock = () => performance.now();
  async function waitUntil(deadline) {
    while (clock() < deadline && !abort.signal.aborted) {
      await pause(Math.max(1, Math.ceil(deadline - clock())), undefined, { signal: abort.signal }).catch(() => {});
    }
  }
  function event(code, details = {}) { events.push({ monoMs: clock(), code, ...details }); }
  function finish(state, row, category, errorCode, at = clock()) {
    if (row.done) return;
    row.done = true; row.category = category; row.errorCode = errorCode;
    row.terminalMonoMs = at; row.latencyMs = at - row.sendMonoMs;
    row.progressCount = row.progress.length;
    row.terminalAfterWindow = row.phase === "measurement" && at >= measurement.end;
    clearTimeout(row.timer);
    if (state.pending === row) state.pending = null;
    row.resolve();
  }
  function fatal(code, details = {}) {
    event(code, details);
    abort.abort();
    for (const state of states) if (state.pending) {
      state.pending.status = "CLIENT_FAILED";
      finish(state, state.pending, "client_failed", "RUN_ABORTED");
    }
  }
  function receive(state, destination, frame) {
    const at = clock();
    let body;
    try { body = JSON.parse(frame.body); }
    catch { fatal("MALFORMED_JSON", { clientId: state.id, destination }); return; }
    const row = records.get(body?.requestId);
    if (!row) { fatal("UNKNOWN_REQUEST", { clientId: state.id, requestId: body?.requestId ?? null }); return; }
    if (row.clientId !== state.id) {
      fatal("WRONG_SESSION", { clientId: state.id, expectedClient: row.clientId, requestId: row.requestId }); return;
    }
    if (row.done) {
      fatal(destination === "progress" ? "LATE_PROGRESS" : "DUPLICATE_OR_LATE_TERMINAL",
        { clientId: state.id, requestId: row.requestId }); return;
    }
    try {
      if (body.type !== "MAI_HOA") throw new Error("Type differs");
      if (destination === "progress") {
        row.progress.push(body); validateProgress(row.progress); return;
      }
      const validationStart = clock();
      if (!isCalculationResponse(body)) throw new Error("Contract differs");
      row.status = body.status;
      if (body.status === "COMPLETED") {
        if (destination !== "results") throw new Error("Success delivered to error queue");
        validateLines(body, row.input, isCalculationResponse);
        validateProgress(row.progress, true);
        row.correct = true; row.validationMs = clock() - validationStart;
        finish(state, row, "completed", "", at);
      } else {
        if (destination !== "errors") throw new Error("Failure delivered to result queue");
        validateProgress(row.progress);
        row.correct = true; row.validationMs = clock() - validationStart;
        finish(state, row, "server_failed", body.error.code, at);
      }
    } catch (error) {
      row.status = "INVALID_RESPONSE";
      finish(state, row, "invalid_response", "INVALID_RESPONSE", at);
      fatal("INVALID_RESPONSE", { clientId: state.id, requestId: row.requestId, reason: error.message.slice(0, 300) });
    }
  }
  async function connect(index) {
    const state = { id: `client-${index + 1}`, index, pending: null, connected: false, connectionCount: 0 };
    states.push(state);
    const start = clock();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { fatal("CONNECT_TIMEOUT", { clientId: state.id }); reject(new Error("STOMP connect timeout")); }, 10_000);
      state.client = new Client({
        webSocketFactory: () => {
          const socket = new WebSocket(target.webSocketUrl, { origin: target.origin, followRedirects: false });
          socket.on("upgrade", response => { state.httpStatus = response.statusCode; state.upgradeMs = clock() - start; });
          return socket;
        },
        reconnectDelay: 0, connectionTimeout: 10_000, heartbeatIncoming: 0, heartbeatOutgoing: 0,
        onConnect: () => {
          clearTimeout(timer);
          state.connected = true; state.connectionCount++;
          state.stompConnectedMs = clock() - start;
          connectedPeak = Math.max(connectedPeak, states.filter(item => item.connected).length);
          for (const destination of ["progress", "results", "errors"]) {
            state.client.subscribe(`/user/queue/${destination}`, frame => receive(state, destination, frame));
          }
          resolve(state);
        },
        onStompError: () => { clearTimeout(timer); fatal("STOMP_ERROR", { clientId: state.id }); reject(new Error("STOMP rejected")); },
        onWebSocketError: () => { clearTimeout(timer); fatal("WEBSOCKET_ERROR", { clientId: state.id }); reject(new Error("WebSocket failed")); },
        onWebSocketClose: () => {
          state.connected = false;
          if (!closing) { clearTimeout(timer); fatal("CONNECTION_LOST", { clientId: state.id }); reject(new Error("Connection closed")); }
        },
      });
      state.client.activate();
    });
  }
  function send(state, input, phase, deadline = Infinity) {
    if (state.pending) throw new Error("One in-flight request per connection is required");
    const requestId = randomUUID();
    const body = JSON.stringify({ requestId, type: "MAI_HOA", payload: input.payload });
    const row = { runId: options.runId, mode: options.mode, clients: options.clients, repeat: options.repeat,
      clientId: state.id, requestId, inputCase: `${input.pattern}:${input.movingLine}`, phase,
      sendMonoMs: clock(), terminalMonoMs: null, latencyMs: null, status: "PENDING", errorCode: "",
      progressCount: 0, correct: false, terminalAfterWindow: false, sent: false, category: "pending", validationMs: 0,
      input, progress: [], done: false };
    const promise = new Promise(resolve => { row.resolve = resolve; });
    records.set(requestId, row); rows.push(row); state.pending = row;
    row.timer = setTimeout(() => {
      row.status = "CLIENT_TIMEOUT"; finish(state, row, "client_failed", "CLIENT_TIMEOUT");
      event("CLIENT_TIMEOUT", { clientId: state.id, requestId });
    }, options.timeoutMs);
    try {
      const outcome = publishBeforeDeadline((frame, at) => {
        row.sendMonoMs = at;
        state.client.publish(frame);
      }, { destination: "/app/mai-hoa/calculate", headers: { "content-type": "application/json" }, body }, deadline, clock);
      if (!outcome.published) {
        deadlineSkipped++;
        clearTimeout(row.timer); records.delete(requestId); rows.splice(rows.indexOf(row), 1);
        state.pending = null; row.done = true; row.resolve();
        return Promise.resolve(null);
      }
      row.sent = true;
    } catch {
      row.status = "SEND_FAILED"; finish(state, row, "publish_failed", "SEND_FAILED");
      fatal("SEND_FAILED", { clientId: state.id, requestId });
    }
    return promise.then(() => row);
  }
  async function phase(name, durationMs) {
    const start = clock();
    const window = { start, end: start + durationMs };
    if (name === "measurement") measurement = window;
    const drainTimer = setTimeout(() => {
      for (const state of states) if (state.pending?.phase === name) {
        state.pending.status = "CLIENT_TIMEOUT";
        event("DRAIN_TIMEOUT", { clientId: state.id, requestId: state.pending.requestId });
        finish(state, state.pending, "client_failed", "CLIENT_TIMEOUT");
      }
    }, durationMs + options.drainMs);
    try {
      await Promise.all(states.map(async state => {
        let sequence = 0;
        while (clock() < window.end && !abort.signal.aborted) {
          if (state.nextAllowedAt != null) {
            await waitUntil(Math.min(state.nextAllowedAt, window.end));
            if (clock() >= window.end || abort.signal.aborted) break;
          }
          const sent = await send(state, workload(state.index, sequence++), name, window.end);
          if (sent === null) break;
          // Truncating the final think time must never create another early SEND.
          const completedAt = clock();
          state.nextAllowedAt = completedAt + options.thinkMs; // Carry cooldown across warm-up/measurement.
          const slot = nextSendSlot(completedAt, window.end, options.thinkMs);
          await waitUntil(slot.waitUntil);
          if (!slot.sendAgain) break;
        }
      }));
    } finally { clearTimeout(drainTimer); }
    return { ...window, drainedAt: clock() };
  }
  const sample = () => {
    const usage = process.cpuUsage(), memory = process.memoryUsage();
    resources.push({ monoMs: clock(), cpuUserMs: usage.user / 1000, cpuSystemMs: usage.system / 1000,
      rssBytes: memory.rss, heapUsedBytes: memory.heapUsed });
  };
  let resourceTimer, windows = {}, failure = null;
  try {
    loopDelay.enable(); sample(); resourceTimer = setInterval(sample, 1000);
    const connections = await Promise.allSettled(Array.from({ length: options.clients }, (_, index) => connect(index)));
    if (connections.some(result => result.status === "rejected")) throw new Error("Not all Clients connected");
    // Ordered SUBSCRIBE then SEND; each connection must prove all queues before any timed phase.
    const ready = await Promise.all(states.map(state => send(state,
      { pattern: 21, movingLine: 2, payload: { method: "LINES", linesBottomUp: [true, false, true, false, true, false], movingLine: 2 } }, "readiness")));
    if (ready.some(row => row.category !== "completed" || !row.correct)) throw new Error("Readiness fixture failed");
    if (options.warmupMs) windows.warmup = await phase("warmup", options.warmupMs);
    if (abort.signal.aborted) throw new Error("Protocol validation failed before measurement");
    windows.measurement = await phase("measurement", options.durationMs);
  } catch (error) { failure = error.message; event("RUN_FAILED", { reason: failure }); }
  finally {
    clearInterval(resourceTimer); sample(); loopDelay.disable();
    closing = true;
    for (const state of states) if (state.pending) {
      state.pending.status = "CLIENT_FAILED"; finish(state, state.pending, "client_failed", "RUN_ENDED");
    }
    await Promise.allSettled(states.map(state => state.client.deactivate({ force: true })));
  }
  const metrics = summarize(rows, options.durationMs);
  const connections = states.map(state => ({ clientId: state.id, httpStatus: state.httpStatus ?? null,
    upgradeMs: state.upgradeMs ?? null, stompConnectedMs: state.stompConnectedMs ?? null, connectionCount: state.connectionCount }));
  const passed = !failure && !events.length && metrics.sent > 0 && metrics.completed === metrics.sent
    && rows.every(row => row.category === "completed" && row.correct)
    && connections.length === options.clients && connectedPeak === options.clients
    && connections.every(state => state.connectionCount === 1 && state.httpStatus === 101);
  const report = { schemaVersion: 1, task: "X01.2", kind: options.kind, passed, startedAt, endedAt: new Date().toISOString(),
    runId: options.runId, mode: options.mode, clients: options.clients, repeat: options.repeat,
    database: target.database, endpoint: target.webSocketUrl, origin: target.origin,
    config: { warmupMs: options.warmupMs, durationMs: options.durationMs, thinkMs: options.thinkMs,
      drainMs: options.drainMs, requestTimeoutMs: options.timeoutMs, maxInFlightPerClient: 1,
      automaticReconnect: false, automaticRetry: false, cookies: false },
    connectionCount: connections.length, connectedPeak, connections, windows, metrics, eventCount: events.length,
    scheduledAttemptsSkippedAtBoundary: deadlineSkipped,
    allPhases: { requests: rows.length, completed: rows.filter(row => row.category === "completed").length,
      progress: rows.reduce((sum, row) => sum + row.progress.length, 0) },
    eventLoopDelayMs: { mean: Number.isFinite(loopDelay.mean) ? loopDelay.mean / 1e6 : null, p95: loopDelay.percentile(95) / 1e6 },
    failure, sentDefinition: "STOMP publish returned without throwing; not a delivery acknowledgement",
    throughputDefinition: "valid cohort completions received inside the measurement window / duration",
    benchmarkResult: options.kind === "benchmark", observationEndedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(options.output, "raw.csv"), csv(rows));
  fs.writeFileSync(path.join(options.output, "events.jsonl"), events.map(value => JSON.stringify(value)).join("\n") + (events.length ? "\n" : ""));
  fs.writeFileSync(path.join(options.output, "runner-resources.csv"), csv(resources,
    ["monoMs", "cpuUserMs", "cpuSystemMs", "rssBytes", "heapUsedBytes"]));
  fs.writeFileSync(path.join(options.output, "summary.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

async function main() {
  const { values } = parseArgs({ options: { clients: { type: "string" }, mode: { type: "string" },
    kind: { type: "string", default: "pilot" }, repeat: { type: "string", default: "1" },
    "warmup-seconds": { type: "string", default: "10" }, "duration-seconds": { type: "string", default: "60" },
    output: { type: "string" }, target: { type: "string" }, help: { type: "boolean", default: false } } });
  if (values.help) {
    console.log("node scripts/benchmark-stomp.mjs --clients 2|5|20 --mode direct|bounded --kind preflight|pilot|benchmark --output NEW_DIRECTORY [--warmup-seconds 10 --duration-seconds 60 --repeat 1 --target TARGET_JSON]");
    return;
  }
  if (!values.output) throw new Error("--output is required; evidence must not be overwritten");
  const numeric = key => {
    if (!/^\d+(?:\.\d+)?$/.test(values[key] ?? "")) throw new Error(`Invalid numeric option: ${key}`);
    return Number(values[key]);
  };
  const options = { clients: numeric("clients"), mode: values.mode, kind: values.kind, repeat: numeric("repeat"),
    warmupMs: numeric("warmup-seconds") * 1000, durationMs: numeric("duration-seconds") * 1000,
    thinkMs: 200, drainMs: 15_000, timeoutMs: 15_000, output: path.resolve(values.output), runId: randomUUID() };
  const target = readJson(values.target ?? new URL("scripts/generated/x01_benchmark_target.json", ROOT));
  const report = await runBenchmark(options, target);
  console.log(JSON.stringify({ kind: report.kind, clients: report.clients, mode: report.mode, passed: report.passed,
    connectedPeak: report.connectedPeak, sent: report.metrics.sent, completed: report.metrics.completed,
    eventCount: report.eventCount, output: options.output }));
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
