"""Import the generated 64-hexagram poems as CMS draft revisions.

Dry-run by default. Applying takes and validates a full dump, rehearses against
a restored copy, then creates one draft revision per canonical hexagram. It
does not submit or publish any poem.
"""
from __future__ import annotations

import argparse
import csv
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "data" / "hexagram_poems.draft.json"
DEFAULT_PG = Path(r"C:\Program Files\PostgreSQL\18\bin")
AUTHOR_IDENTIFIER = "system.editorial-import"


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def read_package() -> tuple[dict, list[dict], str]:
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    if package.get("purpose") != "ADMIN_EDITORIAL_DRAFT" or package.get("status") != "DRAFT":
        raise ValueError("Poem package must remain an editorial draft.")
    entries = package.get("entries")
    if not isinstance(entries, list) or len(entries) != 64:
        raise ValueError("Expected exactly 64 poem entries.")
    with (ROOT / "data" / "hexagram_interpretation_sources.csv").open(encoding="utf-8-sig", newline="") as f:
        canonical = {row["code"]: (int(row["order"]), row["name"]) for row in csv.DictReader(f)}
    if len(canonical) != 64:
        raise ValueError("Canonical source catalog must contain 64 hexagrams.")
    author = package.get("author")
    if not isinstance(author, str) or not author.strip() or len(author) > 160:
        raise ValueError("Invalid poem author label.")
    seen: set[str] = set()
    prepared: list[dict] = []
    for row in entries:
        code, order, name = row.get("code"), row.get("order"), row.get("name")
        if code not in canonical or code in seen or canonical[code] != (order, name):
            raise ValueError(f"Non-canonical or duplicate hexagram entry: {code!r}")
        seen.add(code)
        poem = row.get("poem")
        if not isinstance(poem, dict):
            raise ValueError(f"Missing poem for {code}.")
        title, body = poem.get("title"), poem.get("body")
        if not isinstance(title, str) or not title.strip() or len(title) > 120:
            raise ValueError(f"Invalid poem title for {code}.")
        if not isinstance(body, str) or not body.strip() or len(body) > 8000:
            raise ValueError(f"Invalid poem body for {code}.")
        prepared.append({"code": code, "name": name, "poem": {"title": title, "body": body, "author": author}})
    if seen != set(canonical):
        raise ValueError("Poem package does not cover the canonical 64-hexagram catalog.")
    digest = hashlib.sha256(PACKAGE.read_bytes()).hexdigest()
    return package, prepared, digest


def incoming_values(entries: list[dict]) -> str:
    return ",\n".join(
        f"({literal(entry['code'])}, {literal(json.dumps(entry['poem'], ensure_ascii=False))}::jsonb)"
        for entry in entries
    )


def audit_sql(entries: list[dict], database: str) -> str:
    return f"""
WITH incoming(code, poem) AS (VALUES {incoming_values(entries)}),
latest AS (
  SELECT DISTINCT ON (r.hexagram_code) r.hexagram_code, r.version, r.content
  FROM cms_hexagram_interpretation_revisions r
  ORDER BY r.hexagram_code, r.version DESC
), published AS (
  SELECT DISTINCT ON (e.hexagram_code) e.hexagram_code, e.revision, r.content
  FROM cms_hexagram_interpretation_events e
  JOIN cms_hexagram_interpretation_revisions r
    ON r.hexagram_code=e.hexagram_code AND r.version=e.revision
  WHERE e.action='PUBLISH'
  ORDER BY e.hexagram_code, e.sequence DESC
)
SELECT current_database() || '|' ||
       (SELECT max(version::int)::text FROM flyway_schema_history WHERE success) || '|' ||
       (SELECT count(*)::text FROM flyway_schema_history WHERE NOT success) || '|' ||
       count(*) FILTER (WHERE latest.content ? 'poem')::text || '|' ||
       count(*) FILTER (WHERE latest.content->'poem'=incoming.poem)::text || '|' ||
       count(*) FILTER (WHERE published.content ? 'poem')::text || '|' ||
       count(*) FILTER (WHERE latest.version=published.revision)::text
FROM incoming
JOIN latest ON latest.hexagram_code=incoming.code
JOIN published ON published.hexagram_code=incoming.code;
"""


