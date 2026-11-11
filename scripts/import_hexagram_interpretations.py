"""Import editorial content as first revisions on an explicitly named local V34 TEST database."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from uuid import UUID

DATA = Path(__file__).resolve().parents[1] / "data"
DETAIL_KINDS = {"image": "IMAGE", "original": "HEXAGRAM_TEXT",
                "paraphrase": "HEXAGRAM_PARAPHRASE", "application": "APPLICATION"}
REUSE_NOTE = ("Văn bản Chu Dịch Hán cổ. Bản số hóa Wikisource ghi theo URL phiên bản; "
              "lời giải tiếng Việt do nhóm biên soạn. Chờ duyệt trước công bố.")


def package():
    def read(name):
        return json.loads((DATA / f"hexagram_interpretation_{name}.draft.json").read_text(encoding="utf-8"))

    pilots = read("pilot")["entries"]
    overviews = read("overviews")
    details = {row["code"]: row for row in read("details")["entries"]}
    if overviews["status"] != "DRAFT" or len(details) != 61:
        raise ValueError("Unexpected editorial package")
    entries = []
    for row in pilots:
        parts = {section["kind"]: section["text"] for section in row["sections"] if section["kind"] != "LINE"}
        lines = [section for section in row["sections"] if section["kind"] == "LINE"]
        content = {key: parts[kind] for key, kind in DETAIL_KINDS.items()}
        content.update(overview=parts["OVERVIEW"], lines=[line["text"] for line in lines])
        entries.append(entry(row, row["references"][0], content, lines))
    for row in overviews["entries"]:
        detail = details.pop(row["code"])
        if (detail["sourceUrl"] != row["source"]["url"] or detail["name"] != row["name"]
                or row["verificationStatus"] != "SOURCE_LOCATED"):
            raise ValueError("Detail and overview provenance differ")
        content = {key: detail[key] for key in DETAIL_KINDS}
        content.update(overview=row["text"], lines=[line["text"] for line in detail["lines"]])
        entries.append(entry(detail, row["source"], content, detail["lines"]))
    if details or len(entries) != 64 or len({row["code"] for row in entries}) != 64:
        raise ValueError("Import requires exactly 64 unique draft entries")
    return sorted(entries, key=lambda row: row["code"])


def entry(row, source, content, lines):
    code = row["code"]
    if (row["status"] != "DRAFT" or row["verificationStatus"] != "SOURCE_LOCATED"
            or not re.fullmatch(r"H_[A-Z0-9_]{1,14}", code)
            or [line["lineNumber"] for line in lines] != list(range(1, 7))):
        raise ValueError(f"Unexpected identity or editorial status for {code}")
    for key, limit in {"overview": 6000, "image": 2000, "original": 2000,
                       "paraphrase": 4000, "application": 4000}.items():
        value = content[key]
        if len(value) > limit or (key != "original" and not value.strip()):
            raise ValueError(f"Invalid {key} for {code}")
    if any(not line.strip() or len(line) > 2000 for line in content["lines"]):
        raise ValueError(f"Invalid line text for {code}")
    if not re.fullmatch(r"https://zh\.wikisource\.org/w/index\.php\?title=[^&]+&oldid=[1-9]\d*", source["url"]):
        raise ValueError(f"Unpinned source for {code}")
    snapshot = {key: source[key] for key in ("title", "author", "edition", "locator", "url")}
    snapshot.update(id=f"ZHOUYI-{code}", reuseNote=REUSE_NOTE, reviewStatus="SOURCE_LOCATED")
    return {"code": code, "content": content, "source": snapshot,
            "lines": "".join("1" if line["isYang"] else "0" for line in lines)}


def import_sql(database, port, admin, payload, checksum):
    # Only validated database/port/UUID and ASCII hex values are interpolated.
    return f"""
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $import$
DECLARE
    item jsonb;
    source jsonb;
    imported int := 0;
    skipped int := 0;
