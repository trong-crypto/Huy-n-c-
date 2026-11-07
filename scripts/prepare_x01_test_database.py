"""Pin an isolated X01 TEST database from the existing acceptance TEST.

Requires PGPASSWORD in the process environment. Never migrates, imports, deletes,
or writes to the source database. Existing databases and target manifests are
never overwritten. Session/history rows are excluded from the archive.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "scripts/generated"
POINTER = GENERATED / "x01_benchmark_target.json"
RUNTIME_TABLES = {"anonymous_sessions", "interpretation_history"}
VIETNAM = timezone(timedelta(hours=7))


def validate_database_name(name: str, *, source: bool) -> str:
    prefix = "huyenco_acceptance_test_" if source else "huyenco_benchmark_test_"
    if not re.fullmatch(re.escape(prefix) + r"\d{8}_\d{6}", name):
        raise ValueError("Database must use the explicit acceptance TEST or benchmark TEST naming pattern.")
    datetime.strptime(name[len(prefix):], "%Y%m%d_%H%M%S")
    return name


def digest(value) -> str:
    text = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def file_digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_new_json(path: Path, value) -> None:
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write("\n")


def safe_error(message: str) -> str:
    secret = os.getenv("PGPASSWORD")
    return message.replace(secret, "[REDACTED]") if secret else message


def run(args: list, *, timeout=120, input_text=None) -> str:
    result = subprocess.run([str(arg) for arg in args], cwd=ROOT,
                            env=dict(os.environ, PGCLIENTENCODING="UTF8", PGCONNECT_TIMEOUT="5"),
                            input=input_text, capture_output=True, text=True, encoding="utf-8",
                            errors="replace", timeout=timeout)
    if result.returncode:
        raise RuntimeError(safe_error(result.stderr.strip()[-2000:]) or "Command failed.")
    return result.stdout.strip()


def snapshot(database: str, psql: Path, connection: list) -> dict:
    def query(statement: str):
        return json.loads(run([psql, *connection, "-X", "-q", "-A", "-t", "-d", database,
                               "-v", "ON_ERROR_STOP=1"], input_text=statement))

    tables = query("SELECT coalesce(jsonb_agg(tablename ORDER BY tablename),'[]') "
                   "FROM pg_tables WHERE schemaname='public';")
    required = RUNTIME_TABLES | {"flyway_schema_history", "hexagrams", "hexagram_lines",
                                "reading_source_bundles", "mai_hoa_reading_templates",
                                "tam_the_supplement_results", "tam_the_supplement_mappings"}
    if not required.issubset(tables) or any(not re.fullmatch(r"[a-z][a-z0-9_]*", t) for t in tables):
        raise ValueError("Unexpected or incomplete public schema.")
    knowledge = sorted(set(tables) - RUNTIME_TABLES)
    fields = []
    for table in knowledge:
        fields.append(f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.\"{table}\" t)")
    fields += [f"'{table}',(SELECT count(*) FROM public.\"{table}\")" for table in sorted(RUNTIME_TABLES)]
    fields += ["'_database',current_database()", "'_version',current_setting('server_version')",
               "'_columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM "
               "(SELECT table_name,ordinal_position,column_name,data_type,udt_name,is_nullable,column_default "
               "FROM information_schema.columns WHERE table_schema='public') c)",
               "'_constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,constraint_name) FROM "
               "(SELECT cl.relname AS table_name,co.conname AS constraint_name,"
               "pg_get_constraintdef(co.oid) AS definition,co.convalidated AS validated "
               "FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid "
               "JOIN pg_namespace ns ON ns.oid=co.connamespace WHERE ns.nspname='public') c)",
               "'_indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY tablename,indexname) FROM "
               "(SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public') i)"]
    actual = query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; "
                   "SET LOCAL statement_timeout='30s'; SELECT jsonb_build_object("
                   + ",".join(fields) + "); COMMIT;")
    migrations = actual["flyway_schema_history"]
    versions = {str(row["version"]) for row in migrations if row["version"] is not None}
    if (actual["_database"] != database or versions != {str(i) for i in range(1, 13)}
            or not all(row["success"] for row in migrations)):
        raise ValueError("Wrong database identity or schema is not exactly successful V1-V12.")
    if not all(row["validated"] for row in actual["_constraints"]):
        raise ValueError("Unvalidated constraint detected.")
    fingerprints = {}
    for table in knowledge:
        rows = sorted(actual[table], key=lambda row: json.dumps(row, sort_keys=True, ensure_ascii=False))
        fingerprints[table] = {"count": len(rows), "sha256": digest(rows)}
    schema = {key: actual[key] for key in ("_columns", "_constraints", "_indexes")}
    return {"database": database, "serverVersion": actual["_version"], "schemaVersion": 12,
            "tables": fingerprints, "schemaSha256": digest(schema),
            "knowledgeSha256": digest(fingerprints),
            "runtimeCounts": {table: actual[table] for table in sorted(RUNTIME_TABLES)}}


def assert_clone_matches(source: dict, target: dict) -> None:
    if source["tables"] != target["tables"] or source["schemaSha256"] != target["schemaSha256"]:
        raise ValueError("Clone differs from source knowledge or schema.")
    if any(target["runtimeCounts"].values()):
        raise ValueError("Benchmark TEST must start with empty session and history tables.")


def prepare(args) -> dict:
    if not os.getenv("PGPASSWORD"):
        raise ValueError("PGPASSWORD must be supplied in the process environment, never a source file.")
    if args.host != "127.0.0.1":
        raise ValueError("This preparation workflow is restricted to local PostgreSQL.")
    if POINTER.exists():
        raise ValueError("An X01 target is already pinned. Inspect that manifest before preparing another database.")
    metadata = json.loads((GENERATED / "v12_demo_target.json").read_text(encoding="utf-8-sig"))
    source = validate_database_name(args.source or str(metadata["database"]), source=True)
    stamp = datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S")
    target = validate_database_name(args.target or "huyenco_benchmark_test_" + stamp, source=False)
    folder = GENERATED / ("x01_preparation_" + stamp)
    folder.mkdir(parents=True, exist_ok=False)
    psql = args.pg_bin / "psql.exe"
    connection = ["-w", "-h", args.host, "-p", str(args.port), "-U", args.user]
    report = {"task": "X01.1", "status": "IN_PROGRESS", "sourceDatabase": source,
              "database": target, "createdAt": datetime.now(VIETNAM).isoformat(),
              "databaseCreated": False, "manifestPublished": False}
    print(f"1/6: Read-only source validation: {source}", flush=True)
    try:
        exists = run([psql, *connection, "-X", "-q", "-A", "-t", "-d", "postgres", "-v",
                      "ON_ERROR_STOP=1", "-c", f"SELECT count(*) FROM pg_database WHERE datname='{target}';"])
        if exists != "0":
            raise ValueError("Target database already exists; it will not be modified.")
        baseline = snapshot(source, psql, connection)
        write_new_json(folder / "source_baseline.json", baseline)
        source_v12 = folder / "source_v12_audit.json"
        common_audit = ["--database", source, "--host", args.host, "--port", str(args.port),
                        "--user", args.user, "--psql", str(psql)]
        run([sys.executable, ROOT / "scripts/audit_v12_readings.py", *common_audit,
             "--output", source_v12], timeout=120)

        print("2/6: Archive source knowledge; exclude session/history rows.", flush=True)
        archive = folder / "knowledge_snapshot.dump"
        run([args.pg_bin / "pg_dump.exe", *connection, "-Fc", "--schema=public", "--no-owner",
             "--no-privileges", "--exclude-table-data=public.anonymous_sessions",
             "--exclude-table-data=public.interpretation_history", "-f", archive, "-d", source])
        toc = run([args.pg_bin / "pg_restore.exe", "--list", archive])
        (folder / "archive_toc.txt").write_text(toc + "\n", encoding="utf-8")

        print(f"3/6: Create and restore new isolated TEST: {target}", flush=True)
        run([args.pg_bin / "createdb.exe", *connection, "--template=template0", "--encoding=UTF8", target])
        report["databaseCreated"] = True
        # template0 already contains public; clean applies only to the database just created above.
        run([args.pg_bin / "pg_restore.exe", *connection, "--clean", "--if-exists", "--exit-on-error", "--single-transaction",
             "--no-owner", "--no-privileges", "-d", target, archive])

        print("4/6: Verify schema, all knowledge rows and empty runtime tables.", flush=True)
        cloned = snapshot(target, psql, connection)
        after = snapshot(source, psql, connection)
        assert_clone_matches(baseline, cloned)
        if baseline["tables"] != after["tables"] or baseline["schemaSha256"] != after["schemaSha256"]:
            raise ValueError("Source knowledge changed during preparation; target will not be published.")
        write_new_json(folder / "target_baseline.json", cloned)
        write_new_json(folder / "source_after.json", after)

        print("5/6: Audit baseline sources/PDFs and the pinned V12 readings.", flush=True)
        target_args = ["--database", target, "--host", args.host, "--port", str(args.port),
                       "--user", args.user, "--psql", str(psql)]
        audit_log = run([sys.executable, ROOT / "scripts/audit_tv3.py", "--live", *target_args,
                         "--output", folder / "baseline_audit.md"], timeout=180)
        (folder / "baseline_audit.log").write_text(audit_log + "\n", encoding="utf-8")
        audit_text = (folder / "baseline_audit.md").read_text(encoding="utf-8")
        if "**0 FAIL**" not in audit_text or "**0 PENDING**" not in audit_text:
            raise ValueError("Baseline audit must have zero FAIL and zero PENDING.")
        run([sys.executable, ROOT / "scripts/audit_v12_readings.py", *target_args,
             "--output", folder / "target_v12_audit.json"], timeout=120)
        if snapshot(target, psql, connection) != cloned:
            raise ValueError("Target changed during read-only audits.")

        print("6/6: Pin local target and evidence without credentials.", flush=True)
        files = sorted([p for p in (ROOT / "data").rglob("*") if p.is_file()]
                       + list((ROOT / "server/src/main/resources/db/migration").glob("*.sql")))
        pins = {str(path.relative_to(ROOT)).replace("\\", "/"): file_digest(path) for path in files}
        write_new_json(folder / "source_artifact_hashes.json", pins)
        manifest = {"task": "X01.1", "status": "READY_FOR_RUNNER", "database": target,
                    "host": args.host, "port": args.port, "username": args.user,
                    "jdbcUrl": f"jdbc:postgresql://{args.host}:{args.port}/{target}",
                    "sourceDatabase": source, "schemaVersion": 12, "flywayEnabled": False,
                    "backendHttpUrl": "http://127.0.0.1:18091", "webSocketUrl": "ws://127.0.0.1:18091/ws",
                    "origin": "http://127.0.0.1:3173", "backendStarted": False,
                    "runtimeCounts": cloned["runtimeCounts"], "knowledgeSha256": cloned["knowledgeSha256"],
                    "schemaSha256": cloned["schemaSha256"], "archiveSha256": file_digest(archive),
                    "evidenceDirectory": str(folder.relative_to(ROOT)).replace("\\", "/"),
                    "createdAt": datetime.now(VIETNAM).isoformat(), "passwordStored": False}
        report.update(status="PASS", manifestPublished=True, sourceKnowledgeUnchanged=True,
                      targetMatchesSourceKnowledge=True, auditsReadOnly=True,
                      baselineZeroFailuresAndPending=True, scopedV12Audit="PASS")
        write_new_json(folder / "preparation_report.json", report)
        write_new_json(POINTER, manifest)
        print(json.dumps({"database": target, "status": report["status"],
                          "manifest": str(POINTER), "evidence": str(folder)}, ensure_ascii=False), flush=True)
        return manifest
    except Exception as error:
        report.update(status="FAILED", error=safe_error(str(error)))
        failure_file = folder / "preparation_failure.json"
        if not failure_file.exists():
            write_new_json(failure_file, report)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source")
    parser.add_argument("--target")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--pg-bin", type=Path, default=Path(r"C:\Program Files\PostgreSQL\18\bin"))
    args = parser.parse_args()
    try:
        prepare(args)
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        print("X01 TEST preparation failed: " + safe_error(str(error)), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
