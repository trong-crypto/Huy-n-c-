"""Apply the recorded second-pass title review; never approve algorithms or interpretations."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

from import_book_knowledge import ROOT, TRIGRAMS, book_id, quote
from import_hexagram_names import SOURCE_SHA, load_names, psql, verify_pdf

REVIEW = ROOT / "data/hexagram_name_review.csv"
REVIEW_SHA = "daed99bf00c6d411721ec0cd9d22fdc63a217c40053047ea2c5a80ac857908f7"
REVIEWER = "Codex source review 2026-10-24 (same-tool second pass)"
NOTE = ("Second-pass visual title/line review of provided Mai Hoa PDF SHA256=" + SOURCE_SHA
        + "; titles PDF269-271, diagram PDF274, supporting list PDF500-501. "
        "Same AI tool as transcription, not an independent human TV2 confirmation. "
        "Review date 2026-10-24; reviewed_at records database approval application time. "
        "Ly/Ly-with-acute normalized using PDF500; Hoan retained from primary list. "
        "Edition identity/authorship of handwritten diagram labels remain unverified. "
        "See docs/19-S01-HEXAGRAM-NAME-REVIEW.md and data/hexagram_name_review.csv.")


def load_review(path=REVIEW):
    contents = Path(path).read_text(encoding="utf-8")
    if hashlib.sha256(contents.encode("utf-8")).hexdigest() != REVIEW_SHA:
        raise ValueError("Review manifest changed: a new source review is required")
    rows = list(csv.DictReader(io.StringIO(contents)))
    if len(rows) != 64 or {int(r["ring_position"]) for r in rows} != set(range(64)):
        raise ValueError("Expected all 64 reviewed ring positions")
    if len({r["name"] for r in rows}) != 64 or len({r["lines_bottom_up"] for r in rows}) != 64:
        raise ValueError("Repeated title or line pattern in review")
    imported = {r["name"]: r for r in load_names()}
    trigrams = {code: "".join(str(n) for n in lines) for code, _, _, _, lines in TRIGRAMS}
    for row in rows:
        original = imported.get(row["name"])
        if original is None or row["lines_bottom_up"] != trigrams[original["lower"]] + trigrams[original["upper"]]:
            raise ValueError("Reviewed name/line association does not match import")
        if int(row["name_pdf_page"]) != original["pdf_page"] or row["diagram_pdf_page"] != "274":
            raise ValueError("Reviewed source page does not match import")
        row.update(code=original["code"], upper=original["upper"], lower=original["lower"])
    return rows


def build_sql(rows):
    values = []
    for row in rows:
        bits = ",".join("true" if n == "1" else "false" for n in row["lines_bottom_up"])
        values.append("(" + ",".join(quote(row[k]) for k in ("code", "name", "upper", "lower"))
                      + ",ARRAY[" + bits + "]::boolean[]," + str(int(row["name_pdf_page"])) + ")")
    return """BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE hexagrams, source_sections, source_books IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE title_review(code text PRIMARY KEY,name text,upper_code text,lower_code text,
 lines boolean[],pdf integer) ON COMMIT DROP;
INSERT INTO title_review VALUES
""" + ",\n".join(values) + f""";
DO $$ BEGIN
IF (SELECT count(*) FROM title_review n JOIN hexagrams h USING(code)
 JOIN source_sections s ON s.id=h.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE h.name=n.name AND h.name_kind='CANONICAL_TITLE'
 AND h.upper_trigram_code=n.upper_code AND h.lower_trigram_code=n.lower_code
 AND h.lines_bottom_up=n.lines AND b.id={book_id('MH')}
 AND b.file_sha256={quote(SOURCE_SHA)} AND b.pdf_page_count=672
 AND s.pdf_page=n.pdf AND s.printed_page_label=(n.pdf+7)::text
 AND s.section_label='MH-64-QUE-NAMES-' || (n.pdf+7)::text
 AND ((h.verification_status='SOURCE_LOCATED' AND h.reviewer IS NULL
       AND h.editor='TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23')
   OR (h.verification_status='VERIFIED' AND h.reviewer={quote(REVIEWER)}
       AND h.reviewed_at IS NOT NULL AND h.verification_note={quote(NOTE)}))) <> 64 THEN
 RAISE EXCEPTION 'Missing/changed/protected title or source: review before approval'; END IF;
IF (SELECT count(*) FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
 WHERE b.file_sha256={quote(SOURCE_SHA)} AND s.section_label='MH-64-QUE-DIAGRAM'
 AND s.pdf_page=274 AND s.printed_page_label='281') <> 1 THEN
 RAISE EXCEPTION 'Diagram source missing or changed'; END IF;
END $$;
UPDATE hexagrams h SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},
 reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(NOTE)}
FROM title_review n WHERE h.code=n.code AND h.verification_status='SOURCE_LOCATED';
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
    rows = load_review()
    verify_pdf(args.pdf_dir)
    sql = build_sql(rows)
    generated = ROOT / "scripts/generated"
    generated.mkdir(parents=True, exist_ok=True)
    (generated / "hexagram_title_review.sql").write_text(sql, encoding="utf-8")
    if not args.apply:
        print("DRY RUN: 64 reviewed titles match source hash and diagram-order transcription; no DB changes.")
        return
    backup = json.loads(psql(args, "SELECT coalesce(json_agg(h ORDER BY code),'[]'::json) FROM hexagrams h;"))
    folder = generated / "db-backups"
    folder.mkdir(exist_ok=True)
    name = "before-title-review-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json"
    (folder / name).write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    psql(args, sql)
    print("COMMITTED: 64 title records VERIFIED with same-tool review provenance; no rule approvals changed.")


if __name__ == "__main__":
    main()
