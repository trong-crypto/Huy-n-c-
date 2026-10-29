"""X01.5 real STOMP tests, same pinned JAR and isolated benchmark TEST. No row mutations.

Controlled contention holds ONLY public.hexagrams in a short transaction in the
benchmark database. A 4-second idle-in-transaction watchdog releases locks on a
crash. No product code, migration, original benchmark artifacts or UI is changed.
PGPASSWORD must be supplied privately through the environment.
"""
from __future__ import annotations
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
import uuid

from run_x01_benchmark import (ROOT, GENERATED, POINTER, BACKEND_POINTER, VIETNAM,
    load_json, verify_backend, verify_database, validate_target, server_command,
    sanitized_child_environment, runner_toolchain, check_port, ready, file_digest,
    safe_error, write_new_json)
from prepare_x01_test_database import run as pg_run


def reliability_command(target, backend, suite):
    if suite not in ("idempotency", "overload"):
        raise ValueError("Unknown reliability suite")
    command = server_command(target, backend, "bounded")
    if suite == "overload":
        command = ["--huyenco.calculation-workers=2" if arg.startswith("--huyenco.calculation-workers=")
                   else "--huyenco.calculation-queue-capacity=4" if arg.startswith("--huyenco.calculation-queue-capacity=")
                   else arg for arg in command]
    return command


LOCK_SQL = ("BEGIN; SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='3s'; "
            "SET LOCAL idle_in_transaction_session_timeout='4s'; "
            "LOCK TABLE public.hexagrams IN ACCESS EXCLUSIVE MODE;\n")