BEGIN
    IF current_database() <> '{database}' OR host(inet_server_addr()) <> '127.0.0.1'
       OR inet_server_port() <> {port} THEN
        RAISE EXCEPTION 'Target is not the designated disposable TEST database';
    END IF;
    IF (SELECT array_agg(version ORDER BY installed_rank) FROM flyway_schema_history WHERE version IS NOT NULL AND success)
       IS DISTINCT FROM ARRAY(SELECT n::varchar FROM generate_series(1,34) n)
       OR EXISTS (SELECT FROM flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history must contain exactly V1–V34';
    END IF;
    PERFORM id FROM accounts WHERE id = '{admin}'::uuid AND role = 'ADMIN' AND status = 'ACTIVE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An existing ACTIVE TEST ADMIN is required'; END IF;
    FOR item IN SELECT jsonb_array_elements(convert_from(decode('{payload.hex()}','hex'),'UTF8')::jsonb)
    LOOP
        PERFORM code FROM hexagrams WHERE code = item->>'code' FOR UPDATE;
        IF NOT FOUND OR (SELECT string_agg(CASE WHEN is_yang THEN '1' ELSE '0' END, '' ORDER BY line_number)
            FROM hexagram_lines WHERE hexagram_code = item->>'code') IS DISTINCT FROM item->>'lines' THEN
            RAISE EXCEPTION 'Hexagram identity or line positions do not match %', item->>'code';
        END IF;
        IF EXISTS (SELECT FROM cms_hexagram_interpretation_revisions WHERE hexagram_code = item->>'code') THEN
            skipped := skipped + 1;
            CONTINUE;
        END IF;
        source := item->'source';
        INSERT INTO cms_hexagram_interpretation_sources
            (id, hexagram_code, title, author, edition, locator, url, reuse_note, review_status)
        VALUES (source->>'id', item->>'code', source->>'title', source->>'author', source->>'edition',
            source->>'locator', source->>'url', source->>'reuseNote', 'SOURCE_LOCATED')
        ON CONFLICT (id) DO NOTHING;
        IF NOT EXISTS (SELECT FROM cms_hexagram_interpretation_sources s WHERE s.id = source->>'id'
            AND s.hexagram_code = item->>'code' AND s.title = source->>'title'
            AND s.author IS NOT DISTINCT FROM source->>'author' AND s.edition = source->>'edition'
            AND s.locator = source->>'locator' AND s.url = source->>'url'
            AND s.reuse_note = source->>'reuseNote' AND s.review_status = 'SOURCE_LOCATED') THEN
            RAISE EXCEPTION 'Existing source conflicts with package for %', item->>'code';
        END IF;
        INSERT INTO cms_hexagram_interpretation_revisions (hexagram_code, version, content, source_snapshot, created_by)
        VALUES (item->>'code', 1, item->'content', jsonb_build_array(source), '{admin}'::uuid);
        INSERT INTO cms_hexagram_interpretation_imports (hexagram_code, revision, package_sha256)
        VALUES (item->>'code', 1, '{checksum}');
        imported := imported + 1;
    END LOOP;
    RAISE NOTICE 'DRAFT import: % created, % existing skipped', imported, skipped;
END;
$import$;
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write DRAFT revisions to the TEST copy")
    parser.add_argument("--database")
    parser.add_argument("--port", type=int)
    parser.add_argument("--db-user")
    parser.add_argument("--admin-id", type=UUID)
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    payload = json.dumps(package(), ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    checksum = hashlib.sha256(payload).hexdigest()
    if not args.apply:
        print(f"Dry run: 64 DRAFT entries, 384 lines, package SHA-256 {checksum}")
        return
    if (not args.database or not re.fullmatch(r"huyenco_[a-z0-9_]+_disposable", args.database)
            or args.port is None or not 1024 <= args.port <= 65535 or args.port in (5432, 5433)
            or not args.db_user or not args.admin_id):
        parser.error("--apply requires an explicit *_disposable database, isolated port, DB user and existing ADMIN id")
    password = os.environ.get("PGPASSWORD") or getpass.getpass("PostgreSQL TEST password: ")
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("PG")}
    env.update(PGPASSWORD=password, PGCLIENTENCODING="UTF8", PGCONNECT_TIMEOUT="5")
    result = subprocess.run([args.psql, "-Xqw", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", str(args.port),
                             "-d", args.database, "-U", args.db_user],
                            input=import_sql(args.database, args.port, args.admin_id, payload, checksum).encode(), env=env)
    if result.returncode:
        raise SystemExit(result.returncode)
    print(f"Package SHA-256 {checksum}")


if __name__ == "__main__":
    main()
