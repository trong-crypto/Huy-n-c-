"""D01 source-checked career tables; explicit import/review, guarded and repeatable."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

from import_book_knowledge import ROOT, JOB_TABLE, RULES, book_id, quote
from import_hexagram_names import psql
from import_tam_the_year_elements import STEMS, verify_pdf, SOURCE_SHA

MANIFEST = ROOT / "data/tam_the_career_review.json"
MANIFEST_SHA = "75796fa31699edb035d84c8c69242c649150c5f3ddd49b30b4fd435b8657a252"
EDITOR = "TV3_AI_CAREER_SOURCE_D01_2026_10_24"
REVIEWER = "Codex career review 2026-10-24 (same-tool second pass)"
CODES = ("TT-CONG-DANH-11", "TT-CONG-DANH-13")
RULE_NOTES = {
    CODES[0]: "D01 PDF32/print33: all 51 positive occupation-month incidences reviewed twice; THUY/CAU_CHAI month8 corrects legacy month9. No-match is not a negative prediction. Same-tool review, not independent human TV2. Scope=CAREER11_TABLE; docs/25-D01-CAREER-DATA.md.",
    CODES[1]: "D01 PDF35-36/print36-37: all 120 stem-month cells and 12 literal passages reviewed twice. Four differing table/passage headings are kept separately and linked by source ordinal (not asserted identical spelling). Source table lookup, no plus-stem shortcut. Same-tool review, not independent human TV2. Scope=CAREER13_TABLE_AND_TRANSCRIPTION; docs/25-D01-CAREER-DATA.md.",
}
DESCRIPTIONS = {
    CODES[0]: "Số 11: tra mọi nghề có giao điểm hành mệnh + tháng âm tại PDF32/in33; 51 giao điểm đã kiểm nguồn D01.",
    CODES[1]: "Số 13 nghề: tra tháng trong hàng Can năm âm tại PDF35/in36; 120 ô và 12 đoạn PDF35-36. Giữ riêng nhãn cột/đoạn và liên kết theo vị trí D01.",
}
LEGACY_DESCRIPTIONS = {r[1]: r[-1] for r in RULES if r[1] in CODES}
SOURCE_PAGES = {32: ("TT-CONG-DANH-11", "33"), 35: ("TT-CONG-DANH-13", "36"),
                36: ("TT-CONG-DANH-13-TEXT", "37")}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text_hash(contents):
    return hashlib.sha256(contents.encode("utf-8")).hexdigest()


def load_records(folder=ROOT / "data"):
    folder = Path(folder)
    manifest_text = (folder / MANIFEST.name).read_text(encoding="utf-8")
    require(text_hash(manifest_text) == MANIFEST_SHA, "D01 review manifest changed; a new visual review is required")
    manifest = json.loads(manifest_text)
    require(manifest["pdfSha256"] == SOURCE_SHA and manifest["reviewer"] == REVIEWER, "Wrong D01 review source/reviewer")
    files = {}
    for relative, expected in manifest["files"].items():
        contents = (folder / Path(relative).name).read_text(encoding="utf-8")
        require(text_hash(contents) == expected, f"D01 source/review file changed: {relative}")
        files[Path(relative).name] = list(csv.DictReader(io.StringIO(contents)))
    lists = files["tam_the_career11_source.csv"]
    second = files["tam_the_career11_review.csv"]
    require(len(lists) == 15 and len(second) == 5, "Expected 15 source lists and five reviewed element rows")
    checked = {(r["element"], code): {int(m) for m in r[field].split(";")}
               for r in second for code, field in (("MUA_BAN", "mua_ban"), ("CAU_CHAI", "cau_chai"), ("LAM_THO", "lam_tho"))}
    entries = []
    for row in lists:
        code, element = row["occupation"], row["element"]
        months = [int(m) for m in row["months_printed"].split(";")]
        require((row["pdf_page"], row["printed_page"]) == ("32", "33")
                and len(months) == len(set(months)) and all(1 <= m <= 12 for m in months), "Invalid S11 source cell")
        require(set(months) == checked[(element, code)] == set(JOB_TABLE[code][1][element]), "S11 source, second pass or seed mismatch")
        for month in months:
            entries.append(dict(rule=CODES[0], key=f"ELEMENT:{element}|MONTH:{month:02d}", code=code,
                                title=JOB_TABLE[code][0], content=None, table_page=32,
                                content_page=None, table_label=None, heading=None,
                                note=f"PDF32/print33; {element}/{code}; month={month}; " + RULE_NOTES[CODES[0]]))
    require(len(entries) == 51 and len({(e["key"], e["code"]) for e in entries}) == 51, "Expected 51 distinct S11 incidences")
    matrix = files["tam_the_career13_matrix.csv"]
    columns = files["tam_the_career13_column_review.csv"]
    passages = files["tam_the_career13_texts.csv"]
    require(len(matrix) == 10 and tuple(r["stem"] for r in matrix) == STEMS, "Expected ten stem rows in source order")
    require(len(columns) == len(passages) == 12, "Expected 12 reviewed columns/passages")
    for index, (column, passage, reviewed) in enumerate(zip(columns, passages, manifest["passages"], strict=True), 1):
        require(column["column"] == passage["column"] == str(index)
                and column["table_label"] == passage["table_label"], "Column/heading identity mismatch")
        require(passage["result_code"] == f"CAREER13_C{index:02d}"
                and passage["pdf_page"] == str(35 if index <= 3 else 36)
                and int(passage["printed_page"]) == int(passage["pdf_page"]) + 1, "Wrong passage location")
        require(reviewed["contentSha256"] == text_hash(passage["content"])
                and reviewed["heading"] == passage["content_heading"]
                and reviewed["linkBasis"] == passage["link_basis"], "Passage differs from reviewed text/link")
        values = [int(m) for m in column["months_giap_to_quy"].split(";")]
        require(len(values) == 10, "Missing source column cells")
        for row_index, row in enumerate(matrix):
            month = int(row[f"c{index:02d}"])
            require((row["pdf_page"], row["printed_page"]) == ("35", "36")
                    and month == values[row_index] and 1 <= month <= 12, "S13 row/column source review mismatch")
            require((month - 1 - row_index) % 12 == index - 1, "Source table disagrees with inverse lookup check")
            entries.append(dict(rule=CODES[1], key=f"STEM:{row['stem']}|MONTH:{month:02d}",
                                code=passage["result_code"], title=passage["table_label"], content=passage["content"],
                                table_page=35, content_page=int(passage["pdf_page"]), table_label=passage["table_label"],
                                heading=passage["content_heading"], note=f"PDF35/print36 row={row_index+1} col={index}; "
                                f"passagePDF={passage['pdf_page']}; link={passage['link_basis']}; " + RULE_NOTES[CODES[1]]))
    require(len(entries) == 171 and len({(e["rule"], e["key"], e["code"]) for e in entries}) == 171, "Duplicate/missing career cells")
    require(len({e["key"] for e in entries if e["rule"] == CODES[1]}) == 120, "S13 must cover every stem-month exactly once")
    return entries


def build_sql(entries, review=False):
    sql = ["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';",
           "LOCK TABLE tam_the_lookup_entries,calculation_rules,source_sections,source_books IN SHARE ROW EXCLUSIVE MODE;",
           "CREATE TEMP TABLE career_import(rule text,key text,code text,title text,content text,table_page int,"
           "content_page int,table_label text,heading text,note text,PRIMARY KEY(rule,key,code)) ON COMMIT DROP;"]
    sql.append("INSERT INTO career_import VALUES\n" + ",\n".join("(" + ",".join(quote(e[k]) for k in (
        "rule", "key", "code", "title", "content", "table_page", "content_page", "table_label", "heading", "note")) + ")" for e in entries) + ";")
    sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM source_books WHERE id={book_id('TT')} AND file_sha256={quote(SOURCE_SHA)} AND pdf_page_count=360)<>1
 THEN RAISE EXCEPTION 'D01 wrong source edition'; END IF;
IF EXISTS(SELECT 1 FROM source_sections WHERE source_book_id={book_id('TT')}
 AND section_label='TT-CONG-DANH-13-TEXT' AND (pdf_page<>36 OR printed_page_label IS DISTINCT FROM '37'
 OR excerpt IS DISTINCT FROM 'D01: literal career passages 4-12; table labels and passage headings retained separately.'))
 THEN RAISE EXCEPTION 'D01 protected passage source changed'; END IF;
END $$;
INSERT INTO source_sections(source_book_id,section_label,printed_page_label,pdf_page,excerpt)
 VALUES({book_id('TT')},'TT-CONG-DANH-13-TEXT','37',36,'D01: literal career passages 4-12; table labels and passage headings retained separately.')
 ON CONFLICT(source_book_id,section_label,pdf_page) DO NOTHING;
""")
    for code, page in ((CODES[0], 32), (CODES[1], 35)):
        label, printed = SOURCE_PAGES[page]
        sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 WHERE r.module='TAM_THE' AND r.rule_code={quote(code)} AND r.rule_version='1.0'
 AND s.source_book_id={book_id('TT')} AND s.section_label={quote(label)} AND s.pdf_page={page}
 AND s.printed_page_label={quote(printed)} AND (
 (r.verification_status='SOURCE_LOCATED' AND r.reviewer IS NULL AND r.reviewed_at IS NULL AND r.verification_note IS NULL
 AND r.description={quote(LEGACY_DESCRIPTIONS[code])}) OR
 (r.verification_status='VERIFIED' AND r.reviewer={quote(REVIEWER)} AND r.reviewed_at IS NOT NULL
 AND r.verification_note={quote(RULE_NOTES[code])} AND r.description={quote(DESCRIPTIONS[code])})))<>1
 THEN RAISE EXCEPTION 'D01 changed/protected career rule or source'; END IF;
