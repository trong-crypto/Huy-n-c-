"""Apply the recorded eight-trigram source review, preserving OBJECT_COUNT ambiguity."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

from import_book_knowledge import ROOT, TRIGRAMS, book_id, quote
from import_hexagram_names import SOURCE_SHA, psql, verify_pdf

REVIEW = ROOT / "data/trigram_source_review.csv"
REVIEW_SHA = "29cbc2986bb342f879446e40d20acbd8bf3880a8cf482ae0b84a02fc182a16c7"
REVIEWER = "Codex source review 2026-10-24 (same-tool second pass)"
NOTE = ("Visual source review of eight trigram numbers/names PDF39-40 (print44-45), "
        "elements PDF23-24/35 (print28-29/40), line forms reconstructed from lower/middle/upper "
        "line descriptions PDF35 and cross-checked with the reviewed hexagram diagram PDF274. "
        "Provided Mai Hoa PDF SHA256=" + SOURCE_SHA + ". "
        "Same AI tool as transcription, not an independent human TV2 confirmation. "
        "Review date 2026-10-24; reviewed_at records database application time. "
        "Only MH-TRIGRAM 1.0 reviewed; OBJECT_COUNT remains SOURCE_AMBIGUOUS/TEAM_DECISION. "
        "Printed edition identity remains unverified. See docs/21-B03-OBJECT-COUNT-HANDOFF.md "
        "and data/trigram_source_review.csv.")


def load_review(path=REVIEW):
    contents = Path(path).read_text(encoding="utf-8")
    if hashlib.sha256(contents.encode()).hexdigest() != REVIEW_SHA:
        raise ValueError("Review manifest changed: a new source review is required")
    rows = list(csv.DictReader(io.StringIO(contents)))
    reviewed = [(r["code"], r["name"], int(r["heaven_number"]), r["element"],
                 tuple(int(b) for b in r["lines_bottom_up"])) for r in rows]
    if reviewed != TRIGRAMS or any((r["number_pdf_page"], r["form_pdf_page"], r["element_pdf_page"])
                                  != ("39", "35", "35") for r in rows):
        raise ValueError("Imported trigrams differ from the recorded source review")
    return rows


def build_sql(rows):
    values = []
    for r in rows:
        lines = ",".join("true" if b == "1" else "false" for b in r["lines_bottom_up"])
        values.append(f"({quote(r['code'])},{quote(r['name'])},{int(r['heaven_number'])},"
                      f"{quote(r['element'])},ARRAY[{lines}]::boolean[])")
    return """BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE calculation_rules, trigrams, source_sections, source_books IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE trigram_review(code text PRIMARY KEY,name text,number integer,element text,lines boolean[])
 ON COMMIT DROP;
INSERT INTO trigram_review VALUES
""" + ",\n".join(values) + f""";
DO $$ BEGIN
IF (SELECT count(*) FROM trigrams) <> 8 OR
 (SELECT count(*) FROM trigram_review n JOIN trigrams t USING(code)
  WHERE t.name=n.name AND t.heaven_number=n.number AND t.element=n.element AND t.lines_bottom_up=n.lines) <> 8
 THEN RAISE EXCEPTION 'Eight trigram records changed: review before approval'; END IF;
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE r.module='MAI_HOA' AND r.rule_code='MH-TRIGRAM' AND r.rule_version='1.0'
 AND b.id={book_id('MH')} AND b.file_sha256={quote(SOURCE_SHA)} AND b.pdf_page_count=672
 AND s.section_label='MH-QUAI-SO' AND s.pdf_page=39 AND s.printed_page_label='44'
 AND ((r.verification_status='SOURCE_LOCATED' AND r.reviewer IS NULL AND r.reviewed_at IS NULL)
  OR (r.verification_status='VERIFIED' AND r.reviewer={quote(REVIEWER)}
      AND r.reviewed_at IS NOT NULL AND r.verification_note={quote(NOTE)}))) <> 1
 THEN RAISE EXCEPTION 'Missing/changed/protected trigram rule source or reviewer'; END IF;
IF (SELECT count(*) FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
 WHERE b.file_sha256={quote(SOURCE_SHA)} AND s.section_label='MH-NGU-HANH'
 AND s.pdf_page=35 AND s.printed_page_label='40') <> 1
 THEN RAISE EXCEPTION 'Supporting element/form source missing or changed'; END IF;
END $$;
UPDATE calculation_rules SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},
 reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(NOTE)}
WHERE module='MAI_HOA' AND rule_code='MH-TRIGRAM' AND rule_version='1.0'
 AND verification_status='SOURCE_LOCATED';
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    sql = build_sql(load_review())
    verify_pdf(args.pdf_dir)
    generated = ROOT / "scripts/generated"
    generated.mkdir(exist_ok=True)
    (generated / "trigram_review.sql").write_text(sql, encoding="utf-8")
    if not args.apply:
        print("DRY RUN: eight trigram records match the review; source PDF hash matches. No DB changes.")
        return
    backup = json.loads(psql(args, "SELECT coalesce(json_agg(r ORDER BY id),'[]'::json) FROM calculation_rules r;"))
    folder = generated / "db-backups"
    folder.mkdir(exist_ok=True)
    name = "before-trigram-review-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json"
    (folder / name).write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    psql(args, sql)
    print("COMMITTED: only MH-TRIGRAM 1.0 VERIFIED; OBJECT_COUNT remains ambiguous with team policy.")


if __name__ == "__main__":
    main()
