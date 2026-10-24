"""Create a disposable database, bootstrap twice, compare rows and run JDBC integration tests.
Requires PGPASSWORD in the process environment. Never targets the user's huyenco database.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid
from import_book_knowledge import find_psql
from verify_trigram_rule import build_sql, load_review
import import_tam_the_year_elements as year_source

ROOT = Path(__file__).resolve().parents[1]
TABLES = ("source_books", "source_sections", "calculation_rules", "trigrams", "hexagrams",
          "hexagram_lines", "interpretations", "tam_the_hour_anchors", "tam_the_lookup_entries", "flyway_schema_history")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--pdf-dir", default=str(Path.home() / "Downloads"))
    args = parser.parse_args()
    if not os.environ.get("PGPASSWORD"):
        raise RuntimeError("Set PGPASSWORD in the process environment; do not put it in a file.")
    database = "huyenco_a02_" + uuid.uuid4().hex[:12]
    psql = Path(find_psql("psql"))
    env = dict(os.environ, PGCONNECT_TIMEOUT="5", PGCLIENTENCODING="UTF8", MAVEN_SKIP_RC="1")
    if not env.get("JAVA_HOME"):
        env["JAVA_HOME"] = str(Path(os.environ["ProgramFiles"]) / "Java/jdk-17")
    common = ["-w", "-h", args.host, "-p", str(args.port), "-U", args.user]
    folder = ROOT / "scripts/generated"
    folder.mkdir(parents=True, exist_ok=True)
    report = {"database": database, "bootstrapRuns": 0, "identicalRows": False, "javaTests": False, "cleanedUp": False,
              "trigramApprovalGuards": 0, "yearElementApprovalGuards": 0}
    created = False

    def execute(command, *, cwd=ROOT, timeout=300, capture=False, input_text=None):
        return subprocess.run([str(x) for x in command], cwd=cwd, env=env, check=True, timeout=timeout,
                              capture_output=capture, input=input_text, text=True, encoding="utf-8", errors="replace")

    def snapshot():
        result = {}
        for table in TABLES:
            sql = "SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM " + table + " t"
            result[table] = json.loads(execute([psql, *common, "-X", "-A", "-t", "-d", database,
                                               "-v", "ON_ERROR_STOP=1", "-c", sql], capture=True).stdout)
        return result

    try:
        execute([psql.with_name("createdb.exe"), *common, database])
        created = True
        before = None
        for iteration in (1, 2):
            execute(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                     ROOT / "scripts/import_all.ps1", "-DbHost", args.host, "-DbPort", args.port,
                     "-DbName", database, "-DbUser", args.user, "-PdfDir", args.pdf_dir,
                     "-AuditOutput", folder / "a02_bootstrap_audit.md"], timeout=650)
            report["bootstrapRuns"] = iteration
            after = snapshot()
            if before is not None and before != after:
                raise AssertionError("Second bootstrap changed database rows or review metadata")
            before = after
        report["identicalRows"] = True
        # Exercise approval failure paths inside rolled-back transactions in this disposable DB only.
        for mutation in (
            "UPDATE trigrams SET name='changed-source-value' WHERE code='CAN'",
            "UPDATE calculation_rules SET reviewer='another-reviewer' WHERE rule_code='MH-TRIGRAM'",
            "UPDATE source_sections SET pdf_page=40 WHERE section_label='MH-QUAI-SO'",
        ):
            sql = "BEGIN;" + mutation + ";" + build_sql(load_review()).replace("BEGIN;", "", 1).replace("COMMIT;", "ROLLBACK;")
            try:
                execute([psql, *common, "-X", "-q", "-d", database, "-v", "ON_ERROR_STOP=1"], capture=True, input_text=sql)
            except subprocess.CalledProcessError:
                report["trigramApprovalGuards"] += 1
            else:
                raise AssertionError("Trigram approval accepted changed/protected source data")
        if snapshot() != before:
            raise AssertionError("Approval guard checks changed persisted data")
        for mutation, expected_error in (
            ("UPDATE tam_the_lookup_entries e SET result_code='MOC' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0' AND e.lookup_key='STEM:GIAP|BRANCH:TY'", "Changed/protected year mapping"),
            ("UPDATE tam_the_lookup_entries e SET reviewer='another-reviewer' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0' AND e.lookup_key='STEM:GIAP|BRANCH:TY'", "Changed/protected year mapping"),
            ("UPDATE source_sections SET pdf_page=12 WHERE section_label='TT-NGU-HANH'", "TT-NGU-HANH source or reviewer"),
            ("DELETE FROM tam_the_lookup_entries e USING calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0' AND e.lookup_key='STEM:GIAP|BRANCH:TY'", "Expected exactly 60 imported year mappings"),
        ):
            sql = "BEGIN;" + mutation + ";" + year_source.build_sql(year_source.load_records(), review=True).replace("BEGIN;", "", 1).replace("COMMIT;", "ROLLBACK;")
            try:
                execute([psql, *common, "-X", "-q", "-d", database, "-v", "ON_ERROR_STOP=1"], capture=True, input_text=sql)
            except subprocess.CalledProcessError as failure:
                if expected_error not in failure.stderr:
                    raise AssertionError("Unexpected error while testing year-mapping review guard") from failure
                report["yearElementApprovalGuards"] += 1
            else:
                raise AssertionError("Year-mapping review accepted changed/protected/incomplete data")
        if snapshot() != before:
            raise AssertionError("Year-mapping review guard checks changed persisted data")
        report["counts"] = {table: len(rows) for table, rows in before.items()}
        report["snapshotSha256"] = hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()
        env["HUYENCO_TEST_DB_URL"] = f"jdbc:postgresql://{args.host}:{args.port}/{database}"
        env["HUYENCO_TEST_DB_USER"] = args.user
        execute(["cmd.exe", "/d", "/c", "mvnw.cmd", "-B", "-ntp", "-Pdatabase", "test"], cwd=ROOT / "server")
        report["javaTests"] = True
    finally:
        # Only drop the exact generated name which this process successfully created.
        if created and database.startswith("huyenco_a02_") and len(database) == 24:
            execute([psql.with_name("dropdb.exe"), *common, database])
            report["cleanedUp"] = True
        (folder / "a02_bootstrap_result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
