"""Independently recalculate X01.4 raw CSV evidence; no DB writes or network access.

Partial mode audits only finished runs, never declares the official matrix done.
This produces basic tables; overload/idempotency and full X01.6 discussion/plots
remain separate tasks.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import statistics

from prepare_x01_test_database import ROOT, GENERATED, VIETNAM, file_digest
from run_x01_benchmark import load_json, generated_path
from run_x01_matrix import MATRIX


def require(condition, message):
    if not condition:
        raise ValueError(message)


def equal_number(actual, expected, message):
    require(math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-6), message)


def cpu_summary(rows, time_key, cpu_keys, scale):
    require(len(rows) >= 2, "Insufficient resource samples")
    intervals = []
    for before, after in zip(rows, rows[1:]):
        elapsed = float(after[time_key]) - float(before[time_key])
        used = sum(float(after[key]) - float(before[key]) for key in cpu_keys)
        require(elapsed > 0 and used >= 0, "Non-monotonic resource samples")
        intervals.append(100 * used * scale / elapsed)
    elapsed = float(rows[-1][time_key]) - float(rows[0][time_key])
    used = sum(float(rows[-1][key]) - float(rows[0][key]) for key in cpu_keys)
    return {"meanPercentOneCore": 100 * used * scale / elapsed, "maxSamplePercentOneCore": max(intervals)}


def csv_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def select_cohort(labelled, window):
    require(all(float(row["sendMonoMs"]) >= window["start"] for row in labelled), "SEND before measurement start")
    measured = [row for row in labelled if window["start"] <= float(row["sendMonoMs"]) < window["end"]]
    outside = [row for row in labelled if float(row["sendMonoMs"]) >= window["end"]]
    return measured, outside


def audit_run(run, evidence: Path, baseline: dict, backend: dict):
    run = dict(run, repeat=run["summary"]["repeat"])
    folder = generated_path(run["folder"])
    require(folder.is_relative_to(evidence), "Run escapes matrix directory")
    environment = load_json(folder / "environment.json")
    summary = load_json(folder / "runner/summary.json")
    rows = csv_rows(folder / "runner/raw.csv")
    require(run["passed"] and environment["passed"] and summary["passed"], "A run did not pass")
    require(run["databaseUnchanged"] and run["temporaryServerStopped"], "Run cleanup/DB guard failed")
    require(environment["samplerExitCode"] == 0, "Resource sampler failed")
    require(load_json(folder / "database_before.json") == load_json(folder / "database_after.json") == baseline,
            "Database snapshot differs from X01.1")
    require(environment["jarSha256"] == backend["jarSha256"], "JAR differs")
    require(summary == run["summary"] == environment["runnerSummary"], "Summaries disagree")
    require(summary["kind"] == "benchmark" and summary["benchmarkResult"], "Non-official run in matrix")
    require(summary["mode"] == run["mode"] and summary["repeat"] == run["repeat"], "Run labels differ")
    require(summary["clients"] == summary["connectionCount"] == summary["connectedPeak"] == run["clients"], "Client count differs")
    require(all(row["connectionCount"] == 1 and row["httpStatus"] == 101 for row in summary["connections"]),
            "Connection/HTTP upgrade differs")
    config = summary["config"]
    require(config["warmupMs"] == 10000 and config["durationMs"] == 60000 and config["thinkMs"] == 200,
            "Official timing differs")
    require(config["drainMs"] == config["requestTimeoutMs"] == 15000 and config["maxInFlightPerClient"] == 1,
            "Deadline/concurrency differs")
    require(not config["automaticReconnect"] and not config["automaticRetry"] and not config["cookies"], "Unexpected retry/cookie")
    require(summary["eventCount"] == 0 and not (folder / "runner/events.jsonl").read_text(encoding="utf-8").strip(),
            "Protocol events found")
    require(len({row["requestId"] for row in rows}) == len(rows), "Duplicate requestId")
    phases = Counter(row["phase"] for row in rows)
    require(phases["readiness"] == run["clients"] and set(phases) == {"readiness", "warmup", "measurement"}, "Unexpected phase")
    for row in rows:
        require(row["sent"] == row["correct"] == "true" and row["category"] == "completed"
                and row["status"] == "COMPLETED" and row["errorCode"] == "" and row["progressCount"] == "4",
                "A row is not a valid success")
        require(row["runId"] == summary["runId"] and row["mode"] == run["mode"]
                and int(row["clients"]) == run["clients"] and int(row["repeat"]) == run["repeat"], "CSV labels differ")
        equal_number(float(row["latencyMs"]), float(row["terminalMonoMs"]) - float(row["sendMonoMs"]), "Latency timestamps differ")
    gaps = []
    for client in {row["clientId"] for row in rows}:
        for phase in ("warmup", "measurement"):
            subset = [row for row in rows if row["clientId"] == client and row["phase"] == phase]
            index = int(client.split("-")[1]) - 1
            for sequence, row in enumerate(subset):
                require(row["inputCase"] == f"{(17 * index + sequence) % 64}:{1 + ((index + sequence) % 6)}", "Workload seed differs")
        traffic = sorted([row for row in rows if row["clientId"] == client and row["phase"] != "readiness"],
                         key=lambda row: float(row["sendMonoMs"]))
        gaps += [float(b["sendMonoMs"]) - float(a["terminalMonoMs"]) for a, b in zip(traffic, traffic[1:])]
    require(gaps and min(gaps) >= 199.99, "Think time shorter than 200ms")
    window = summary["windows"]["measurement"]
    equal_number(window["end"] - window["start"], 60000, "Measurement window differs")
    labelled = [row for row in rows if row["phase"] == "measurement"]
    require(all((row["terminalAfterWindow"] == "true") == (float(row["terminalMonoMs"]) >= window["end"])
                for row in labelled), "Late-result flags differ")
    # Cohort membership was defined before the run by SEND timestamps, not by phase labels.
    # Preserve original rows/summaries and explicitly report any scheduling deviation.
    measured, outside = select_cohort(labelled, window)
    original_latency = sorted(float(row["latencyMs"]) for row in labelled)
    labelled_inside = sum(float(row["terminalMonoMs"]) < window["end"] for row in labelled)
    metrics = summary["metrics"]
    require(len(labelled) == metrics["sent"] == metrics["completed"] == metrics["sampleCount"], "Original labelled counts differ")
    require(metrics["completedInsideWindow"] == labelled_inside and metrics["completedAfterWindow"] == len(labelled) - labelled_inside,
            "Window completion counts differ")
    require(metrics["errors"] == {} and metrics["publishFailures"] == 0 and metrics["reconciled"]
            and metrics["cohortSuccessRate"] == 1, "Errors or reconciliation failure")
    equal_number(metrics["medianLatencyMs"], statistics.median(original_latency), "Original median differs")
    equal_number(metrics["p95LatencyMs"], original_latency[math.ceil(0.95 * len(original_latency)) - 1], "Original P95 differs")
    equal_number(metrics["throughputPerSecond"], labelled_inside / 60, "Original throughput differs")
    equal_number(metrics["sentRatePerSecond"], len(labelled) / 60, "Original SEND rate differs")
    inside = sum(float(row["terminalMonoMs"]) < window["end"] for row in measured)
    latency = sorted(float(row["latencyMs"]) for row in measured)
    require(labelled_inside == inside, "Out-of-cohort SEND affected inside-window accounting")
    require(summary["allPhases"]["requests"] == len(rows)
            and summary["allPhases"]["progress"] == len(rows) * 4, "All-phase counters differ")
    for state in (environment["beforeReadiness"], environment["afterReadiness"]):
        require(state["health"]["status"] == "UP" and state["readiness"]["status"] == "READY", "Health/readiness failed")
    node_samples = csv_rows(folder / "runner/runner-resources.csv")
    node_window = [row for row in node_samples if window["start"] <= float(row["monoMs"]) <= window["end"]]
    server_samples = csv_rows(folder / "server-resources.csv")
    result = {"clients": run["clients"], "mode": run["mode"], "repeat": run["repeat"], "passed": True,
              "readinessRequests": phases["readiness"], "warmupRequests": phases["warmup"],
              "measurementRequests": len(measured), "labelledMeasurementRequests": len(labelled),
              "outOfWindowSends": len(outside),
              "excludedBoundaryRequests": [{"requestId": row["requestId"], "clientId": row["clientId"],
                                            "afterWindowMs": float(row["sendMonoMs"]) - window["end"]} for row in outside],
              "strictSendWindowSatisfied": not outside, "completedInsideWindow": inside,
              "completedAfterWindow": len(measured) - inside, "allCompleted": len(rows), "progress": len(rows) * 4,
              "medianMs": statistics.median(latency), "p95Ms": latency[math.ceil(0.95 * len(latency)) - 1],
              "throughputPerSecond": inside / 60, "sentRatePerSecond": len(measured) / 60, "errors": 0,
              "minThinkGapMs": min(gaps), "registryKeyUpperBound": len(rows),
              "nodeCpuMeasurement": cpu_summary(node_window, "monoMs", ["cpuUserMs", "cpuSystemMs"], 1),
              "nodePeakMeasurementRssBytes": max(int(row["rssBytes"]) for row in node_window),
              "serverCpuWholeLifecycle": cpu_summary(server_samples, "samplerElapsedMs", ["cpuTotalSeconds"], 1000),
              "serverPeakRssBytesWholeLifecycle": max(int(row["workingSetBytes"]) for row in server_samples),
              "serverPeakOsThreadsWholeLifecycle": max(int(row["osThreadCount"]) for row in server_samples),
              "databaseUnchanged": True, "temporaryServerStopped": True}
    require(len(rows) < 10000, "Registry guard requires review")
    return result, environment


def audit(evidence: Path, partial: bool = False):
    evidence = evidence.resolve()
    require(evidence.is_relative_to(GENERATED.resolve()), "Matrix artifacts must be in scripts/generated")
    matrix = load_json(evidence / ("matrix_progress.json" if partial else "matrix_results.json"))
    backend = load_json(GENERATED / "x01_backend_target.json")
    require(matrix["jarSha256"] == backend["jarSha256"], "Matrix/JAR pin differs")
    actual_order = [(item["summary"]["repeat"], item["clients"], item["mode"]) for item in matrix["runs"]]
    require(actual_order == MATRIX[:len(actual_order)], "Matrix order differs from the plan")
    if not partial:
        require(matrix["status"] == "MEASUREMENTS_COMPLETE" and matrix["completedRuns"] == 18
                and matrix["benchmarkMatrixComplete"] and actual_order == MATRIX, "Matrix is incomplete")
    totals = Counter()
    rows = []
    commands = []
    for run in matrix["runs"]:
        row, environment = audit_run(run, evidence, matrix["databaseBaseline"], backend)
        require(environment["runnerToolchain"] == matrix["toolchain"], "Toolchain changed")
        commands.append([value for value in environment["command"] if not value.startswith("--huyenco.calculation-mode=")])
        require("--huyenco.calculation-mode=" + run["mode"] in environment["command"], "Mode label/launch differs")
        rows.append(row)
        for phase in ("readiness", "warmup", "measurement"):
            totals[phase] += row[phase + "Requests"]
        totals["completed"] += row["allCompleted"]
        totals["progress"] += row["progress"]
        totals["completedAfterWindow"] += row["completedAfterWindow"]
        totals["labelledMeasurement"] += row["labelledMeasurementRequests"]
        totals["outOfWindowSends"] += row["outOfWindowSends"]
    require(all(value == commands[0] for value in commands), "Launch settings changed")
    runtime_root = ROOT
    snapshot_manifest = evidence / "runtime_snapshot_manifest.json"
    if snapshot_manifest.exists():
        archived = load_json(snapshot_manifest)
        require(archived["files"] == matrix["runnerPins"], "Runtime archive pins differ")
        runtime_root = evidence / archived["snapshotDirectory"]
        require(runtime_root.resolve().is_relative_to(evidence), "Runtime snapshot escapes evidence")
    for relative, expected in matrix["runnerPins"].items():
        require(file_digest(runtime_root / relative) == expected, "Pinned runner/guard changed: " + relative)
    require(file_digest(ROOT / backend["jar"]) == backend["jarSha256"], "JAR changed")
    groups = defaultdict(list)
    for row in rows:
        groups[(row["clients"], row["mode"])].append(row)
    aggregate = []
    for (clients, mode), runs in sorted(groups.items()):
        result = {"clients": clients, "mode": mode, "runs": len(runs), "measurementRequests": sum(r["measurementRequests"] for r in runs)}
        for key in ("throughputPerSecond", "medianMs", "p95Ms"):
            values = [row[key] for row in runs]
            result[key] = {"values": values, "median": statistics.median(values), "min": min(values), "max": max(values)}
        aggregate.append(result)
    status = "PARTIAL_AUDIT" if partial else ("COHORT_AUDIT_PASS_WITH_WINDOW_DEVIATION" if totals["outOfWindowSends"] else "RAW_AUDIT_PASS")
    return {"task": "X01.4", "status": status,
            "analyzedAt": datetime.now(VIETNAM).isoformat(), "evidenceDirectory": str(evidence.relative_to(ROOT)).replace("\\", "/"),
            "completeMatrix": not partial, "completedRuns": len(rows), "expectedRuns": 18,
            "database": matrix["database"], "jarSha256": backend["jarSha256"], "totals": dict(totals),
            "runs": rows, "aggregate": aggregate, "sameLaunchSettingsExceptMode": True,
            "strictSendWindowSatisfied": totals["outOfWindowSends"] == 0,
            "cohortDefinition": "Only measurement-phase SEND timestamps in the predefined [start,end) window",
            "originalRawAndSummariesUnchanged": True,
            "allDatabaseSnapshotsMatchX011": True, "completedRunServersStopped": True,
            "allOwnedServersStopped": bool(not partial and matrix.get("allOwnedServersStopped")),
            "p95Aggregation": "nearest-rank per run; aggregate median and range across runs, not pooled percentile",
            "resourceScope": "Node measurement samples; Server whole lifecycle including JVM startup"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--partial", action="store_true")
    args = parser.parse_args()
    evidence = args.evidence
    if evidence is None:
        evidence = generated_path(load_json(GENERATED / "x01_official_matrix_target.json")["evidenceDirectory"])
    elif not evidence.is_absolute():
        evidence = ROOT / evidence
    result = audit(evidence, args.partial)
    output = evidence / ("matrix_partial_analysis.json" if args.partial else "matrix_analysis.json")
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "completedRuns": result["completedRuns"], "totals": result["totals"],
                      "aggregate": result["aggregate"]}, indent=2))
    if not args.partial:
        with (evidence / "matrix_summary.csv").open("w", encoding="utf-8", newline="") as stream:
            keys = ["clients", "mode", "repeat", "measurementRequests", "labelledMeasurementRequests", "outOfWindowSends",
                    "strictSendWindowSatisfied", "completedInsideWindow", "completedAfterWindow",
                    "medianMs", "p95Ms", "throughputPerSecond", "errors", "minThinkGapMs", "databaseUnchanged"]
            writer = csv.DictWriter(stream, fieldnames=keys, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(result["runs"])


if __name__ == "__main__":
    main()
