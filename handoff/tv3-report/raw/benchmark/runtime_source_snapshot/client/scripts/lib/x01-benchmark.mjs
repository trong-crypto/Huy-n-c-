import assert from "node:assert/strict";

export const STEPS = ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"];
const TRIGRAM = ["KHON", "CHAN", "KHAM", "DOAI", "CAN2", "LY", "TON", "CAN"];
export const CSV_COLUMNS = ["runId", "mode", "clients", "repeat", "clientId", "requestId", "inputCase", "phase",
  "sendMonoMs", "terminalMonoMs", "latencyMs", "status", "errorCode", "progressCount", "correct",
  "terminalAfterWindow", "sent", "category", "validationMs"];

export function workload(clientIndex, sequence) {
  const pattern = (17 * clientIndex + sequence) % 64;
  const movingLine = 1 + ((clientIndex + sequence) % 6);
  return { pattern, movingLine, payload: { method: "LINES", movingLine,
    linesBottomUp: Array.from({ length: 6 }, (_, bit) => Boolean(pattern & (1 << bit))) } };
}

export function nextSendSlot(completedAt, windowEnd, thinkMs) {
  const earliest = completedAt + thinkMs;
  return { sendAgain: earliest < windowEnd, waitUntil: Math.min(earliest, windowEnd) };
}

export function validateProgress(progress, terminal = false) {
  assert.ok(progress.length <= STEPS.length, "Too many progress events");
  progress.forEach((event, index) => {
    assert.equal(event.sequence, index + 1, "Progress sequence differs");
    assert.equal(event.step, STEPS[index], "Progress step differs");
    assert.equal(event.type, "MAI_HOA");
    assert.equal(typeof event.message, "string");
  });
  if (terminal) assert.equal(progress.length, 4, "A success must have all four progress steps");
}

export function validateLines(response, input, isResponse) {
  assert.ok(isResponse(response), "Contract validation failed");
  assert.equal(response.type, "MAI_HOA");
  assert.equal(response.status, "COMPLETED");
  assert.equal(response.error, null);
  const data = response.data;
  assert.equal(data.method, "LINES");
  assert.equal(data.ruleBasis, "SOURCE_VERIFIED");
  assert.equal(data.sourceStatus, "VERIFIED");
  assert.equal(data.ruleVersion, "1.0");
  assert.equal(data.movingLine, input.movingLine);
  assert.equal(data.lunarDate, null);
  assert.equal(Object.hasOwn(data, "detailedReading"), false);
  assert.deepEqual(data.rules.map(rule => rule.ruleCode), ["MH-MUTUAL", "MH-CHANGE"]);
  assert.ok(data.rules.every(rule => rule.executionPolicy === "SOURCE_VERIFIED" && rule.sourceStatus === "VERIFIED"));
  assert.deepEqual(data.decisionReferences, []);
  assert.deepEqual(data.sourceReferences.map(source => source.pdfPage), [42, 41]);
  assert.ok(data.sourceReferences.every(source => source.sourceId === "MH"
    && source.sha256 === "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de"));
  const expected = [input.pattern, ((input.pattern >> 1) & 7) | (((input.pattern >> 2) & 7) << 3),
    input.pattern ^ (1 << (input.movingLine - 1))];
  [data.primaryHexagram, data.mutualHexagram, data.changedHexagram].forEach((hexagram, index) => {
    assert.deepEqual(hexagram.linesBottomUp, Array.from({ length: 6 }, (_, bit) => Boolean(expected[index] & (1 << bit))));
    assert.equal(hexagram.code, `H_${TRIGRAM[expected[index] >> 3]}_${TRIGRAM[expected[index] & 7]}`);
    assert.equal(hexagram.nameStatus, "VERIFIED");
  });
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentile(values, fraction = 0.95) {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.ceil(fraction * values.length) - 1];
}

export function summarize(rows, durationMs) {
  const cohort = rows.filter(row => row.phase === "measurement" && row.sent);
  const completed = cohort.filter(row => row.category === "completed" && row.correct);
  const errors = {};
  for (const row of cohort.filter(row => row.category !== "completed" || !row.correct)) {
    const key = row.errorCode || row.category;
    errors[key] = (errors[key] ?? 0) + 1;
  }
  const categories = {};
  for (const row of cohort) categories[row.category] = (categories[row.category] ?? 0) + 1;
  return { sent: cohort.length, completed: completed.length,
    completedInsideWindow: completed.filter(row => !row.terminalAfterWindow).length,
    completedAfterWindow: completed.filter(row => row.terminalAfterWindow).length,
    sentRatePerSecond: cohort.length / (durationMs / 1000),
    throughputPerSecond: completed.filter(row => !row.terminalAfterWindow).length / (durationMs / 1000),
    cohortSuccessRate: cohort.length ? completed.length / cohort.length : null,
    sampleCount: completed.length, medianLatencyMs: median(completed.map(row => row.latencyMs)),
    p95LatencyMs: percentile(completed.map(row => row.latencyMs)), errors, categories,
    reconciled: Object.values(categories).reduce((a, b) => a + b, 0) === cohort.length,
    publishFailures: rows.filter(row => row.phase === "measurement" && !row.sent).length };
}

export function csv(rows, columns = CSV_COLUMNS) {
  const escape = value => {
    const text = value == null ? "" : String(value);
    return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.join(","), ...rows.map(row => columns.map(key => escape(row[key])).join(","))].join("\n") + "\n";
}

export function validateOptions(options, target) {
  assert.ok([2, 5, 20].includes(options.clients), "Clients must be 2, 5 or 20");
  assert.ok(["direct", "bounded"].includes(options.mode), "Invalid mode");
  assert.ok(["preflight", "pilot", "benchmark"].includes(options.kind), "Invalid kind");
  assert.ok([1, 2, 3].includes(options.repeat), "Invalid repeat");
  assert.ok(Number.isFinite(options.warmupMs) && options.warmupMs >= 0 && options.warmupMs <= 60_000);
  assert.ok(Number.isFinite(options.durationMs) && options.durationMs >= 100 && options.durationMs <= 300_000);
  assert.equal(options.thinkMs, 200, "The primary X01 workload requires a 200 ms think time");
  assert.equal(options.drainMs, 15_000);
  assert.equal(options.timeoutMs, 15_000);
  if (options.kind === "benchmark") {
    assert.equal(options.warmupMs, 10_000);
    assert.equal(options.durationMs, 60_000);
  }
  assert.match(target.database, /^huyenco_benchmark_test_\d{8}_\d{6}$/);
  assert.equal(target.schemaVersion, 12);
  assert.equal(target.flywayEnabled, false);
  assert.equal(target.webSocketUrl, "ws://127.0.0.1:18091/ws");
  assert.equal(target.backendHttpUrl, "http://127.0.0.1:18091");
  assert.equal(target.origin, "http://127.0.0.1:3173");
}