class ContentionGate:
    def __init__(self, target, pg_bin, folder):
        validate_target(target)
        self.target, self.folder = target, folder
        self.connection = [str(pg_bin / "psql.exe"), "-w", "-h", "127.0.0.1", "-p", "5432", "-U", target["username"],
                           "-d", target["database"], "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
        self.process = None
        self.label = "x01-gate-" + uuid.uuid4().hex
        self.pid = None
        self.operations = []

    def query(self, sql):
        return json.loads(pg_run(self.connection, timeout=4,
            input_text="BEGIN READ ONLY; SET LOCAL statement_timeout='1s'; " + sql + " COMMIT;"))

    def status(self):
        return self.query("SELECT json_build_object('database',current_database(),'locks',coalesce((SELECT json_agg(t) FROM "
            "(SELECT a.pid,l.granted,l.mode FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid "
            f"WHERE a.datname=current_database() AND a.application_name='{self.label}' "
            "AND l.relation='public.hexagrams'::regclass AND l.mode='AccessExclusiveLock')t),'[]'),"
            "'blocked',coalesce((SELECT json_agg(t) FROM (SELECT a.pid,a.wait_event_type,a.wait_event "
            "FROM pg_stat_activity a WHERE a.datname=current_database() AND EXISTS(SELECT 1 FROM pg_stat_activity g "
            f"WHERE g.application_name='{self.label}' AND g.pid=ANY(pg_blocking_pids(a.pid))))t),'[]'));")

    def action(self, action):
        started = time.monotonic()
        if action == "hold_lock":
            if self.process is not None:
                raise ValueError("Contention gate already active")
            env = dict(os.environ, PGAPPNAME=self.label, PGCONNECT_TIMEOUT="2", PGCLIENTENCODING="UTF8")
            self.process = subprocess.Popen(self.connection, cwd=ROOT, env=env, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            self.process.stdin.write(LOCK_SQL); self.process.stdin.flush()
            while True:
                result = self.status()
                if len(result["locks"]) == 1 and result["locks"][0]["granted"]:
                    self.pid = result["locks"][0]["pid"]
                    break
                if self.process.poll() is not None or time.monotonic() - started > 2:
                    raise RuntimeError("Failed to acquire bounded TEST-only lock")
                time.sleep(0.02)
        elif action in ("wait_blocked_one", "wait_blocked_two"):
            count = 1 if action.endswith("one") else 2
            if self.process is None or self.process.poll() is not None:
                raise ValueError("No active gate")
            while True:
                result = self.status()
                if len(result["blocked"]) >= count:
                    break
                if time.monotonic() - started > 1.5:
                    raise RuntimeError("Expected database waiters not observed before gate deadline")
                time.sleep(0.02)
        elif action == "release_lock":
            released = self.process is not None
            if self.process is not None:
                process = self.process
                try:
                    output, errors = process.communicate("ROLLBACK;\n\\q\n", timeout=3)
                    if process.returncode:
                        raise RuntimeError("TEST gate watchdog fired or rollback failed: " + safe_error(errors[-500:]))
                finally:
                    if process.poll() is None:
                        process.kill(); process.wait(timeout=3)
                    self.process = None
            result = self.status()
            if result["locks"] or result["blocked"]:
                raise RuntimeError("Gate lock/waiter still present after rollback")
            result["released"] = released
        else:
            raise ValueError("Unknown control action; arbitrary SQL is not supported")
        result["elapsedMs"] = (time.monotonic() - started) * 1000
        self.operations.append({"action": action, "at": datetime.now(VIETNAM).isoformat(), "result": result})
        return result

    def close(self):
        self.action("release_lock")


def run_suite(suite, target, backend, pg_bin, folder):
    verify_backend(backend)
    before = verify_database(target, pg_bin)
    check_port()
    folder.mkdir(exist_ok=False)
    write_new_json(folder / "database_before.json", before)
    command = reliability_command(target, backend, suite)
    toolchain = runner_toolchain()
    env = sanitized_child_environment()
    env.update(DB_USERNAME=target["username"], DB_PASSWORD=os.environ["PGPASSWORD"], DB_URL=target["jdbcUrl"], SPRING_FLYWAY_ENABLED="false")
    report = {"task": "X01.5", "suite": suite, "passed": False, "database": target["database"],
              "jarSha256": backend["jarSha256"], "command": command, "runnerToolchain": toolchain,
              "startedAt": datetime.now(VIETNAM).isoformat(), "temporaryServerStopped": False,
              "controlledContention": {"table": "public.hexagrams", "sql": LOCK_SQL, "dataMutations": False,
                                      "watchdogSeconds": 4, "performanceBenchmark": False}}
    process, node, timer = None, None, None
    gate = ContentionGate(target, pg_bin, folder)
    with (folder / "server.log").open("wb") as server_log, (folder / "runner-stderr.log").open("wb") as errlog:
        try:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=server_log, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            report["ownedJavaPid"] = process.pid
            deadline = time.monotonic() + 45
            while True:
                if process.poll() is not None:
                    raise RuntimeError("Owned backend exited during startup")
                try:
                    report["beforeReadiness"] = ready(target); break
                except OSError:
                    if time.monotonic() > deadline: raise RuntimeError("Backend readiness timeout")
                    time.sleep(0.25)
            print(f"X01.5 {suite}: same pinned JAR, dedicated TEST, owned Java PID {process.pid}", flush=True)
            node = subprocess.Popen([toolchain["nodeExecutable"], str(ROOT / "client/scripts/x01-reliability.mjs"),
                "--suite", suite, "--target", str(POINTER), "--output", str(folder / "runner")],
                cwd=ROOT / "client", env=sanitized_child_environment(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=errlog, text=True, encoding="utf-8", creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            report["ownedNodePid"] = node.pid
            timer = threading.Timer(160, node.kill); timer.start()
            with (folder / "control-transcript.jsonl").open("x", encoding="utf-8") as transcript:
                for line in node.stdout:
                    message = json.loads(line)
                    transcript.write(json.dumps({"at": datetime.now(VIETNAM).isoformat(), "from": "runner", **message}) + "\n"); transcript.flush()
                    if "rpcId" in message:
                        try: reply = {"rpcId": message["rpcId"], "result": gate.action(message["action"])}
                        except Exception as error: reply = {"rpcId": message["rpcId"], "error": safe_error(str(error))}
                        transcript.write(json.dumps({"from": "controller", **reply}) + "\n"); transcript.flush()
                        node.stdin.write(json.dumps(reply) + "\n"); node.stdin.flush()
                    else:
                        print(json.dumps(message, ensure_ascii=False), flush=True)
            node.wait(timeout=5)
            report["runnerSummary"] = load_json(folder / "runner/summary.json")
            if node.returncode or not report["runnerSummary"]["passed"]:
                raise RuntimeError("Reliability runner failed; all original evidence retained")
            report["afterReadiness"] = ready(target)
            if runner_toolchain() != toolchain: raise ValueError("Toolchain changed")
            verify_backend(backend)
            report["passed"] = True
        except Exception as error:
            report["error"] = safe_error(str(error))
        finally:
            if timer: timer.cancel()
            if node is not None and node.poll() is None:
                node.terminate(); node.wait(timeout=5)
            report["temporaryRunnerStopped"] = node is not None and node.poll() is not None
            try:
                gate.close(); report["contentionLocksReleased"] = True
            except Exception as error:
                report["passed"] = False; report["lockCleanupError"] = safe_error(str(error))
            write_new_json(folder / "gate_operations.json", gate.operations)
            if process is not None:
                if process.poll() is None:
                    process.terminate()
                    try: process.wait(timeout=10)
                    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)
                report["temporaryServerStopped"] = process.poll() is not None
            try:
                after = verify_database(target, pg_bin)
                write_new_json(folder / "database_after.json", after)
                report["databaseUnchanged"] = before == after
            except Exception as error:
                report["passed"] = False; report["databaseError"] = safe_error(str(error))
            report["endedAt"] = datetime.now(VIETNAM).isoformat()
            write_new_json(folder / "environment.json", report)
    if not report["passed"]: raise RuntimeError(f"Suite failed: {folder}; {report.get('error', report.get('lockCleanupError', report.get('databaseError')))}")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=("all", "idempotency", "overload"), default="all")
    parser.add_argument("--pg-bin", type=Path, default=Path(r"C:\Program Files\PostgreSQL\18\bin"))
    args = parser.parse_args()
    if not os.getenv("PGPASSWORD"): raise ValueError("PGPASSWORD required; never put it in a source file")
    target, backend = load_json(POINTER), load_json(BACKEND_POINTER)
    verify_backend(backend); verify_database(target, args.pg_bin); check_port()
    root = GENERATED / ("x01_reliability_" + datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S_%f"))
    root.mkdir(exist_ok=False)
    sources = ["scripts/run_x01_reliability.py", "client/scripts/x01-reliability.mjs", "scripts/run_x01_benchmark.py",
               "scripts/prepare_x01_test_database.py", "client/scripts/lib/x01-benchmark.mjs", "client/scripts/lib/load-ui-module.mjs",
               "client/src/types/contractValidation.ts", "client/src/types/contract.ts", "client/package.json", "client/package-lock.json"]
    pins = {name: file_digest(ROOT / name) for name in sources}
    for name in sources:
        destination = root / "source_snapshot" / name
        destination.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(ROOT / name, destination)
    write_new_json(root / "source_pins.json", pins)
    write_new_json(root / "target.json", target)
    write_new_json(root / "backend_manifest.json", backend)
    report = {"task": "X01.5", "status": "RUNNING", "startedAt": datetime.now(VIETNAM).isoformat(), "suites": []}
    try:
        for suite in (("idempotency", "overload") if args.suite == "all" else (args.suite,)):
            report["suites"].append(run_suite(suite, target, backend, args.pg_bin, root / suite))
        if any(file_digest(ROOT / name) != sha for name, sha in pins.items()): raise ValueError("Runner sources changed during reliability tests")
        report["status"] = "MEASUREMENTS_COMPLETE_PENDING_INDEPENDENT_AUDIT"
    except Exception as error:
        report["status"] = "FAILED"; report["error"] = safe_error(str(error))
    finally:
        report["endedAt"] = datetime.now(VIETNAM).isoformat()
        write_new_json(root / "results.json", report)
        print(json.dumps({"status": report["status"], "evidence": str(root.relative_to(ROOT)), "error": report.get("error")}), flush=True)
    return 0 if report["status"] != "FAILED" else 1


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(safe_error(str(error)), flush=True); raise SystemExit(1)