END $$;""")
    # Only the exact unreviewed legacy typo may be removed/rekeyed.
    legacy = f"""r.rule_code='TT-CONG-DANH-11' AND e.lookup_key='ELEMENT:THUY|MONTH:09' AND e.result_code='CAU_CHAI'
 AND e.title={quote(JOB_TABLE['CAU_CHAI'][0])} AND e.description IS NULL AND e.editor='AUTO_FROM_DOCS'
 AND e.verification_status='SOURCE_LOCATED' AND e.reviewer IS NULL AND e.reviewed_at IS NULL AND e.verification_note IS NULL
 AND e.source_section_id=r.source_section_id AND e.content_source_section_id IS NULL
 AND e.source_table_label IS NULL AND e.source_content_heading IS NULL"""
    sql.append(f"""DO $$ BEGIN
IF EXISTS(SELECT 1 FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 LEFT JOIN career_import n ON n.rule=r.rule_code AND n.key=e.lookup_key AND n.code=e.result_code
 LEFT JOIN source_sections cs ON cs.id=e.content_source_section_id
 WHERE r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13')
 AND NOT coalesce(({legacy}),false) AND (n.key IS NULL
 OR e.title IS DISTINCT FROM n.title OR e.description IS DISTINCT FROM n.content
 OR e.source_section_id IS DISTINCT FROM r.source_section_id
 OR e.source_table_label IS DISTINCT FROM n.table_label OR e.source_content_heading IS DISTINCT FROM n.heading
 OR cs.pdf_page IS DISTINCT FROM n.content_page
 OR (n.content_page IS NOT NULL AND (cs.source_book_id IS DISTINCT FROM {book_id('TT')}
   OR cs.section_label IS DISTINCT FROM CASE WHEN n.content_page=35 THEN 'TT-CONG-DANH-13' ELSE 'TT-CONG-DANH-13-TEXT' END
   OR cs.printed_page_label IS DISTINCT FROM (n.content_page+1)::text))
 OR e.editor NOT IN ('AUTO_FROM_DOCS',{quote(EDITOR)}) OR e.editor IS NULL
 OR NOT ((e.verification_status='SOURCE_LOCATED' AND e.reviewer IS NULL AND e.reviewed_at IS NULL AND e.verification_note IS NULL)
 OR (e.verification_status='VERIFIED' AND e.reviewer={quote(REVIEWER)} AND e.reviewed_at IS NOT NULL AND e.verification_note=n.note))))
 THEN RAISE EXCEPTION 'D01 changed/protected career entry'; END IF;
