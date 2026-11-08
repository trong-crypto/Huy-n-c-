import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const database = process.env.PGDATABASE;
const adminIdentifier = process.env.PHASE4_ADMIN_IDENTIFIER;
const adminPassword = process.env.PHASE4_ADMIN_PASSWORD;
const base = new URL(process.env.PHASE4_BACKEND_URL ?? "http://127.0.0.1:18117");
const origin = process.env.PHASE4_ORIGIN ?? base.origin;
const psql = process.env.PHASE4_PSQL ?? "psql";
const methodCode = process.env.PHASE4_METHOD_CODE ?? "LINES";
assert.match(database ?? "", /^huyenco_phase4_test(?:_[a-z0-9]+)*$/);
assert.match(adminIdentifier ?? "", /^[a-z0-9._+%@-]{3,254}$/);
assert.ok(adminPassword, "Set PHASE4_ADMIN_PASSWORD for the TEST account");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname) && base.protocol === "http:"
  && base.href === base.origin + "/", "Use a local HTTP Backend URL");
assert.ok(["LINES", "OBJECT_COUNT", "TIME", "TAM_THE"].includes(methodCode), "Use a supported CMS method code");

const tag = "phase4-" + randomUUID().slice(0, 12);
const fixturePassword = randomUUID() + "a";
let requests = 0;
let assertionsDenied = 0;
function sql(statement) {
  return execFileSync(psql, ["-XAtqw", "-v", "ON_ERROR_STOP=1", "-d", database, "-c", statement],
    { encoding: "utf8", env: { ...process.env, PGHOST: process.env.PGHOST ?? "127.0.0.1" } }).trim();
}
async function api(path, expected, { method = "GET", body, session, csrf = session?.data?.csrfToken,
  site = origin, marker = "1", error } = {}) {
  const headers = { Origin: site };
  if (marker) headers["X-HuyenCo-Request"] = marker;
  if (session?.cookie) headers.Cookie = session.cookie;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(base.origin + "/api/v1" + path, { method, headers,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  requests++;
  const json = res.status === 204 ? null : await res.json();
  assert.equal(res.status, expected, method + " " + path + " " + (json?.error?.code ?? ""));
  if (error) assert.equal(json.error.code, error, path);
  if (path.startsWith("/admin/")) assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  return { data: json?.data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
const fixtureLogin = suffix => api("/auth/login", 200, {
  method: "POST", body: { identifier: tag + "-" + suffix, password: fixturePassword },
});
function snapshot() {
  return sql(`SELECT md5(concat_ws('|',
    (SELECT jsonb_agg(to_jsonb(a) - 'password_hash' ORDER BY id)::text FROM accounts a),
    (SELECT jsonb_agg(to_jsonb(s) - 'token_hash' ORDER BY id)::text FROM account_sessions s),
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY account_id)::text FROM consultant_profiles p),
    (SELECT jsonb_agg(to_jsonb(g) ORDER BY method_code)::text FROM cms_method_guides g),
    (SELECT jsonb_agg(to_jsonb(r) ORDER BY method_code,revision)::text FROM cms_method_guide_revisions r),
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY id)::text FROM admin_audit_events e)))`);
}

assert.equal(sql("SELECT current_database()"), database);
assert.equal(sql("SELECT max(installed_rank) FROM flyway_schema_history WHERE success"), "20");
const actor = sql("SELECT id FROM accounts WHERE role='ADMIN' AND status='ACTIVE' AND identifier_normalized='" + adminIdentifier + "'");
assert.match(actor, /^[0-9a-f-]{36}$/, "Provision an active Admin in the selected TEST database");
const admin = await api("/auth/admin/login", 200, {
  method: "POST", body: { identifier: adminIdentifier, password: adminPassword },
});
assert.equal(admin.data.account.id, actor, "The Backend must serve the selected TEST database");
assert.equal(sql("SELECT count(*) FROM cms_method_guides WHERE method_code='" + methodCode + "'"), "0",
  "Use an unused PHASE4_METHOD_CODE or a fresh TEST database");

const accounts = {};
for (const suffix of ["pending", "rejected", "approved", "other"]) {
  const registered = await api("/auth/register", 201, { method: "POST",
    body: { identifier: tag + "-" + suffix, displayName: tag + " " + suffix, password: fixturePassword } });
  assert.equal(registered.data.account.role, "USER");
  accounts[suffix] = registered.data.account.id;
}
assert.equal(sql("SELECT count(*) FROM accounts WHERE identifier_normalized LIKE '" + tag + "-%'"), "4");
sql(`INSERT INTO accounts(id,identifier_normalized,display_name,password_hash,role,status,created_at)
  SELECT gen_random_uuid(), '${tag}-page-' || n, '${tag} page ' || n, a.password_hash,
         'USER', CASE WHEN n % 6 = 0 THEN 'LOCKED' ELSE 'ACTIVE' END, now()
  FROM accounts a CROSS JOIN generate_series(1,24) AS n WHERE a.id='${accounts.other}'`);

const cms = "/admin/method-guides";
const guide = cms + "/" + methodCode;
const profiles = "/admin/consultants";
const directory = "/admin/accounts";
const userTarget = directory + "/" + accounts.approved;
const profileTarget = profiles + "/" + accounts.approved;
const get = async (path, opts = {}) => (await api(path, 200, { session: admin, ...opts })).data;
const write = async (method, path, body, expected = 200, error) =>
  (await api(path, expected, { method, body, session: admin, error })).data;
for (const suffix of ["pending", "rejected", "approved"]) {
  await write("POST", profiles, { accountId: accounts[suffix], summary: "Hồ sơ TEST " + suffix }, 201);
}
await write("PUT", profiles + "/" + accounts.rejected + "/review",
  { expectedVersion: 1, decision: "REJECTED", reason: "Fixture: cần bổ sung giới thiệu." });
await write("PUT", profileTarget + "/review", { expectedVersion: 1, decision: "APPROVED" });
await write("PUT", userTarget + "/role", { expectedVersion: 1, role: "CONSULTANT" });
const user = await fixtureLogin("pending");
const consultant = await fixtureLogin("approved");
assert.equal(consultant.data.account.role, "CONSULTANT");

const createGuide = { methodCode, title: "Hướng dẫn TEST", body: "Dữ liệu tổng hợp cho Phase 4." };
const protectedReads = ["/admin/metrics", "/admin/audit", directory, userTarget, profiles, profileTarget,
  cms, guide, guide + "/events"];
const protectedWrites = [
  ["PUT", userTarget + "/status", { expectedVersion: 2, status: "LOCKED" }],
  ["PUT", userTarget + "/role", { expectedVersion: 2, role: "USER" }],
  ["POST", profiles, { accountId: accounts.other, summary: "Fixture" }],
  ["PUT", profiles + "/" + accounts.pending + "/review", { expectedVersion: 1, decision: "APPROVED" }],
  ["POST", cms, createGuide],
  ["PUT", guide + "/draft", { expectedVersion: 1, title: "Fixture", body: "Fixture" }],
  ["POST", guide + "/submit-review", { expectedVersion: 1 }],
  ["POST", guide + "/return-to-draft", { expectedVersion: 2, reason: "Fixture" }],
  ["POST", guide + "/publish", { expectedVersion: 2 }],
  ["PUT", guide + "/visibility", { expectedVersion: 3, visible: false }],
];
const beforeDenied = snapshot();
async function deny(path, status, options, error) {
  await api(path, status, { ...options, error });
  assertionsDenied++;
}
for (const [method, path, body] of [...protectedReads.map(path => ["GET", path]), ...protectedWrites]) {
  for (const session of [undefined, user, consultant]) {
    await deny(path, 401, { method, body, session }, "INVALID_SESSION");
  }
  await deny(path, 403, { method, body, session: admin, site: "https://invalid.example" }, "CSRF_REJECTED");
  if (method !== "GET") {
    await deny(path, 403, { method, body, session: admin, csrf: "invalid" }, "CSRF_REJECTED");
    await deny(path, 403, { method, body, session: admin, csrf: null }, "CSRF_REJECTED");
    await deny(path, 403, { method, body, session: admin, marker: null }, "CSRF_REJECTED");
  }
}
assert.equal(snapshot(), beforeDenied, "Denied requests mutated protected state");

await write("POST", cms, createGuide, 201);
await write("PUT", guide + "/draft", { expectedVersion: 1, title: createGuide.title, body: createGuide.body });
await write("POST", guide + "/submit-review", { expectedVersion: 2 });
assert.equal((await get("/admin/metrics")).pendingContent,
  Number(sql("SELECT count(*) FROM cms_method_guides WHERE working_status='PENDING_REVIEW'")));
await write("POST", guide + "/return-to-draft", { expectedVersion: 3, reason: "Fixture audit" });
await write("POST", guide + "/submit-review", { expectedVersion: 4 });
await write("POST", guide + "/publish", { expectedVersion: 5 });
assert.ok((await get("/method-guides")).items.some(item => item.methodCode === methodCode));
await write("PUT", guide + "/visibility", { expectedVersion: 6, visible: false });
assert.ok(!(await get("/method-guides")).items.some(item => item.methodCode === methodCode));
await write("PUT", guide + "/visibility", { expectedVersion: 7, visible: true });
assert.equal((await get(guide + "/events")).totalElements, 8);
assert.ok((await get(cms)).items.some(item => item.methodCode === methodCode));
assert.equal((await get(guide)).version, 8);
const afterLock = await write("PUT", userTarget + "/status", { expectedVersion: 2, status: "LOCKED" });
assert.equal(afterLock.lastStatusChange.revokedSessions, 1);
await api("/auth/session", 401, { session: consultant, error: "INVALID_SESSION" });
await write("PUT", userTarget + "/status", { expectedVersion: 3, status: "ACTIVE" });
await api("/auth/session", 401, { session: consultant, error: "INVALID_SESSION" });

const beforeConflict = snapshot();
for (const [method, path, body] of [
  ["PUT", userTarget + "/status", { expectedVersion: 3, status: "LOCKED" }],
  ["PUT", userTarget + "/role", { expectedVersion: 3, role: "USER" }],
  ["PUT", profileTarget + "/review", { expectedVersion: 1, decision: "REJECTED", reason: "Stale" }],
  ["PUT", guide + "/draft", { expectedVersion: 7, title: "Stale", body: "Stale" }],
]) await write(method, path, body, 409, "VERSION_CONFLICT");
assert.equal(snapshot(), beforeConflict, "Version conflicts mutated protected state");

const pages = [];
for (const page of [0, 1]) {
  const result = await get(directory + "?" + new URLSearchParams({ q: tag, size: 20, page }));
  assert.equal(result.totalElements, 28);
  assert.equal(result.totalPages, 2);
  pages.push(...result.items);
}
assert.equal(new Set(pages.map(account => account.id)).size, 28);
assert.equal(pages.filter(account => account.status === "LOCKED").length, 4);
const profilePage = await get(profiles + "?" + new URLSearchParams({ q: tag }));
assert.deepEqual(profilePage.items.map(profile => profile.reviewStatus).sort(), ["APPROVED", "PENDING_REVIEW", "REJECTED"]);
assert.equal((await get(profileTarget)).profile.role, "CONSULTANT");
assert.equal((await get(userTarget)).account.status, "ACTIVE");
assert.equal((await get(profiles + "/" + accounts.rejected)).rejectionReason, "Fixture: cần bổ sung giới thiệu.");
const audit = await get("/admin/audit?actorId=" + actor);
assert.equal(audit.totalElements, Number(sql("SELECT count(*) FROM admin_audit_events WHERE actor_id='" + actor + "'")));
assert.ok(audit.items.some(event => event.action === "CHANGE_ROLE"));
assert.ok(audit.items.some(event => event.action === "PUBLISH"));
assert.ok(audit.items.some(event => event.action === "REJECT_PROFILE"));

const require = createRequire(new URL("../client/package.json", import.meta.url));
const { Client } = require("@stomp/stompjs");
const WebSocket = require("ws");
const initialMetrics = await get("/admin/metrics");
const requestId = randomUUID();
let client, timeout;
try {
  const result = await new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("STOMP calculation timed out")), 10000);
    client = new Client({ reconnectDelay: 0, webSocketFactory: () =>
      new WebSocket(base.origin.replace("http:", "ws:") + "/api/v1/ws", { origin, headers: { Cookie: user.cookie } }),
    onConnect: () => {
      client.subscribe("/user/queue/results", frame => resolve(JSON.parse(frame.body)));
      client.subscribe("/user/queue/errors", frame => reject(new Error(frame.body)));
      client.publish({ destination: "/app/mai-hoa/calculate", body: JSON.stringify({
        requestId, type: "MAI_HOA", payload: { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8 },
      }) });
    }, onStompError: () => reject(new Error("STOMP protocol error")),
    onWebSocketError: () => reject(new Error("WebSocket upgrade failed")) });
    client.activate();
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.requestId, requestId);
} finally {
  clearTimeout(timeout);
  await client?.deactivate({ force: true });
}
const saved = (await api("/history", 201, { method: "POST", session: user,
  body: { calculationRequestId: requestId, title: "Phase 4 history TEST" } })).data;
assert.equal((await api("/history/" + saved.id, 200, { session: user })).data.id, saved.id);
const other = await fixtureLogin("other");
await api("/history/" + saved.id, 404, { session: other, error: "NOT_FOUND" });
await api("/history/" + saved.id, 401, { session: admin, error: "LOGIN_REQUIRED" });
let metrics;
for (let attempt = 0; attempt < 25; attempt++) {
  metrics = await get("/admin/metrics");
  assert.equal(metrics.date, initialMetrics.date, "Run the fixture within one Vietnam calendar day");
  if (metrics.calculations > initialMetrics.calculations) break;
  await new Promise(resolve => setTimeout(resolve, 200));
}
assert.equal(metrics.calculations, initialMetrics.calculations + 1);
assert.equal(metrics.users, Number(sql("SELECT count(*) FROM accounts WHERE role='USER'")));
assert.equal(metrics.consultants, Number(sql("SELECT count(*) FROM accounts WHERE role='CONSULTANT'")));
assert.ok(metrics.methods.find(method => method.id === "OBJECT_COUNT").count >= 1);
assert.equal(metrics.calculations, Number(sql(`SELECT COALESCE(sum(completed_count),0)
  FROM admin_calculation_daily_counts WHERE local_date='${metrics.date}'`)));
console.log(JSON.stringify({ passed: true, database, backend: base.origin, http: requests, methodCode,
  protectedRoutes: protectedReads.length + protectedWrites.length, denied: assertionsDenied, conflicts: 4,
  stomp: 1, syntheticAccounts: 28, profiles: 3, fixtureTag: tag }));
