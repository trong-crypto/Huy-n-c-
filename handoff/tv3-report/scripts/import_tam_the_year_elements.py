"""Import/review the 60 stem-branch -> element mappings from Tam The PDF11 only."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

from import_book_knowledge import ROOT, BOOKS, book_id, quote
from import_hexagram_names import psql

SOURCE_SHA = "7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d"
DATA = ROOT / "data/tam_the_year_elements.csv"
REVIEW = ROOT / "data/tam_the_year_element_review.csv"
DATA_SHA = "470b3ebf936ff4856993a8e9d8fa63b2e472ac70bb96e37c8160f71a2900588f"
REVIEW_SHA = "713d4fd9d17831f345cfca060470d74966658678b220d5c68507a920aa1f936a"
STEMS = ("GIAP", "AT", "BINH", "DINH", "MAU", "KY", "CANH", "TAN", "NHAM", "QUY")
BRANCHES = ("TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI")
STEM_NAMES = ("Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý")
BRANCH_NAMES = ("Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi")
ELEMENT_NAMES = {"KIM": "Kim", "MOC": "Mộc", "THUY": "Thủy", "HOA": "Hỏa", "THO": "Thổ"}
EDITOR = "TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_24"
REVIEWER = "Codex source review 2026-10-24 (same-tool second pass)"
RULE_NOTE = ("S02 visual two-pass review of all 30 pairs/60 mappings in provided Tam The PDF11, print12; "
             "SHA256=" + SOURCE_SHA + ". Scope: normalized stem/branch codes and printed element column only. "
             "Descriptors/nap-am names are excluded; row28 prints HOA beside a tree descriptor (source anomaly). "
             "Meo normalized to MAO, Ty/with-dot to TI, Nh am spelling to NHAM by cycle position. "
             "Same AI tool at both passes, not an independent human TV2 confirmation; printed edition identity "
             "unverified. Reviewed 2026-10-24; reviewed_at is DB application time. "
             "See data/tam_the_year_element_review.csv and docs/22-S02-TAM-THE-YEAR-ELEMENTS.md.")
ADOPTED_DESCRIPTION = "Tra hành mệnh theo 60 Can Chi năm âm; cột mạng Số 4, PDF 11/trang in 12. Phạm vi duyệt không gồm mô tả nạp âm hoặc chuyển lịch."


def read_csv(path, expected_hash):
    contents = Path(path).read_text(encoding="utf-8")
    if hashlib.sha256(contents.encode("utf-8")).hexdigest() != expected_hash:
        raise ValueError("Source transcription/review changed: a new source review is required")
    return list(csv.DictReader(io.StringIO(contents)))


def validate_records(rows):
    if len(rows) != 60:
        raise ValueError("Expected exactly 60 source mappings")
    for i, row in enumerate(rows):
        if (row["cycle_position"], row["stem"], row["branch"], row["pdf_page"],
            row["source_row"], row["source_column"]) != (
                str(i + 1), STEMS[i % 10], BRANCHES[i % 12], "11", str(i // 2 + 1), "L" if i % 2 == 0 else "R"):
            raise ValueError("Invalid cycle key, source row or page")
        if row["element"] not in ELEMENT_NAMES:
            raise ValueError("Invalid source element")
    if Counter(r["element"] for r in rows) != Counter({e: 12 for e in ELEMENT_NAMES}):
        raise ValueError("Source table must contain 12 mappings per element")
    return rows


def load_records(path=DATA):
    return validate_records(read_csv(path, DATA_SHA))


def load_review(rows, path=REVIEW):
    review = read_csv(path, REVIEW_SHA)
    if len(review) != 30:
        raise ValueError("Expected 30 separately reviewed source pairs")
    for i, r in enumerate(review):
        left, right = rows[2 * i:2 * i + 2]
        if ((r["source_row"], r["first_stem"], r["first_branch"], r["second_stem"], r["second_branch"])
                != (str(i + 1), left["stem"], left["branch"], right["stem"], right["branch"]) or
                r["element"] != left["element"] or r["element"] != right["element"]):
            raise ValueError("Reviewed source pair differs from import")
    return review


def entry_key(row):
    return "STEM:" + row["stem"] + "|BRANCH:" + row["branch"]


def title(row):
    return STEM_NAMES[STEMS.index(row["stem"])] + " " + BRANCH_NAMES[BRANCHES.index(row["branch"])] + " — " + ELEMENT_NAMES[row["element"]]


def entry_note(row):
    return (f"S02 PDF11/print12 row{row['source_row']} cell{row['source_column']}; "
            "scope=STEM_BRANCH_ELEMENT; descriptor excluded. " + RULE_NOTE)


def verify_pdf(folder):
    path = Path(folder) / BOOKS["TT"]["filename"]
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != SOURCE_SHA:
        raise ValueError("Tam The PDF differs from the reviewed source")


def build_sql(rows, review=False):
    values = ["(" + ",".join(quote(v) for v in (entry_key(r), r["element"], title(r), entry_note(r))) + ")" for r in rows]
    sql = """BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE tam_the_lookup_entries, calculation_rules, source_sections, source_books IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE year_import(key text PRIMARY KEY,element text,title text,note text) ON COMMIT DROP;
