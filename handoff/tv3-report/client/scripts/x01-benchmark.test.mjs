import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { loadUiModule } from "./lib/load-ui-module.mjs";
import { workload, nextSendSlot, publishBeforeDeadline, validateProgress, validateLines, summarize, median, percentile, csv, validateOptions } from "./lib/x01-benchmark.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("../../docs/examples/mai-hoa-lines.response.json", import.meta.url), "utf8"));
const { isCalculationResponse } = await loadUiModule("types/contractValidation.ts");
const target = { database: "huyenco_benchmark_test_20261029_010531", schemaVersion: 12, flywayEnabled: false,
  webSocketUrl: "ws://127.0.0.1:18091/ws", backendHttpUrl: "http://127.0.0.1:18091", origin: "http://127.0.0.1:3173" };
const options = { clients: 20, mode: "bounded", kind: "benchmark", repeat: 1,
  warmupMs: 10_000, durationMs: 60_000, thinkMs: 200, drainMs: 15_000, timeoutMs: 15_000 };
const row = changes => ({ phase: "measurement", sent: true, correct: true, category: "completed",
  errorCode: "", latencyMs: 10, terminalAfterWindow: false, ...changes });

test("source fixture and LINES oracle agree; stale input and corrupt hexagrams fail", () => {
  validateLines(fixture, { pattern: 21, movingLine: 2 }, isCalculationResponse);
  assert.throws(() => validateLines(fixture, { pattern: 63, movingLine: 2 }, isCalculationResponse));
  const corrupted = structuredClone(fixture);
  corrupted.data.changedHexagram.linesBottomUp[0] = !corrupted.data.changedHexagram.linesBottomUp[0];
  assert.throws(() => validateLines(corrupted, { pattern: 21, movingLine: 2 }, isCalculationResponse));
  const unapproved = structuredClone(fixture);
  unapproved.data.sourceStatus = "SOURCE_AMBIGUOUS";
  assert.throws(() => validateLines(unapproved, { pattern: 21, movingLine: 2 }, isCalculationResponse));
});

test("deterministic workload uses six bottom-up booleans and varies input across Clients", () => {
  assert.deepEqual(workload(0, 0).payload.linesBottomUp, [false, false, false, false, false, false]);
  assert.deepEqual(workload(1, 0).payload.linesBottomUp, [true, false, false, false, true, false]);
  assert.equal(workload(1, 0).movingLine, 2);
  assert.deepEqual(workload(1, 0), workload(1, 0));
});

test("progress permits error prefixes but rejects gaps, wrong steps and incomplete success", () => {
  const progress = ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"].map((step, index) => ({
    type: "MAI_HOA", sequence: index + 1, step, message: "progress" }));
  validateProgress(progress, true); validateProgress([]); validateProgress(progress.slice(0, 2));
  assert.throws(() => validateProgress(progress.slice(0, 2), true));
  assert.throws(() => validateProgress([progress[0], progress[2]]));
  assert.throws(() => validateProgress([{ ...progress[0], type: "TAM_THE" }]));
});

test("end-of-window truncation cannot shorten the 200 ms pause to send another request", () => {
  assert.deepEqual(nextSendSlot(900, 1000, 200), { sendAgain: false, waitUntil: 1000 });
  assert.deepEqual(nextSendSlot(800, 1000, 200), { sendAgain: false, waitUntil: 1000 });
  assert.deepEqual(nextSendSlot(700, 1000, 200), { sendAgain: true, waitUntil: 900 });
  assert.equal(nextSendSlot(1001, 1000, 200).sendAgain, false);
});

test("publish-time gate rejects a request whose serialization crossed the window boundary", () => {
  const frame = { body: "already serialized" };
  let calls = 0;
  const publish = () => { calls++; };
  // The loop could have checked time=99 before body/row construction; final clock is now late.
  assert.deepEqual(publishBeforeDeadline(publish, frame, 100, () => 100.022), { published: false, at: 100.022 });
  assert.equal(calls, 0);
  assert.equal(publishBeforeDeadline(publish, frame, 100, () => 100).published, false);
});

test("accepted SEND timestamp is captured at the final gate immediately before publish", () => {
  let captured;
  const frame = { body: "request" };
  const outcome = publishBeforeDeadline((body, at) => { captured = { body, at }; }, frame, 100, () => 99.9);
  assert.equal(outcome.published, true);
  assert.deepEqual(captured, { body: frame, at: 99.9 });
});

test("busy/error/timeout latencies cannot improve success percentiles or throughput", () => {
  const summary = summarize([row({}), row({ latencyMs: 20, terminalAfterWindow: true }),
    row({ category: "server_failed", errorCode: "SERVER_BUSY", latencyMs: 0.01 }),
    row({ category: "client_failed", errorCode: "CLIENT_TIMEOUT", latencyMs: 15000 })], 1000);
  assert.equal(summary.sent, 4); assert.equal(summary.completed, 2);
  assert.equal(summary.throughputPerSecond, 1); assert.equal(summary.completedAfterWindow, 1);
  assert.equal(summary.cohortSuccessRate, 0.5); assert.equal(summary.medianLatencyMs, 15);
  assert.equal(summary.p95LatencyMs, 20);
  assert.deepEqual(summary.errors, { SERVER_BUSY: 1, CLIENT_TIMEOUT: 1 });
  assert.equal(summary.reconciled, true);
});

test("readiness/warm-up and failed publishes are excluded from the sent measurement cohort", () => {
  const summary = summarize([row({ phase: "readiness" }), row({ phase: "warmup" }), row({}),
    row({ sent: false, category: "publish_failed", errorCode: "SEND_FAILED" })], 1000);
  assert.equal(summary.sent, 1); assert.equal(summary.completed, 1); assert.equal(summary.publishFailures, 1);
});

test("invalid completed payloads are reconciled as failures rather than successes", () => {
  const summary = summarize([row({ category: "invalid_response", correct: false, errorCode: "INVALID_RESPONSE" })], 1000);
  assert.equal(summary.completed, 0); assert.equal(summary.sampleCount, 0); assert.equal(summary.p95LatencyMs, null);
  assert.deepEqual(summary.errors, { INVALID_RESPONSE: 1 }); assert.equal(summary.reconciled, true);
});

test("nearest-rank p95 and ordinary median use recorded samples", () => {
  assert.equal(median([4, 2, 3, 1]), 2.5);
  assert.equal(percentile(Array.from({ length: 20 }, (_, index) => index + 1)), 19);
  assert.equal(median([]), null); assert.equal(percentile([]), null);
});

test("only planned load/protocol/TEST configuration is accepted", () => {
  validateOptions(options, target);
  for (const changes of [{ clients: 1 }, { clients: 2.5 }, { mode: "other" }, { durationMs: 5000 },
    { thinkMs: 0 }, { warmupMs: -1 }, { timeoutMs: 1000 }, { repeat: 4 }]) {
    assert.throws(() => validateOptions({ ...options, ...changes }, target));
  }
  assert.throws(() => validateOptions(options, { ...target, database: "huyenco" }));
  assert.throws(() => validateOptions(options, { ...target, webSocketUrl: "ws://127.0.0.1:18090/ws" }));
  assert.throws(() => validateOptions(options, { ...target, flywayEnabled: true }));
});

test("CSV preserves quoted/comma/newline fields", () => {
  assert.equal(csv([{ a: 'one,"two"', b: "x\ny" }], ["a", "b"]), 'a,b\n"one,""two""","x\ny"\n');
});
