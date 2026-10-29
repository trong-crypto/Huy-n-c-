"""Independent offline replay of X01.5 raw events and controller/database evidence."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from run_x01_benchmark import ROOT, generated_path, load_json, file_digest, SETTINGS
from run_x01_reliability import reliability_command

STEPS = ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"]
TRIGRAM = ["KHON", "CHAN", "KHAM", "DOAI", "CAN2", "LY", "TON", "CAN"]


def require(condition, message):
    if not condition: raise ValueError(message)


def success_oracle(body, input):
    require(body["status"] == "COMPLETED" and body["type"] == "MAI_HOA" and body["error"] is None, "Success envelope")
    data = body["data"]
    require(data["method"] == "LINES" and data["movingLine"] == input["movingLine"], "Success input differs")
    require(data["ruleBasis"] == "SOURCE_VERIFIED" and data["sourceStatus"] == "VERIFIED" and data["ruleVersion"] == "1.0", "Source gates differ")
    require(data["lunarDate"] is None and "detailedReading" not in data, "Unexpected extra computation")
    require([rule["ruleCode"] for rule in data["rules"]] == ["MH-MUTUAL", "MH-CHANGE"], "Wrong rules")
    require(all(rule["executionPolicy"] == "SOURCE_VERIFIED" and rule["sourceStatus"] == "VERIFIED" for rule in data["rules"]), "Unapproved rule")
    require([s["pdfPage"] for s in data["sourceReferences"]] == [42, 41], "Source pages differ")
    require(all(s["sourceId"] == "MH" and s["sha256"] == "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de" for s in data["sourceReferences"]), "Wrong book identity")
    require(data["decisionReferences"] == [], "Unexpected team decision")
    pattern = sum((1 << i) for i, bit in enumerate(input["payload"]["linesBottomUp"]) if bit)
    require(pattern == input["pattern"], "Input bit pattern differs")
    expected = [pattern, ((pattern >> 1) & 7) | (((pattern >> 2) & 7) << 3), pattern ^ (1 << (input["movingLine"] - 1))]
    for field, bits in zip(("primaryHexagram", "mutualHexagram", "changedHexagram"), expected):
        hexagram = data[field]
        require(hexagram["linesBottomUp"] == [bool(bits & (1 << i)) for i in range(6)], "Wrong hexagram bits/session")
        require(hexagram["code"] == f"H_{TRIGRAM[bits >> 3]}_{TRIGRAM[bits & 7]}" and hexagram["nameStatus"] == "VERIFIED", "Wrong hexagram identity")


def cycle(frames, error=None):
    progress = [frame["body"] for frame in frames if frame["destination"] == "progress"]
    terminals = [frame for frame in frames if frame["destination"] != "progress"]
    require(len(terminals) == 1, "Expected exactly one terminal in cycle")
    if error:
        require(not progress and terminals[0]["destination"] == "errors" and terminals[0]["body"]["error"]["code"] == error, "Wrong rejection or executed rejected job")
    else:
        require([(p["sequence"], p["step"]) for p in progress] == list(enumerate(STEPS, 1)), "Wrong progress sequence")
        require(terminals[0]["destination"] == "results" and frames[-1] == terminals[0], "Success must follow progress")


def case_events(events, case):
    return [event for event in events if case["startSequence"] <= event["sequence"] <= case["endSequence"]]


def audit_suite(folder, suite, target, backend):
    env, summary = load_json(folder / "environment.json"), load_json(folder / "runner/summary.json")
    require(env["passed"] and summary["passed"], "Runner/controller reported failure")
    require(env["command"] == reliability_command(target, backend, suite), "Unexpected launch settings")
    require(env["jarSha256"] == backend["jarSha256"], "JAR differs")
    require(env["databaseUnchanged"] and env["temporaryServerStopped"] and env["temporaryRunnerStopped"] and env["contentionLocksReleased"], "Unsafe cleanup")
    require(load_json(folder / "database_before.json") == load_json(folder / "database_after.json"), "Database snapshot changed")
    require(all(env[key]["health"]["status"] == "UP" and env[key]["readiness"]["status"] == "READY" for key in ("beforeReadiness", "afterReadiness")), "Readiness failure")
    events = [json.loads(line) for line in (folder / "runner/events.jsonl").read_text(encoding="utf-8").splitlines()]
    require([e["sequence"] for e in events] == list(range(1, len(events) + 1)), "Raw event sequence gap")
    require(all(a["monoMs"] <= b["monoMs"] for a, b in zip(events, events[1:])), "Non-monotonic event clock")
    require(not any(e["kind"] in ("PROTOCOL_FAILURE", "STOMP_ERROR", "SOCKET_ERROR", "SUITE_FAILURE") for e in events), "Protocol failure")
    records = load_json(folder / "runner/records.json")
    index = {(r["clientId"], r["requestId"]): r for r in records}
    require(len(index) == len(records), "Duplicate logical record")
    allowed_labels = {"readiness", "inflight", "same-id-independent", "before-reconnect", "after-reconnect"} if suite == "idempotency" else {"readiness", "natural-burst", "controlled-burst", "fresh-after-burst"}
    require(all(r["label"] in allowed_labels for r in records), "Unexpected logical record outside planned cases")
    require(sum(r["label"] == "readiness" for r in records) == 20, "Readiness not proven for 20 clients")
    received, sent = defaultdict(list), defaultdict(list)
    for event in events:
        if event["kind"] in ("SEND", "RECEIVE"):
            key = (event["clientId"], event["requestId"])
            require(key in index, "Unknown or wrong-session event")
            if event["kind"] == "SEND":
                require(event["request"]["requestId"].lower() == event["requestId"], "Wire correlation differs")
                sent[key].append(event)
            else:
                require(sent[key] and event["body"]["requestId"].lower() == event["requestId"], "Received before SEND or wrong correlation")
                received[key].append(event)
                if event["destination"] == "results": success_oracle(event["body"], index[key]["input"])
                elif event["destination"] == "errors":
                    require(event["body"]["status"] == "FAILED" and event["body"]["error"]["code"] in ("SERVER_BUSY", "INVALID_INPUT"), "Unexpected error")
    require(all(received[key] for key in index), "Unanswered logical ID")
    for key, record in index.items():
        if record["label"] in ("readiness", "same-id-independent", "before-reconnect", "after-reconnect", "fresh-after-burst"):
            cycle(received[key]); require(len(sent[key]) == 1, "Unexpected send count")
    raw_counts = {"sends": sum(map(len, sent.values())), "progress": sum(e["destination"] == "progress" for group in received.values() for e in group),
        "successes": sum(e["destination"] == "results" for group in received.values() for e in group),
        "errors": dict(Counter(e["body"]["error"]["code"] for group in received.values() for e in group if e["destination"] == "errors"))}
    require(raw_counts == summary["counts"], "Summary/raw counts differ")
    require(summary["fatalCount"] == 0 and summary["cookies"] is False and summary["automaticRetry"] is False and summary["automaticReconnect"] is False, "Unexpected client behavior")
    connections = [e for e in events if e["kind"] == "CONNECTED"]
    disconnects = [e for e in events if e["kind"] == "DISCONNECTED"]
    require(all(e["httpStatus"] == 101 for e in connections), "Missing real WS handshake")
    require(len(connections) == (21 if suite == "idempotency" else 20), "Unexpected physical connection count")
    require(Counter(e["clientId"] for e in connections) == Counter(e["clientId"] for e in disconnects), "Connection not closed")
    require(all(e["intentional"] for e in disconnects), "Unexpected disconnect")
    cases = {case["name"]: case for case in summary["cases"]}
    require(all(c["status"] == "PASS" for c in cases.values()), "Case failed")
    expected_names = (["in_flight_dedupe_and_conflict", "terminal_replay_and_conflict_preserves_original", "twenty_sessions_same_id_independent_inputs",
                       "reconnect_starts_new_work", "expired_default_60s_ttl_recomputes"] if suite == "idempotency" else
                      ["natural_burst_20x8_and_recovery", "observed_full_2worker_4queue_and_non_cached_rejection"])
    require(list(cases) == expected_names, "Missing or reordered cases")
    if suite == "idempotency":
        frame_events = case_events(events, cases[expected_names[0]])
        inputs = [e for e in frame_events if e["kind"] == "SEND"]
        require([e["role"] for e in inputs] == ["original", "duplicate-reordered", "duplicate-uppercase", "conflict-inflight"], "In-flight SEND roles differ")
        require(len({(e["clientId"], e["requestId"]) for e in inputs}) == 1, "In-flight ID differs")
        key = (inputs[0]["clientId"], inputs[0]["requestId"])
        require(inputs[0]["request"]["payload"] == inputs[1]["request"]["payload"] == inputs[2]["request"]["payload"], "Duplicate payload differs")
        require(inputs[2]["wireRequestId"] == inputs[0]["requestId"].upper(), "UUID case not exercised")
        require(inputs[3]["request"]["payload"] != inputs[0]["request"]["payload"], "Conflict payload not changed")
        frames = [e for e in frame_events if e["kind"] == "RECEIVE"]
        cycle([e for e in frames if e["destination"] != "errors"])
        require(sum(e["destination"] == "errors" and e["body"]["error"]["code"] == "INVALID_INPUT" for e in frames) == 1, "In-flight conflict missing")
        result = next(e for e in frames if e["destination"] == "results")
        blocked = [e for e in frame_events if e["kind"] == "CONTROL_RESULT" and e["action"] == "wait_blocked_one"]
        require(len(blocked) == 2 and all(len(e["result"]["blocked"]) >= 1 for e in blocked), "In-flight state unproven")
        require(inputs[2]["sequence"] < blocked[-1]["sequence"] < result["sequence"], "Duplicate not bracketed by active worker evidence")
        original_body, original_at = result["body"], result["monoMs"]
        replay = case_events(events, cases[expected_names[1]])
        sends = [e for e in replay if e["kind"] == "SEND"]
        require([e["role"] for e in sends] == ["terminal-replay", "conflict-after-terminal", "replay-after-conflict"], "Replay trial incomplete")
        for i, request in enumerate(sends):
            end = sends[i + 1]["sequence"] if i + 1 < len(sends) else float("inf")
            replies = [e for e in replay if e["kind"] == "RECEIVE" and request["sequence"] < e["sequence"] < end]
            if i == 1: cycle(replies, "INVALID_INPUT")
            else: require(len(replies) == 1 and replies[0]["body"] == original_body, "Replay differs or has progress")
        independent = [r for r in records if r["label"] == "same-id-independent"]
        require(len(independent) == 20 and len({r["requestId"] for r in independent}) == 1 and len({r["input"]["pattern"] for r in independent}) == 20, "20-session routing trial incomplete")
        old = next(r for r in records if r["label"] == "before-reconnect")
        new = next(r for r in records if r["label"] == "after-reconnect")
        require(old["requestId"] == new["requestId"] and old["input"] == new["input"] and old["clientId"] != new["clientId"], "Reconnect does not reuse old input/ID on new connection")
        old_disconnect = next(e for e in disconnects if e["clientId"] == old["clientId"])
        new_connect = next(e for e in connections if e["clientId"] == new["clientId"])
        require(old_disconnect["sequence"] < new_connect["sequence"], "Reconnect before old close")
        ttl = case_events(events, cases[expected_names[4]])
        request = next(e for e in ttl if e["kind"] == "SEND")
        require((request["clientId"], request["requestId"]) == key and request["monoMs"] - original_at >= 61500, "Default TTL not elapsed")
        cycle([e for e in ttl if e["kind"] == "RECEIVE"])
        original_all = received[key]
        require(len(sent[key]) == 8 and len(original_all) == 14
                and sum(e["destination"] == "progress" for e in original_all) == 8
                and sum(e["destination"] == "results" for e in original_all) == 4
                and sum(e["destination"] == "errors" for e in original_all) == 2,
                "Unexplained/late original-ID event outside case windows")
    else:
        for name in expected_names:
            group_events = case_events(events, cases[name])
            burst = [r for r in records if r["label"] == ("natural-burst" if name == expected_names[0] else "controlled-burst")]
            require(len(burst) == 160 and Counter(r["clientId"] for r in burst) == Counter({f"client-{i + 1}": 8 for i in range(20)}), "Burst not 20x8")
            counts = Counter()
            for record in burst:
                key = (record["clientId"], record["requestId"])
                retry = [e for e in sent[key] if e["role"] == "explicit-retry-rejected-id"]
                first = [e for e in received[key] if not retry or e["sequence"] < retry[0]["sequence"]]
                code = next((e["body"]["error"]["code"] for e in first if e["destination"] == "errors"), None)
                cycle(first, code); counts[code or "COMPLETED"] += 1
                if retry: cycle([e for e in received[key] if e["sequence"] > retry[0]["sequence"]])
            details = cases[name]["details"]
            require(counts["COMPLETED"] == details["completed"] and counts["SERVER_BUSY"] == details["serverBusy"], "Burst counts differ")
            if name == expected_names[1]:
                require(counts == Counter({"SERVER_BUSY": 154, "COMPLETED": 6}), "Controlled saturation not 2+4 admitted/154 rejected")
                observations = [e for e in group_events if e["kind"] == "CONTROL_RESULT" and e["action"] == "wait_blocked_two"]
                require(len(observations) == 2 and all(len(e["result"]["blocked"]) == 2 for e in observations), "Two busy workers not proven")
                release = next(e for e in group_events if e["kind"] == "CONTROL_REQUEST" and e["action"] == "release_lock")
                require(sum(e["kind"] == "RECEIVE" and e["destination"] == "errors" and e["sequence"] < release["sequence"] for e in group_events) == 154, "Rejections not observed while gate held")
                require(not any(e["kind"] == "RECEIVE" and e["destination"] == "results" and e["sequence"] < release["sequence"] for e in group_events), "Gate did not prevent completion")
                require(160 < SETTINGS["max-active-calculations"] and 8 < SETTINGS["max-active-per-session"] and len(records) < SETTINGS["idempotency-max-entries"], "Other admission limit could explain rejection")
    gate_ops = load_json(folder / "gate_operations.json")
    require(gate_ops[-1]["action"] == "release_lock" and not gate_ops[-1]["result"]["locks"] and not gate_ops[-1]["result"]["blocked"], "Gate cleanup not proven")
    transcript = [json.loads(line) for line in (folder / "control-transcript.jsonl").read_text(encoding="utf-8").splitlines()]
    controller = {e["rpcId"]: e for e in transcript if e["from"] == "controller"}
    for event in (e for e in events if e["kind"] == "CONTROL_RESULT"):
        require(controller[event["rpcId"]]["result"] == event["result"], "Runner fabricated controller observation")
    return {"suite": suite, "status": "PASS", "cases": [{"name": c["name"], "status": "PASS", "details": c["details"]} for c in cases.values()],
            "rawCounts": raw_counts, "connections": len(connections), "databaseUnchanged": True, "temporaryProcessesStopped": True}


def audit(folder):
    manifest, target, backend = load_json(folder / "results.json"), load_json(folder / "target.json"), load_json(folder / "backend_manifest.json")
    require(manifest["status"] == "MEASUREMENTS_COMPLETE_PENDING_INDEPENDENT_AUDIT", "Incomplete run")
    require([s["suite"] for s in manifest["suites"]] == ["idempotency", "overload"], "Both suites required")
    for name, sha in load_json(folder / "source_pins.json").items():
        require(file_digest(folder / "source_snapshot" / name) == sha, "Archived runner source changed")
    require(file_digest(generated_path(backend["jar"])) == backend["jarSha256"], "Pinned JAR changed")
    suites = [audit_suite(folder / name, name, target, backend) for name in ("idempotency", "overload")]
    return {"task": "X01.5", "status": "PASS", "caseCount": sum(len(s["cases"]) for s in suites),
            "evidenceDirectory": str(folder.relative_to(ROOT)), "database": target["database"], "jarSha256": backend["jarSha256"],
            "suites": suites, "performanceResultsModified": False, "productSourcesModified": False,
            "limits": ["Loopback STOMP Clients, not physical client machines", "Controlled DB lock is fault injection, not normal latency", "TTL wait uses client observation plus 1.5s margin; internal execution count is inferred from protocol progress, not instrumented"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", required=True)
    args = parser.parse_args()
    folder = generated_path(args.evidence)
    report = audit(folder)
    destination = folder / "independent_audit.json"
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "cases": report["caseCount"], "evidence": report["evidenceDirectory"]}))


if __name__ == "__main__": main()
