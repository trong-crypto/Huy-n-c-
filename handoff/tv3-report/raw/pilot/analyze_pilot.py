"""Independently reconcile X01.3 raw evidence; does not access DB or start processes."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter
import csv
import hashlib
import json
import math
import statistics
import uuid

EVIDENCE = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[3]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def close(actual, expected):
    assert math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-6), (actual, expected)


def cpu_intervals(samples, time_key, cpu_keys, scale):
    values = []
    for before, after in zip(samples, samples[1:]):
        elapsed = float(after[time_key]) - float(before[time_key])
        used = sum(float(after[key]) - float(before[key]) for key in cpu_keys)
        assert elapsed > 0 and used >= 0
        values.append(100 * used * scale / elapsed)
    assert values
    elapsed = float(samples[-1][time_key]) - float(samples[0][time_key])
    used = sum(float(samples[-1][key]) - float(samples[0][key]) for key in cpu_keys)
    return {"meanPercentOneCore": 100 * used * scale / elapsed, "maxSamplePercentOneCore": max(values)}


def main():
    bundle = read(EVIDENCE / "runs.json")
    target = read(ROOT / "scripts/generated/x01_benchmark_target.json")
    backend = read(ROOT / "scripts/generated/x01_backend_target.json")
    assert bundle["action"] == "pilot" and bundle["passed"] and len(bundle["runs"]) == 4
    assert {(run["clients"], run["mode"]) for run in bundle["runs"]} == {(n, mode) for n in (2, 20) for mode in ("direct", "bounded")}
    baseline = read(ROOT / target["evidenceDirectory"] / "target_baseline.json")
    report = []
    totals = Counter()
    toolchains = []
    commands = []
    source_pins = []
    for run in bundle["runs"]:
        folder = ROOT / run["folder"]
        assert folder.resolve().is_relative_to(EVIDENCE)
        environment = read(folder / "environment.json")
        summary = read(folder / "runner/summary.json")
        rows = list(csv.DictReader((folder / "runner/raw.csv").open(encoding="utf-8")))
        events = (folder / "runner/events.jsonl").read_text(encoding="utf-8").strip()
        assert run["passed"] and run["databaseUnchanged"] and run["temporaryServerStopped"]
        assert environment["passed"] and environment["samplerExitCode"] == 0
        assert environment["jarSha256"] == backend["jarSha256"]
        assert read(folder / "database_before.json") == read(folder / "database_after.json") == baseline
        assert environment["beforeReadiness"]["health"]["status"] == environment["afterReadiness"]["health"]["status"] == "UP"
        assert environment["beforeReadiness"]["readiness"]["status"] == environment["afterReadiness"]["readiness"]["status"] == "READY"
        assert summary == run["summary"] and summary["passed"] and summary["kind"] == "pilot"
        assert not summary["benchmarkResult"] and not events and summary["eventCount"] == 0
        assert summary["clients"] == summary["connectionCount"] == summary["connectedPeak"] == run["clients"]
        assert all(c["connectionCount"] == 1 and c["httpStatus"] == 101 for c in summary["connections"])
        assert summary["config"]["warmupMs"] == 2000 and summary["config"]["durationMs"] == 5000
        assert summary["config"]["thinkMs"] == 200 and summary["config"]["maxInFlightPerClient"] == 1
        assert len({row["requestId"] for row in rows}) == len(rows)
        for row in rows:
            uuid.UUID(row["requestId"])
            assert row["sent"] == row["correct"] == "true" and row["category"] == "completed" and row["status"] == "COMPLETED"
            assert row["errorCode"] == "" and row["progressCount"] == "4"
            close(float(row["latencyMs"]), float(row["terminalMonoMs"]) - float(row["sendMonoMs"]))
        phases = Counter(row["phase"] for row in rows)
        assert phases["readiness"] == run["clients"]
        gaps = []
        for client in {row["clientId"] for row in rows}:
            for phase in ("warmup", "measurement"):
                subset = [row for row in rows if row["clientId"] == client and row["phase"] == phase]
                index = int(client.split("-")[1]) - 1
                for sequence, row in enumerate(subset):
                    assert row["inputCase"] == f"{(17 * index + sequence) % 64}:{1 + ((index + sequence) % 6)}"
            traffic = sorted([row for row in rows if row["clientId"] == client and row["phase"] != "readiness"], key=lambda row: float(row["sendMonoMs"]))
            gaps += [float(b["sendMonoMs"]) - float(a["terminalMonoMs"]) for a, b in zip(traffic, traffic[1:])]
        assert min(gaps) >= 199.99
        measurement = summary["windows"]["measurement"]
        measured = [row for row in rows if row["phase"] == "measurement"]
        assert all(measurement["start"] <= float(row["sendMonoMs"]) < measurement["end"] for row in measured)
        inside = sum(float(row["terminalMonoMs"]) < measurement["end"] for row in measured)
        assert all((row["terminalAfterWindow"] == "true") == (float(row["terminalMonoMs"]) >= measurement["end"]) for row in measured)
        latency = sorted(float(row["latencyMs"]) for row in measured)
        metrics = summary["metrics"]
        assert metrics["sent"] == metrics["completed"] == metrics["sampleCount"] == len(measured)
        assert metrics["completedInsideWindow"] == inside and metrics["completedAfterWindow"] == len(measured) - inside
        assert metrics["errors"] == {} and metrics["publishFailures"] == 0 and metrics["reconciled"]
        close(metrics["medianLatencyMs"], statistics.median(latency))
        close(metrics["p95LatencyMs"], latency[math.ceil(0.95 * len(latency)) - 1])
        close(metrics["throughputPerSecond"], inside / 5)
        close(metrics["sentRatePerSecond"], len(measured) / 5)
        assert metrics["cohortSuccessRate"] == 1
        node_samples = list(csv.DictReader((folder / "runner/runner-resources.csv").open(encoding="utf-8")))
        node_window = [row for row in node_samples if measurement["start"] <= float(row["monoMs"]) <= measurement["end"]]
        assert len(node_window) >= 2
        server_samples = list(csv.DictReader((folder / "server-resources.csv").open(encoding="utf-8-sig")))
        assert len(server_samples) >= 2
        row = {"clients": run["clients"], "mode": run["mode"], "passed": True,
               "readinessRequests": phases["readiness"], "warmupRequests": phases["warmup"], "measurementRequests": len(measured),
               "allCompleted": len(rows), "progress": len(rows) * 4, "medianMs": statistics.median(latency),
               "p95Ms": latency[math.ceil(0.95 * len(latency)) - 1], "throughputPerSecond": inside / 5,
               "completedAfterWindow": len(measured) - inside, "errors": 0, "minThinkGapMs": min(gaps),
               "nodeCpuMeasurement": cpu_intervals(node_window, "monoMs", ["cpuUserMs", "cpuSystemMs"], 1),
               "nodePeakMeasurementRssBytes": max(int(sample["rssBytes"]) for sample in node_window),
               "nodeEventLoopP95MsWholeRun": summary["eventLoopDelayMs"]["p95"],
               "serverCpuWholeLifecycle": cpu_intervals(server_samples, "samplerElapsedMs", ["cpuTotalSeconds"], 1000),
               "serverPeakRssBytesWholeLifecycle": max(int(sample["workingSetBytes"]) for sample in server_samples),
               "serverPeakOsThreadsWholeLifecycle": max(int(sample["osThreadCount"]) for sample in server_samples),
               "databaseUnchanged": True, "temporaryServerStopped": True}
        toolchains.append(environment["runnerToolchain"])
        source_pins.append(environment["sourceHashes"])
        commands.append([part for part in environment["command"] if not part.startswith("--huyenco.calculation-mode=")])
        assert next(part for part in environment["command"] if part.startswith("--huyenco.calculation-mode=")) == "--huyenco.calculation-mode=" + run["mode"]
        assert environment["runnerSummary"]["database"] == target["database"]
        assert summary["allPhases"]["requests"] == len(rows) and summary["allPhases"]["progress"] == len(rows) * 4
        totals.update(phases); totals["completed"] += len(rows); totals["progress"] += len(rows) * 4
        report.append(row)
    assert all(value == toolchains[0] for value in toolchains)
    assert all(value == source_pins[0] for value in source_pins)
    assert all(value == commands[0] for value in commands)
    for relative, expected in source_pins[0].items():
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected
    assert hashlib.sha256((ROOT / backend["jar"]).read_bytes()).hexdigest() == backend["jarSha256"]
    result = {"task": "X01.3", "status": "PASS", "readyForOfficialMatrix": True,
              "analyzedAt": datetime.now(timezone(timedelta(hours=7))).isoformat(), "database": target["database"],
              "jarSha256": backend["jarSha256"], "totals": dict(totals), "runs": report,
              "sameJarLaunchSettingsExceptMode": True, "sameRunnerToolchain": True,
              "allDatabaseSnapshotsMatchX011": True, "allOwnedServersStopped": True,
              "officialMatrixExecuted": False, "cpuPercentDefinition": "100% means one logical core; interval-derived samples",
              "resourceScope": "Node CPU/RSS measurement samples; Server CPU/RSS/OS threads whole lifecycle including startup",
              "generatorObservation": "Interpret resource samples with the 200ms paced workload; this pilot is not a maximum-throughput test"}
    (EVIDENCE / "pilot_analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
