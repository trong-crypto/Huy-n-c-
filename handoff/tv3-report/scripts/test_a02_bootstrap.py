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
import import_tam_the_career as career_source
import verify_calendar_rule as calendar_source
import verify_time_decision as time_decision
import import_tam_the_d02 as d02_source

ROOT = Path(__file__).resolve().parents[1]
TABLES = ("source_books", "source_sections", "calculation_rules", "trigrams", "hexagrams",
          "hexagram_lines", "interpretations", "tam_the_hour_anchors", "tam_the_lookup_entries", "tam_the_lookup_source_pages", "flyway_schema_history", "external_sources", "anonymous_sessions", "interpretation_history")

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
              "trigramApprovalGuards": 0, "yearElementApprovalGuards": 0, "careerApprovalGuards": 0,
              "careerLegacyCases": 0, "calendarApprovalGuards": 0, "timeOwnerApprovalGuards": 0, "d02ApprovalGuards": 0}
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
        legacy_base = "FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-CONG-DANH-11' AND r.rule_version='1.0' AND e.lookup_key='ELEMENT:THUY|MONTH:08' AND e.result_code='CAU_CHAI'"
        legacy_join = legacy_base.replace('FROM calculation_rules r WHERE e.rule_id=r.id AND ', 'JOIN calculation_rules r ON e.rule_id=r.id WHERE ')
        import_body = career_source.build_sql(career_source.load_records()).replace("BEGIN;", "", 1).replace("COMMIT;", "")
        review_body = career_source.build_sql(career_source.load_records(), review=True).replace("BEGIN;", "", 1).replace("COMMIT;", "")
        # Test the old month-9 typo both before and after the corrected seed has added month 8.
        mutations = [
            "UPDATE tam_the_lookup_entries e SET lookup_key='ELEMENT:THUY|MONTH:09',verification_status='SOURCE_LOCATED',editor='AUTO_FROM_DOCS',reviewer=NULL,reviewed_at=NULL,verification_note=NULL " + legacy_base,
            "INSERT INTO tam_the_lookup_entries(rule_id,lookup_key,result_code,title,source_section_id,verification_status,editor) SELECT e.rule_id,'ELEMENT:THUY|MONTH:09',e.result_code,e.title,e.source_section_id,'SOURCE_LOCATED','AUTO_FROM_DOCS' FROM tam_the_lookup_entries e " + legacy_join,
        ]
        check_legacy = """DO $$ BEGIN
IF EXISTS(SELECT 1 FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 WHERE r.rule_code='TT-CONG-DANH-11' AND e.lookup_key='ELEMENT:THUY|MONTH:09' AND e.result_code='CAU_CHAI')
 OR (SELECT count(*) FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 WHERE r.rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13') AND e.verification_status='VERIFIED')<>171
 THEN RAISE EXCEPTION 'D01 legacy correction failed'; END IF; END $$;"""
        for mutation in mutations:
            try:
                execute([psql, *common, "-X", "-q", "-d", database, "-v", "ON_ERROR_STOP=1"],
                        capture=True, input_text="BEGIN;" + mutation + ";" + import_body
                        + "DROP TABLE career_import;" + review_body + check_legacy + "ROLLBACK;")
            except subprocess.CalledProcessError as failure:
                raise AssertionError("Legacy correction test failed: " + failure.stderr) from failure
            report['careerLegacyCases'] += 1
        try:
            execute([psql, *common, "-X", "-q", "-d", database, "-v", "ON_ERROR_STOP=1"], capture=True,
                    input_text="BEGIN;UPDATE tam_the_lookup_entries e SET lookup_key='ELEMENT:THUY|MONTH:09' "
                    + legacy_base + ";" + import_body + "ROLLBACK;")
        except subprocess.CalledProcessError as failure:
            if "D01 changed/protected career entry" not in failure.stderr:
                raise AssertionError("Unexpected protected legacy error") from failure
            report['careerLegacyCases'] += 1
        else:
            raise AssertionError("A VERIFIED legacy-like row was overwritten")
        for mutation, expected_error in (
            ("UPDATE tam_the_lookup_entries e SET title='changed' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-CONG-DANH-11' AND e.lookup_key='ELEMENT:THUY|MONTH:08' AND e.result_code='CAU_CHAI'", "D01 changed/protected career entry"),
            ("UPDATE tam_the_lookup_entries e SET reviewer='another-reviewer' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-CONG-DANH-13' AND e.lookup_key='STEM:AT|MONTH:01'", "D01 changed/protected career entry"),
            ("UPDATE tam_the_lookup_entries e SET source_content_heading='invented' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-CONG-DANH-13' AND e.lookup_key='STEM:AT|MONTH:01'", "D01 changed/protected career entry"),
            ("UPDATE source_sections SET pdf_page=37 WHERE section_label='TT-CONG-DANH-13-TEXT'", "D01 protected passage source changed"),
            ("DELETE FROM tam_the_lookup_entries e USING calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-CONG-DANH-13' AND e.lookup_key='STEM:AT|MONTH:01'", "D01 expected exactly 51+120"),
        ):
            sql = "BEGIN;" + mutation + ";" + career_source.build_sql(career_source.load_records(), review=True).replace("BEGIN;", "", 1).replace("COMMIT;", "ROLLBACK;")
            try:
                execute([psql, *common, "-X", "-q", "-d", database, "-v", "ON_ERROR_STOP=1"], capture=True, input_text=sql)
            except subprocess.CalledProcessError as failure:
                if expected_error not in failure.stderr:
                    raise AssertionError("Unexpected error while testing D01 review guard: " + failure.stderr) from failure
                report["careerApprovalGuards"] += 1
            else:
                raise AssertionError("D01 review accepted changed/protected/incomplete data")
        if snapshot() != before:
            raise AssertionError("D01 review guard checks changed persisted data")
        for mutation, expected in (
            ("UPDATE external_sources SET sha256=repeat('0',64) WHERE source_id='C01-VN-FIXED7'", 'C01 protected external source changed'),
            ("UPDATE calculation_rules SET reviewer='changed' WHERE rule_code='LUNAR-CONVERSION'", 'C01 changed/protected calendar rule'),
            ("UPDATE external_sources SET url='https://changed.example' WHERE source_id='C01-VN-FIXED7'", 'C01 protected external source changed'),
        ):
            sql = 'BEGIN;' + mutation + ';' + calendar_source.build_sql(calendar_source.load_review()).replace('BEGIN;','',1).replace('COMMIT;','ROLLBACK;')
            try:
                execute([psql, *common, '-X', '-q', '-d', database, '-v', 'ON_ERROR_STOP=1'], capture=True, input_text=sql)
            except subprocess.CalledProcessError as failure:
                if expected not in failure.stderr: raise AssertionError('Unexpected C01 guard error: ' + failure.stderr) from failure
                report['calendarApprovalGuards'] += 1
            else: raise AssertionError('C01 accepted changed reviewed data')
        if snapshot() != before: raise AssertionError('C01 guard changed persisted data')
        for mutation in (
            "UPDATE calculation_rules SET reviewer='changed' WHERE rule_code='MH-TIME'",
            "UPDATE source_sections SET pdf_page=46 WHERE section_label='MH-TIME-CONFLICT'",
        ):
            sql='BEGIN;'+mutation+';'+time_decision.build_sql().replace('BEGIN;','',1).replace('COMMIT;','ROLLBACK;')
            try:
                execute([psql,*common,'-X','-q','-d',database,'-v','ON_ERROR_STOP=1'],capture=True,input_text=sql)
            except subprocess.CalledProcessError as failure:
                if 'TIME owner approval: source or protected rule changed' not in failure.stderr:
                    raise AssertionError('Unexpected TIME owner approval guard: '+failure.stderr) from failure
                report['timeOwnerApprovalGuards']+=1
            else: raise AssertionError('TIME owner approval overwrote protected data')
        if snapshot()!=before: raise AssertionError('TIME owner approval guard changed persisted data')
        for mutation, expected in (
            ("UPDATE tam_the_lookup_entries e SET description='invented' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-TAI-LOC' AND e.lookup_key='STEM:GIAP|MONTH:01'", 'D02 protected entry'),
            ("UPDATE tam_the_lookup_entries e SET verification_note='changed' FROM calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-TINH-DUYEN'", 'D02 protected entry'),
            ("DELETE FROM tam_the_lookup_source_pages WHERE page_order=2", 'D02 protected entry'),
            ("UPDATE calculation_rules SET reviewer='changed' WHERE rule_code='TT-36-PHAN'", 'D02 protected rule'),
            ("UPDATE source_sections SET printed_page_label='wrong' WHERE section_label='D02-TT-P065'", 'D02 protected source'),
            ("UPDATE tam_the_hour_anchors SET first_hour_start='04:21' WHERE lunar_month=1", 'D02 protected anchor'),
            ("UPDATE tam_the_hour_anchors SET reviewer='changed' WHERE lunar_month=5", 'D02 protected anchor'),
            ("DELETE FROM tam_the_lookup_source_pages p USING tam_the_lookup_entries e,calculation_rules r WHERE p.entry_id=e.id AND e.rule_id=r.id AND r.rule_code='TT-36-PHAN'; DELETE FROM tam_the_lookup_entries e USING calculation_rules r WHERE e.rule_id=r.id AND r.rule_code='TT-36-PHAN'", 'D02 expected exactly 216'),
        ):
            sql='BEGIN;'+mutation+';'+d02_source.build_sql(d02_source.load_records(),review=True).replace('BEGIN;','',1).replace('COMMIT;','ROLLBACK;')
            try:
                execute([psql,*common,'-X','-q','-d',database,'-v','ON_ERROR_STOP=1'],capture=True,input_text=sql)
            except subprocess.CalledProcessError as failure:
                if expected not in failure.stderr: raise AssertionError('Unexpected D02 guard error: '+failure.stderr) from failure
                report['d02ApprovalGuards']+=1
            else: raise AssertionError('D02 accepted changed reviewed data')
        if snapshot()!=before: raise AssertionError('D02 guard changed persisted data')
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