END $$;""")
    if not review:
        sql.append(f"""DELETE FROM tam_the_lookup_entries e USING calculation_rules r
 WHERE e.rule_id=r.id AND r.module='TAM_THE' AND r.rule_version='1.0' AND ({legacy});
INSERT INTO tam_the_lookup_entries(rule_id,lookup_key,result_code,title,description,source_section_id,
 content_source_section_id,source_table_label,source_content_heading,verification_status,editor)
SELECT r.id,n.key,n.code,n.title,n.content,r.source_section_id,cs.id,n.table_label,n.heading,'SOURCE_LOCATED',{quote(EDITOR)}
 FROM career_import n JOIN calculation_rules r ON r.module='TAM_THE' AND r.rule_code=n.rule AND r.rule_version='1.0'
 LEFT JOIN source_sections cs ON cs.source_book_id={book_id('TT')} AND cs.pdf_page=n.content_page
 AND cs.section_label=CASE WHEN n.content_page=35 THEN 'TT-CONG-DANH-13' ELSE 'TT-CONG-DANH-13-TEXT' END
ON CONFLICT(rule_id,lookup_key,result_code) DO NOTHING;""")
    sql.append("""DO $$ BEGIN
IF (SELECT count(*) FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 JOIN career_import n ON n.rule=r.rule_code AND n.key=e.lookup_key AND n.code=e.result_code
 WHERE r.module='TAM_THE' AND r.rule_version='1.0')<>171
 OR (SELECT count(*) FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 WHERE r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13'))<>171
 THEN RAISE EXCEPTION 'D01 expected exactly 51+120 career entries before review'; END IF;
END $$;""")
    if review:
        sql.append(f"""UPDATE tam_the_lookup_entries e SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},
 reviewed_at=CURRENT_TIMESTAMP,verification_note=n.note FROM career_import n,calculation_rules r
 WHERE e.rule_id=r.id AND r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code=n.rule
 AND e.lookup_key=n.key AND e.result_code=n.code AND e.verification_status='SOURCE_LOCATED';""")
        for code in CODES:
            sql.append(f"""UPDATE calculation_rules SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},
 reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(RULE_NOTES[code])},description={quote(DESCRIPTIONS[code])}
 WHERE module='TAM_THE' AND rule_code={quote(code)} AND rule_version='1.0' AND verification_status='SOURCE_LOCATED';""")
    return "\n".join(sql) + "\nCOMMIT;\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--review", action="store_true")
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    entries = load_records()
    verify_pdf(args.pdf_dir)
    sql = build_sql(entries, args.review)
    folder = ROOT / "scripts/generated"
    folder.mkdir(exist_ok=True)
    (folder / ("d01_review.sql" if args.review else "d01_import.sql")).write_text(sql, encoding="utf-8")
    if not args.apply:
        print("DRY RUN: 51+120 career entries and 12 source passages checked; no DB writes.")
        return
    scope = "FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id WHERE r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13')"
    backup = json.loads(psql(args, "SELECT json_build_object('entries',(SELECT coalesce(json_agg(e),'[]'::json) "
                             + scope + "),'rules',(SELECT json_agg(r) FROM calculation_rules r WHERE module='TAM_THE' AND rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13')),'sources',(SELECT json_agg(s) FROM source_sections s WHERE section_label LIKE 'TT-CONG-DANH%'));"))
    backups = folder / "db-backups"
    backups.mkdir(exist_ok=True)
    (backups / ("before-d01-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")).write_text(
        json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    psql(args, sql)
    print("COMMITTED: " + ("171 career entries + two rules VERIFIED within D01 scope." if args.review
                            else "career tables imported; legacy THUY month9 corrected to month8; reviews preserved."))


if __name__ == "__main__":
    main()
