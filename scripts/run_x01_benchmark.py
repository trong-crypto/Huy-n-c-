"""X01 local orchestration: pin a JDK17/database-profile JAR, verify TEST, own/stop only our Java process.

PGPASSWORD is supplied through the environment. No migration, session/history
mutation, production database access, global Java changes, or automatic retries.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
import zipfile

from prepare_x01_test_database import (ROOT, GENERATED, POINTER, VIETNAM, snapshot,
                                      file_digest, safe_error, validate_database_name, write_new_json)

BACKEND_POINTER = GENERATED / "x01_backend_target.json"
SETTINGS = {"calculation-workers": 4, "calculation-queue-capacity": 100,
            "processing-timeout-ms": 10000, "idempotency-ttl-seconds": 60,
            "idempotency-max-entries": 10000, "max-calculation-sessions": 1024,
            "max-active-calculations": 1000, "max-active-per-session": 16}
JVM_FLAGS = ["-Xms256m", "-Xmx512m"]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def generated_path(value: str) -> Path:
    path = (ROOT / value).resolve()
    if not path.is_relative_to(GENERATED.resolve()):
        raise ValueError("Evidence path must stay inside scripts/generated.")
    return path


def validate_target(target: dict) -> None:
    name = validate_database_name(target["database"], source=False)
    if (target["host"] != "127.0.0.1" or target["port"] != 5432
            or target["jdbcUrl"] != f"jdbc:postgresql://127.0.0.1:5432/{name}"
            or target["schemaVersion"] != 12 or target["flywayEnabled"] is not False
            or target["backendHttpUrl"] != "http://127.0.0.1:18091"
            or target["webSocketUrl"] != "ws://127.0.0.1:18091/ws"
            or target["origin"] != "http://127.0.0.1:3173"):
        raise ValueError("Target does not match the pinned local benchmark TEST scope.")


def verify_database(target: dict, pg_bin: Path) -> dict:
    validate_target(target)
    baseline = load_json(generated_path(target["evidenceDirectory"]) / "target_baseline.json")
    actual = snapshot(target["database"], pg_bin / "psql.exe",
                      ["-w", "-h", target["host"], "-p", str(target["port"]), "-U", target["username"]])
    if (actual != baseline or actual["knowledgeSha256"] != target["knowledgeSha256"]
            or actual["schemaSha256"] != target["schemaSha256"]
            or actual["runtimeCounts"] != {"anonymous_sessions": 0, "interpretation_history": 0}):
        raise ValueError("TEST differs from X01.1 baseline; refusing to start or approve a run.")
    return actual


def source_files() -> list[Path]:
    server = ROOT / "server"
    return sorted([server / "pom.xml", server / "mvnw", server / "mvnw.cmd",
                   ROOT / "data/m01_reviewed_readings.json"]
                  + [p for folder in (server / "src", server / ".mvn") for p in folder.rglob("*") if p.is_file()])


def source_hashes() -> dict:
    return {str(p.relative_to(ROOT)).replace("\\", "/"): file_digest(p) for p in source_files()}


def sanitized_child_environment() -> dict:
    env = dict(os.environ)
    for key in list(env):
        if (key.startswith(("DB_", "HUYENCO_TEST_", "HUYENCO_M02_", "SPRING_"))
                or key in {"PGPASSWORD", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "MAVEN_OPTS", "MAVEN_ARGS"}):
            env.pop(key, None)
    return env


def git_metadata() -> dict:
    def git(*args):
        result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
        return result.stdout.strip()
    return {"commit": git("rev-parse", "HEAD"), "workingTree": git("status", "--short").splitlines()}


def runner_toolchain() -> dict:
    node = shutil.which("node")
    if not node:
        raise ValueError("Node.js is unavailable.")
    version = subprocess.run([node, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    packages = {}
    for name in ("@stomp/stompjs", "ws", "typescript"):
        path = ROOT / "client/node_modules" / name / "package.json"
        packages[name] = {"version": load_json(path)["version"], "manifestSha256": file_digest(path)}
    return {"nodeExecutable": node, "nodeVersion": version, "nodeExecutableSha256": file_digest(Path(node)),
            "packages": packages, "packageLockSha256": file_digest(ROOT / "client/package-lock.json")}


def verify_backend(backend: dict) -> Path:
    jar = generated_path(backend["jar"])
    if file_digest(jar) != backend["jarSha256"]:
        raise ValueError("Pinned JAR changed.")
    if source_hashes() != backend["sourceHashes"]:
        raise ValueError("Backend sources changed; explicitly prepare again with --rebuild.")
    if JVM_FLAGS != backend["jvmFlags"] or SETTINGS != backend["settings"]:
        raise ValueError("Pinned launch settings changed; prepare again with --rebuild.")
    java = Path(backend["javaExecutable"])
    if file_digest(java) != backend["javaExecutableSha256"]:
        raise ValueError("Pinned Java executable changed.")
    return jar


def prepare_backend(java_home: Path, rebuild: bool) -> dict:
    if BACKEND_POINTER.exists() and not rebuild:
        backend = load_json(BACKEND_POINTER)
        verify_backend(backend)
        print("Reusing verified pinned Backend JAR.", flush=True)
        return backend
    java = java_home / "bin/java.exe"
    version = subprocess.run([str(java), "-version"], capture_output=True, text=True, check=True)
    java_version = version.stderr.strip()
    if not java_version.startswith('java version "17.') and not java_version.startswith('openjdk version "17.'):
        raise ValueError("Benchmark build/runtime must use JDK 17.")
    stamp = datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S_%f")
    work = ROOT / "work" / ("x01_build_" + stamp)
    artifact = GENERATED / ("x01_backend_" + stamp)
    artifact.mkdir(parents=True, exist_ok=False)
    work.mkdir(parents=True, exist_ok=False)
    pins = source_hashes()
    for source in source_files():
        destination = work / source.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    if any(file_digest(work / relative) != sha for relative, sha in pins.items()):
        raise ValueError("Isolated build input copy differs from source pins.")
    env = sanitized_child_environment()
    env.update(JAVA_HOME=str(java_home), MAVEN_SKIP_RC="1")
    env["PATH"] = str(java_home / "bin") + os.pathsep + env.get("PATH", "")
    print("Building once in isolated work directory with JDK17/database profile; tests skipped at package step.", flush=True)
    with (artifact / "build.log").open("wb") as log:
        result = subprocess.run([str(work / "server/mvnw.cmd"), "-o", "-B", "-Pdatabase", "-DskipTests", "package"],
                                cwd=work / "server", env=env, stdout=log, stderr=subprocess.STDOUT,
                                timeout=240, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    if result.returncode:
        raise RuntimeError(f"Backend build failed; inspect {artifact / 'build.log'}")
    if source_hashes() != pins:
        raise ValueError("Backend source changed while building.")
    jar = artifact / "huyen-co-server.jar"
    shutil.copy2(work / "server/target/huyen-co-server-0.1.0-SNAPSHOT.jar", jar)
    with zipfile.ZipFile(jar) as package:
        if not any(name.startswith("BOOT-INF/lib/postgresql-") for name in package.namelist()):
            raise ValueError("Built JAR does not contain the database profile dependencies.")
    backend = {"task": "X01.2", "status": "BINARY_PINNED", "createdAt": datetime.now(VIETNAM).isoformat(),
               "jar": str(jar.relative_to(ROOT)).replace("\\", "/"), "jarSha256": file_digest(jar),
               "javaExecutable": str(java), "javaExecutableSha256": file_digest(java), "javaVersion": java_version,
               "jvmFlags": JVM_FLAGS, "settings": SETTINGS, "sourceHashes": pins,
               "git": git_metadata(), "mavenProfile": "database", "testsSkippedDuringPackage": True,
               "isolatedBuildDirectory": str(work.relative_to(ROOT)).replace("\\", "/"),
               "existingUiBackendModified": False}
    write_new_json(artifact / "backend_manifest.json", backend)
    # Only the local tool-owned binary pointer changes, never the database target pointer.
    temp = BACKEND_POINTER.with_suffix(".tmp")
    temp.write_text(json.dumps(backend, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, BACKEND_POINTER)
    return backend


def check_port() -> None:
    with socket.socket() as probe:
        if os.name == "nt":
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        probe.bind(("127.0.0.1", 18091))


def server_command(target: dict, backend: dict, mode: str) -> list[str]:
    validate_target(target)
    if mode not in ("direct", "bounded"):
        raise ValueError("Invalid calculation mode.")
    return [backend["javaExecutable"], *backend["jvmFlags"], "-jar", str(generated_path(backend["jar"])),
            "--spring.profiles.active=db", "--server.address=127.0.0.1", "--server.port=18091",
            "--spring.flyway.enabled=false", "--spring.datasource.hikari.read-only=true",
            "--spring.datasource.hikari.maximum-pool-size=8", "--spring.datasource.url=" + target["jdbcUrl"],
            "--huyenco.allowed-origins=" + target["origin"], "--huyenco.calculation-mode=" + mode,
            *[f"--huyenco.{key}={value}" for key, value in backend["settings"].items()]]


def http_json(url: str) -> dict:
    with urlopen(url, timeout=2) as response:
        if response.status != 200:
            raise RuntimeError("Backend health/readiness is not HTTP 200.")
        return json.load(response)


def ready(target: dict) -> dict:
    result = {"health": http_json(target["backendHttpUrl"] + "/api/v1/health"),
              "readiness": http_json(target["backendHttpUrl"] + "/api/v1/readiness")}
    if result["health"]["status"] != "UP" or result["readiness"]["status"] != "READY":
        raise RuntimeError("Backend is not ready.")
    return result


def one_run(args, target: dict, backend: dict, clients: int, mode: str, root: Path) -> dict:
    verify_backend(backend)
    before = verify_database(target, args.pg_bin)
    check_port()  # Never attach to or kill somebody else's listener.
    kind = "benchmark" if args.action == "measure" else args.action
    warmup, duration = {"preflight": (1, 1), "pilot": (2, 5), "benchmark": (10, 60)}[kind]
    folder = root / f"{kind}-{clients}-{mode}-r{args.repeat}"
    folder.mkdir(exist_ok=False)
    write_new_json(folder / "database_before.json", before)
    command = server_command(target, backend, mode)
    toolchain = runner_toolchain()
    env = sanitized_child_environment()
    env.update(DB_USERNAME=target["username"], DB_PASSWORD=os.environ["PGPASSWORD"],
               DB_URL=target["jdbcUrl"], SPRING_FLYWAY_ENABLED="false")
    run = {"kind": kind, "clients": clients, "mode": mode, "repeat": args.repeat, "passed": False,
           "database": target["database"], "jarSha256": backend["jarSha256"], "command": command,
           "runnerToolchain": toolchain,
           "sourceHashes": {str(path.relative_to(ROOT)).replace("\\", "/"): file_digest(path) for path in (
               ROOT / "client/scripts/benchmark-stomp.mjs", ROOT / "client/scripts/lib/x01-benchmark.mjs",
               ROOT / "scripts/run_x01_benchmark.py", ROOT / "scripts/sample_x01_process.ps1")}, "git": git_metadata(),
           "startedAt": datetime.now(VIETNAM).isoformat(), "temporaryServerStopped": False}
    process = None
    sampler = None
    with (folder / "server.log").open("wb") as log, (folder / "sampler.log").open("wb") as sampler_log:
        try:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            run["ownedJavaPid"] = process.pid
            sampler = subprocess.Popen(["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                                        "-File", str(ROOT / "scripts/sample_x01_process.ps1"),
                                        "-BenchmarkProcessId", str(process.pid), "-OutputFile", str(folder / "server-resources.csv")],
                                       cwd=ROOT, env=sanitized_child_environment(), stdout=sampler_log, stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            deadline = time.monotonic() + 45
            while True:
                if process.poll() is not None:
                    raise RuntimeError("Owned Backend exited during startup; inspect server.log.")
                try:
                    run["beforeReadiness"] = ready(target)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Owned Backend readiness timeout.")
                    time.sleep(0.25)
            print(f"{kind}: {clients} clients, {mode}, JAR {backend['jarSha256'][:12]}", flush=True)
            node = [toolchain["nodeExecutable"], str(ROOT / "client/scripts/benchmark-stomp.mjs"), "--clients", str(clients),
                    "--mode", mode, "--kind", kind, "--repeat", str(args.repeat),
                    "--warmup-seconds", str(warmup), "--duration-seconds", str(duration),
                    "--output", str(folder / "runner"), "--target", str(POINTER)]
            with (folder / "runner.log").open("wb") as output:
                result = subprocess.run(node, cwd=ROOT / "client", env=sanitized_child_environment(),
                                        stdout=output, stderr=subprocess.STDOUT, timeout=warmup + duration + 50)
            summary_file = folder / "runner/summary.json"
            if summary_file.exists():
                run["runnerSummary"] = load_json(summary_file)
            run["afterReadiness"] = ready(target)
            if runner_toolchain() != toolchain:
                raise ValueError("Runner toolchain changed during the run.")
            if result.returncode or not run.get("runnerSummary", {}).get("passed"):
                raise RuntimeError("Runner validation failed; inspect runner.log/raw/events.")
            run["passed"] = True
        except Exception as error:
            run["error"] = safe_error(str(error))
        finally:
            if process is not None:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=10)
                run["temporaryServerStopped"] = process.poll() is not None
            if sampler is not None:
                try:
                    sampler.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    sampler.terminate()
                    sampler.wait(timeout=3)
                run["samplerExitCode"] = sampler.returncode
                run["serverResourcesAvailable"] = (folder / "server-resources.csv").exists()
                run["resourceSampling"] = "Get-Process every 1s: cumulative CPU seconds, working set, OS thread count; not JVM managed thread count"
            try:
                after = verify_database(target, args.pg_bin)
                write_new_json(folder / "database_after.json", after)
                run["databaseUnchanged"] = before == after
                if not run["databaseUnchanged"]:
                    raise ValueError("Database changed during the run.")
            except Exception as error:
                run["passed"] = False
                run["databaseError"] = safe_error(str(error))
            run["endedAt"] = datetime.now(VIETNAM).isoformat()
            write_new_json(folder / "environment.json", run)
    if not run["passed"]:
        raise RuntimeError(f"Run failed; evidence retained in {folder}")
    return {"clients": clients, "mode": mode, "passed": True, "databaseUnchanged": run["databaseUnchanged"],
            "temporaryServerStopped": run["temporaryServerStopped"], "folder": str(folder.relative_to(ROOT)),
            "summary": run["runnerSummary"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--action", choices=("prepare", "preflight", "pilot", "measure"), default="prepare")
    parser.add_argument("--clients", nargs="+", type=int, choices=(2, 5, 20), default=[2])
    parser.add_argument("--mode", choices=("direct", "bounded", "both"), default="both")
    parser.add_argument("--repeat", type=int, choices=(1, 2, 3), default=1)
    parser.add_argument("--java-home", type=Path, default=Path(r"C:\Program Files\Java\jdk-17"))
    parser.add_argument("--pg-bin", type=Path, default=Path(r"C:\Program Files\PostgreSQL\18\bin"))
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()
    try:
        if not os.getenv("PGPASSWORD"):
            raise ValueError("PGPASSWORD is required in the environment. Use the PowerShell wrapper to prompt privately.")
        target = load_json(POINTER)
        verify_database(target, args.pg_bin)
        if args.action == "prepare":
            backend = prepare_backend(args.java_home, args.rebuild)
            print(json.dumps({"status": backend["status"], "jarSha256": backend["jarSha256"],
                              "database": target["database"], "backendStarted": False}))
            return 0
        backend = load_json(BACKEND_POINTER)
        modes = ("direct", "bounded") if args.mode == "both" else (args.mode,)
        if len(set(args.clients)) != len(args.clients):
            raise ValueError("Duplicate Client counts are not allowed.")
        if args.action == "measure" and (len(args.clients) != 1 or len(modes) != 1):
            raise ValueError("Measure one matrix cell at a time; preserve the order and repeats in plan 47.")
        stamp = datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S_%f")
        folder = GENERATED / ("x01_" + args.action + "_" + stamp)
        folder.mkdir(exist_ok=False)
        results = []
        try:
            for clients in args.clients:
                for mode in modes:
                    results.append(one_run(args, target, backend, clients, mode, folder))
        finally:
            write_new_json(folder / "runs.json", {"action": args.action, "benchmarkMatrixComplete": False,
                           "runs": results, "expectedRuns": len(args.clients) * len(modes),
                           "passed": len(results) == len(args.clients) * len(modes)})
        print(json.dumps({"action": args.action, "runs": len(results), "passed": True, "evidence": str(folder)}))
        return 0
    except (OSError, KeyError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print("X01: " + safe_error(str(error)), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