INSERT INTO year_import VALUES
""" + ",\n".join(values) + f""";
DO $$ BEGIN
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'
 AND b.id={book_id('TT')} AND b.file_sha256={quote(SOURCE_SHA)} AND b.pdf_page_count=360
 AND s.section_label='TT-NGU-HANH' AND s.pdf_page=11 AND s.printed_page_label='12'
 AND ((r.verification_status='SOURCE_LOCATED' AND r.reviewer IS NULL AND r.reviewed_at IS NULL
       AND r.verification_note IS NULL)
  OR (r.verification_status='VERIFIED' AND r.reviewer={quote(REVIEWER)} AND r.reviewed_at IS NOT NULL
      AND r.verification_note={quote(RULE_NOTE)} AND r.description={quote(ADOPTED_DESCRIPTION)}))) <> 1
 THEN RAISE EXCEPTION 'Missing/changed/protected TT-NGU-HANH source or reviewer'; END IF;
IF EXISTS (SELECT 1 FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 LEFT JOIN year_import n ON n.key=e.lookup_key
 WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'
 AND (n.key IS NULL OR e.result_code<>n.element OR e.title<>n.title OR e.description IS NOT NULL
      OR e.source_section_id<>r.source_section_id OR e.editor IS DISTINCT FROM {quote(EDITOR)}
      OR NOT ((e.verification_status='SOURCE_LOCATED' AND e.reviewer IS NULL
               AND e.reviewed_at IS NULL AND e.verification_note IS NULL)
           OR (e.verification_status='VERIFIED' AND e.reviewer={quote(REVIEWER)}
               AND e.reviewed_at IS NOT NULL AND e.verification_note=n.note))))
 THEN RAISE EXCEPTION 'Changed/protected year mapping: no overwrite or automatic re-approval'; END IF;
END $$;
"""
    if not review:
        sql += f"""INSERT INTO tam_the_lookup_entries
 (rule_id,lookup_key,result_code,title,description,source_section_id,verification_status,editor)
SELECT r.id,n.key,n.element,n.title,NULL,r.source_section_id,'SOURCE_LOCATED',{quote(EDITOR)}
 FROM year_import n CROSS JOIN calculation_rules r
 WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'
ON CONFLICT (rule_id,lookup_key,result_code) DO NOTHING;
"""
    sql += """DO $$ BEGIN
IF (SELECT count(*) FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0') <> 60
 THEN RAISE EXCEPTION 'Expected exactly 60 imported year mappings before review'; END IF;
END $$;
"""
    if review:
        sql += f"""UPDATE tam_the_lookup_entries e SET verification_status='VERIFIED',
 reviewer={quote(REVIEWER)},reviewed_at=CURRENT_TIMESTAMP,verification_note=n.note
 FROM year_import n,calculation_rules r
 WHERE e.rule_id=r.id AND e.lookup_key=n.key AND r.module='TAM_THE'
 AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0' AND e.verification_status='SOURCE_LOCATED';
UPDATE calculation_rules SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},
 reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(RULE_NOTE)},description={quote(ADOPTED_DESCRIPTION)}
 WHERE module='TAM_THE' AND rule_code='TT-NGU-HANH' AND rule_version='1.0'
 AND verification_status='SOURCE_LOCATED';
"""
    return sql + "COMMIT;\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--review", action="store_true", help="Apply the recorded source review after import")
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    rows = load_records()
    if args.review:
        load_review(rows)
    verify_pdf(args.pdf_dir)
    sql = build_sql(rows, args.review)
    folder = ROOT / "scripts/generated"
    folder.mkdir(exist_ok=True)
    (folder / ("s02_review.sql" if args.review else "s02_import.sql")).write_text(sql, encoding="utf-8")
    if not args.apply:
        print("DRY RUN: 60 source mappings validated" + (" against 30 reviewed pairs." if args.review else ".") + " No DB writes.")
        return
    scope = "FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'"
    backup = json.loads(psql(args, "SELECT json_build_object('entries',(SELECT coalesce(json_agg(e),'[]'::json) "
                             + scope + "),'rule',(SELECT json_agg(r) FROM calculation_rules r WHERE module='TAM_THE' AND rule_code='TT-NGU-HANH' AND rule_version='1.0'));"))
    backups = folder / "db-backups"
    backups.mkdir(exist_ok=True)
    name = "before-s02-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json"
    (backups / name).write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    psql(args, sql)
    print("COMMITTED: " + ("60 mappings + TT-NGU-HANH VERIFIED for element lookup only; other Tam The rules unchanged."
                            if args.review else "60 mappings imported; existing reviews preserved. No new approvals."))


if __name__ == "__main__":
    main()