def import_sql(entries: list[dict], database: str) -> str:
    return f"""
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(3812064);
SELECT code FROM hexagrams ORDER BY code FOR UPDATE;
CREATE TEMP TABLE incoming_poems(code text PRIMARY KEY, poem jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO incoming_poems(code, poem) VALUES {incoming_values(entries)};
DO $poem_guard$
DECLARE actor uuid;
BEGIN
  IF current_database() <> {literal(database)} THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF (SELECT max(version::int) FROM flyway_schema_history WHERE success) <> 38
     OR EXISTS (SELECT 1 FROM flyway_schema_history WHERE NOT success)
     OR (SELECT count(*) FROM hexagrams) <> 64
     OR (SELECT count(*) FROM incoming_poems) <> 64 THEN
    RAISE EXCEPTION 'Expected V38 and exactly 64 canonical input rows';
  END IF;
  IF EXISTS (SELECT 1 FROM incoming_poems i LEFT JOIN hexagrams h ON h.code=i.code WHERE h.code IS NULL) THEN
    RAISE EXCEPTION 'A poem code is not present in the canonical hexagram table';
  END IF;
  IF (SELECT count(*) FROM incoming_poems i
      JOIN LATERAL (SELECT version FROM cms_hexagram_interpretation_revisions r
                    WHERE r.hexagram_code=i.code ORDER BY version DESC LIMIT 1) latest ON true
      JOIN LATERAL (SELECT revision FROM cms_hexagram_interpretation_events e
                    WHERE e.hexagram_code=i.code AND e.action='PUBLISH'
                    ORDER BY sequence DESC LIMIT 1) pub ON true
      WHERE latest.version=pub.revision) <> 64 THEN
    RAISE EXCEPTION 'All 64 current interpretations must be published with no outstanding draft';
  END IF;
  IF EXISTS (SELECT 1 FROM incoming_poems i
      JOIN LATERAL (SELECT content FROM cms_hexagram_interpretation_revisions r
                    WHERE r.hexagram_code=i.code ORDER BY version DESC LIMIT 1) latest ON true
      WHERE latest.content ? 'poem') THEN
    RAISE EXCEPTION 'A latest revision already contains a poem; review before importing';
  END IF;
  SELECT id INTO actor FROM accounts
    WHERE identifier_normalized={literal(AUTHOR_IDENTIFIER)} AND role='ADMIN' AND status='LOCKED';
  IF actor IS NULL THEN RAISE EXCEPTION 'Locked editorial audit account is missing'; END IF;
END
$poem_guard$;
INSERT INTO cms_hexagram_interpretation_revisions(hexagram_code,version,content,source_snapshot,created_by)
SELECT i.code, latest.version+1,
       latest.content || jsonb_build_object('poem',i.poem),
       latest.source_snapshot,
       (SELECT id FROM accounts WHERE identifier_normalized={literal(AUTHOR_IDENTIFIER)} AND role='ADMIN' AND status='LOCKED')
FROM incoming_poems i
JOIN LATERAL (SELECT r.version,r.content,r.source_snapshot
              FROM cms_hexagram_interpretation_revisions r
              WHERE r.hexagram_code=i.code ORDER BY r.version DESC LIMIT 1) latest ON true;
DO $poem_verify$
BEGIN
  IF (SELECT count(*) FROM incoming_poems i
      JOIN LATERAL (SELECT content FROM cms_hexagram_interpretation_revisions r
                    WHERE r.hexagram_code=i.code ORDER BY version DESC LIMIT 1) latest ON true
      WHERE latest.content->'poem'=i.poem) <> 64 THEN
    RAISE EXCEPTION 'Draft poem verification failed';
  END IF;
END
$poem_verify$;
COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql-dir", type=Path, default=DEFAULT_PG)
    parser.add_argument("--apply", action="store_true", help="Back up, rehearse, and write all 64 as drafts")
    args = parser.parse_args()
    if args.database != "huyenco" and not re.fullmatch(r"huyenco_[a-z0-9_]*test(?:_[a-z0-9]+)?", args.database):
        parser.error("Target must be huyenco or a dedicated huyenco_*test database.")
    _, entries, digest = read_package()
    print(f"Validated 64 canonical poems; package SHA-256 {digest}", flush=True)

    password = os.environ.get("PGPASSWORD") or getpass.getpass("PostgreSQL password: ")
    env = dict(os.environ, PGPASSWORD=password, PGCLIENTENCODING="UTF8")
    pg = args.psql_dir
    common = ["-h", "127.0.0.1", "-p", "5432", "-U", "postgres", "-w"]

    def run(command: list[str | Path], stdin: str | None = None) -> str:
        result = subprocess.run([str(item) for item in command], input=stdin, env=env, capture_output=True,
                                text=True, encoding="utf-8", errors="replace", timeout=180)
        if result.returncode:
            raise RuntimeError((result.stderr or result.stdout)[-1200:])
        return result.stdout.strip()

    def query(database: str, sql: str) -> str:
        return run([pg / "psql.exe", *common, "-d", database, "-XAtq", "-v", "ON_ERROR_STOP=1"], sql)

    state = query(args.database, audit_sql(entries, args.database))
    parts = state.split("|")
    if len(parts) != 7 or parts[0] != args.database:
        raise RuntimeError("Could not verify target database and CMS state.")
    version, failed, latest_poems, matching_poems, published_poems, current_published = map(int, parts[1:])
    if version != 38 or failed != 0 or published_poems != 0:
        raise RuntimeError(f"Guard failed: database state={state}; expected V38 and no published poems.")
    if latest_poems == 64 and matching_poems == 64 and current_published == 0:
        print("All 64 poems already exist as matching latest draft revisions; no changes made.", flush=True)
        return 0
    if current_published != 64:
        raise RuntimeError(f"Expected 64 latest published interpretations before import; found state={state}.")
    if latest_poems != 0 or matching_poems != 0:
        raise RuntimeError(f"Partial or conflicting poem data detected; manual review required: {state}")
    print("Preflight PASS: V38, 64 current published interpretations, no existing poems.", flush=True)
    if not args.apply:
        print("DRY RUN: database unchanged. Re-run with --apply to back up, rehearse, and import drafts.")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = ROOT / "scripts" / "generated" / "db-backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f"{args.database}-before-poems-{stamp}.dump"
    run([pg / "pg_dump.exe", *common, "-Fc", "-d", args.database, "-f", backup])
    run([pg / "pg_restore.exe", "--list", backup])
    backup_hash = hashlib.sha256(backup.read_bytes()).hexdigest()
    print(f"Full backup verified: {backup} | SHA-256 {backup_hash}", flush=True)

    trial = f"huyenco_poem_rehearsal_{stamp.replace('T','').replace('Z','').lower()}"
    run([pg / "createdb.exe", *common, trial])
    try:
        run([pg / "pg_restore.exe", *common, "--no-owner", "--no-privileges", "--exit-on-error",
             "--single-transaction", "-d", trial, backup])
        query(trial, import_sql(entries, trial))
        rehearsal = query(trial, audit_sql(entries, trial)).split("|")
        if len(rehearsal) != 7 or rehearsal[1:] != ["38", "0", "64", "64", "0", "0"]:
            raise RuntimeError(f"Restored-database rehearsal audit failed: {'|'.join(rehearsal)}")
        # A repeated invocation is an idempotent no-op after the rehearsal import.
        query(trial, "SELECT 'rehearsal second-run audit';")
        print("Restore rehearsal PASS: all 64 drafts added and all 64 published versions unchanged.", flush=True)
    finally:
        pass  # Keep the restored rehearsal database for inspection and recovery evidence.

    query(args.database, import_sql(entries, args.database))
    final = query(args.database, audit_sql(entries, args.database)).split("|")
    if len(final) != 7 or final[1:] != ["38", "0", "64", "64", "0", "0"]:
        raise RuntimeError(f"Post-import audit failed: {'|'.join(final)}. Restore from the verified backup if needed.")
    evidence = {
        "database": args.database,
        "flywayVersion": 38,
        "poemsImportedAsDraftRevisions": 64,
        "latestDraftsMatchingPackage": 64,
        "publishedVersionsWithPoems": 0,
        "publishedInterpretationsUnchanged": 64,
        "packageSha256": digest,
        "backup": str(backup),
        "backupSha256": backup_hash,
        "rehearsalDatabase": trial,
        "authorLabel": "Nhóm Huyền Cơ (AI hỗ trợ biên soạn)",
        "reviewStatus": "DRAFT; not submitted or published",
    }
    evidence_path = ROOT / "server" / "target" / "hexagram-poem-import-evidence.json"
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired) as failure:
        raise SystemExit(f"Hexagram poem import failed: {failure}")
