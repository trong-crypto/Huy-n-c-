"""Execute the pinned X01.4 18-run matrix sequentially; no automatic retries.

Reuses the X01.2 per-run lifecycle/TEST guards. PGPASSWORD is inherited, never
stored. A failed run is preserved and stops the matrix; no source or dataset is
changed to improve measurements.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import json
import os
from pathlib import Path
import platform
from types import SimpleNamespace
import time

from prepare_x01_test_database import ROOT, GENERATED, POINTER, VIETNAM, file_digest, safe_error
from run_x01_benchmark import (BACKEND_POINTER, load_json, verify_database, verify_backend,
                               runner_toolchain, one_run, check_port, git_metadata)

MATRIX = [
    (1, 2, "direct"), (1, 2, "bounded"), (1, 5, "bounded"), (1, 5, "direct"),
    (1, 20, "direct"), (1, 20, "bounded"),
    (2, 20, "bounded"), (2, 20, "direct"), (2, 5, "direct"), (2, 5, "bounded"),
    (2, 2, "bounded"), (2, 2, "direct"),
    (3, 5, "bounded"), (3, 5, "direct"), (3, 2, "direct"), (3, 2, "bounded"),
    (3, 20, "bounded"), (3, 20, "direct"),
]


def validate_matrix(matrix) -> None:
    expected = {(repeat, clients, mode) for repeat in (1, 2, 3) for clients in (2, 5, 20)
                for mode in ("direct", "bounded")}
    if len(matrix) != 18 or set(matrix) != expected:
        raise ValueError("The official matrix must contain every planned cell exactly once.")
    if Counter(clients for _, clients, _ in matrix) != {2: 6, 5: 6, 20: 6}:
        raise ValueError("Unbalanced Client counts.")


def runtime_pins() -> dict:
    paths = [ROOT / "client/scripts/benchmark-stomp.mjs", ROOT / "client/scripts/lib/x01-benchmark.mjs",
             ROOT / "client/scripts/lib/load-ui-module.mjs", ROOT / "client/package.json",
             ROOT / "client/package-lock.json", ROOT / "scripts/prepare_x01_test_database.py",
             ROOT / "scripts/run_x01_benchmark.py", ROOT / "scripts/sample_x01_process.ps1", Path(__file__)]
    paths += list((ROOT / "client/src/types").rglob("*.ts"))
    return {str(path.resolve().relative_to(ROOT)).replace("\\", "/"): file_digest(path) for path in sorted(paths)}


def atomic_json(path: Path, value) -> None:
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", type=Path, default=Path(r"C:\Program Files\PostgreSQL\18\bin"))
    args = parser.parse_args()
    matrix = None
    folder = None
    try:
        validate_matrix(MATRIX)
        if not os.getenv("PGPASSWORD"):
            raise ValueError("PGPASSWORD must be supplied in the process environment.")
        gate = load_json(GENERATED / "x01_ready_for_matrix.json")
        target = load_json(POINTER)
        backend = load_json(BACKEND_POINTER)
        if (gate["status"] != "READY_FOR_X01_4" or gate["database"] != target["database"]
                or gate["jarSha256"] != backend["jarSha256"]):
            raise ValueError("Pilot gate does not match this TEST and Backend binary.")
        pointer = GENERATED / "x01_official_matrix_target.json"
        if pointer.exists():
            raise ValueError("An official matrix is already registered. Inspect its state; no automatic restart.")
        verify_backend(backend)
        baseline = verify_database(target, args.pg_bin)
        check_port()
        pins = runtime_pins()
        toolchain = runner_toolchain()
        stamp = datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S_%f")
        folder = GENERATED / ("x01_matrix_" + stamp)
        folder.mkdir(exist_ok=False)
        matrix = {"task": "X01.4", "status": "RUNNING", "startedAt": datetime.now(VIETNAM).isoformat(),
                  "database": target["database"], "jarSha256": backend["jarSha256"],
                  "databaseBaseline": baseline, "runnerPins": pins, "toolchain": toolchain,
                  "gitAtStart": git_metadata(), "platform": platform.platform(), "cpuIdentifier": platform.processor(),
                  "logicalProcessors": os.cpu_count(), "pythonVersion": platform.python_version(),
                  "launchOrder": [{"repeat": r, "clients": c, "mode": m} for r, c, m in MATRIX],
                  "expectedRuns": 18, "completedRuns": 0, "runs": [], "currentRun": None,
                  "cooldownSeconds": 5, "automaticRunRetry": False, "warmupMs": 10000, "durationMs": 60000,
                  "evidenceDirectory": str(folder.relative_to(ROOT)).replace("\\", "/")}
        atomic_json(folder / "matrix_progress.json", matrix)
        atomic_json(pointer, {"task": "X01.4", "status": "RUNNING", "evidenceDirectory": matrix["evidenceDirectory"]})
        print("Official X01 matrix: " + str(folder), flush=True)
        for index, (repeat, clients, mode) in enumerate(MATRIX, start=1):
            if runtime_pins() != pins or runner_toolchain() != toolchain:
                raise ValueError("Runner/toolchain changed during the matrix.")
            matrix["currentRun"] = {"index": index, "repeat": repeat, "clients": clients, "mode": mode,
                                    "startedAt": datetime.now(VIETNAM).isoformat()}
            atomic_json(folder / "matrix_progress.json", matrix)
            print(f"START {index}/18: repeat={repeat} clients={clients} mode={mode}", flush=True)
            result = one_run(SimpleNamespace(action="measure", repeat=repeat, pg_bin=args.pg_bin),
                             target, backend, clients, mode, folder)
            matrix["runs"].append(result)
            matrix["completedRuns"] = len(matrix["runs"])
            matrix["currentRun"] = None
            atomic_json(folder / "matrix_progress.json", matrix)
            metrics = result["summary"]["metrics"]
            print(f"DONE {index}/18: completed={metrics['completed']} p95ms={metrics['p95LatencyMs']:.3f} "
                  f"throughput={metrics['throughputPerSecond']:.3f} errors={metrics['errors']}", flush=True)
            if index < len(MATRIX):
                # Owned Java and its sampler have exited; fixed idle gap before the next fresh JVM.
                time.sleep(5)
        if runtime_pins() != pins or runner_toolchain() != toolchain:
            raise ValueError("Runner/toolchain changed at matrix completion.")
        if verify_database(target, args.pg_bin) != baseline:
            raise ValueError("Final database differs from the starting snapshot.")
        verify_backend(backend)
        check_port()
        matrix.update(status="MEASUREMENTS_COMPLETE", endedAt=datetime.now(VIETNAM).isoformat(),
                      benchmarkMatrixComplete=True, finalDatabaseUnchanged=True, allOwnedServersStopped=True,
                      independentRawAuditPending=True)
        atomic_json(folder / "matrix_progress.json", matrix)
        atomic_json(folder / "matrix_results.json", matrix)
        atomic_json(pointer, {"task": "X01.4", "status": matrix["status"], "evidenceDirectory": matrix["evidenceDirectory"]})
        print(json.dumps({"status": matrix["status"], "completedRuns": 18, "evidence": str(folder)}), flush=True)
        return 0
    except Exception as error:
        if matrix is not None and folder is not None:
            matrix.update(status="FAILED", error=safe_error(str(error)), endedAt=datetime.now(VIETNAM).isoformat())
            atomic_json(folder / "matrix_progress.json", matrix)
            atomic_json(folder / "matrix_failure.json", matrix)
            atomic_json(GENERATED / "x01_official_matrix_target.json",
                        {"task": "X01.4", "status": "FAILED", "evidenceDirectory": matrix["evidenceDirectory"]})
        print("X01 matrix failed; no retry: " + safe_error(str(error)), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
