#!/usr/bin/env python3
"""Nhập tên 64 quẻ có nguồn từ PDF gốc; không tự cấp VERIFIED.

Mặc định chỉ kiểm tra và sinh SQL. --apply sao lưu bản ghi liên quan rồi
ghi transaction vào PostgreSQL; yêu cầu Flyway V3 và 64 cấu trúc đã tồn tại.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from import_book_knowledge import BOOKS, TRIGRAMS, book_id, find_psql, quote

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/hexagram_names.csv"
SOURCE_SHA = "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de"
EDITOR = "TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23"
NAME_PAGES = {269: 276, 270: 277, 271: 278}
MAPPING_PAGE = 274
MAPPING_PRINTED = 281


def load_names(path: Path = DATA) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    for row in rows:
        for key in ("order", "pdf_page", "printed_page"):
            row[key] = int(row[key])
        row["code"] = f"H_{row['upper']}_{row['lower']}"
    codes = {code for code, *_ in TRIGRAMS}
    if len(rows) != 64 or {r["order"] for r in rows} != set(range(1, 65)):
        raise ValueError("Tên quẻ phải đủ đúng 64 số thứ tự, không trùng.")
    if {(r["upper"], r["lower"]) for r in rows} != {(u, l) for u in codes for l in codes}:
        raise ValueError("Thiếu hoặc trùng cặp thượng/hạ quái.")
    if len({r["name"] for r in rows}) != 64 or any(not r["name"].strip() for r in rows):
        raise ValueError("Tên quẻ thiếu hoặc trùng; cần phân biệt Bĩ/Bí, Càn/Cấn, Ly/Lý.")
    for row in rows:
        page = 269 if row["order"] <= 3 else 270 if row["order"] <= 40 else 271
        if row["pdf_page"] != page or row["printed_page"] != NAME_PAGES[page]:
            raise ValueError(f"Trang nguồn không đúng vùng danh sách: {row['code']}")
    return sorted(rows, key=lambda row: row["order"])


def verify_pdf(pdf_dir: Path) -> None:
    path = pdf_dir / BOOKS["MH"]["filename"]
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != SOURCE_SHA:
        raise ValueError("PDF khác bản đã chép tên; phải đối chiếu lại trang trước khi nhập.")


def build_sql(rows: list[dict]) -> str:
    trigrams = {code: [bool(n) for n in lines] for code, _, _, _, lines in TRIGRAMS}
    sql = ["BEGIN;", "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';",
           "LOCK TABLE hexagrams, source_sections IN SHARE ROW EXCLUSIVE MODE;",
           "CREATE TEMP TABLE name_import (code text PRIMARY KEY, name text, upper_code text, "
           "lower_code text, lines boolean[], pdf integer, label text) ON COMMIT DROP;"]
    values = []
    for row in rows:
        lines = trigrams[row["lower"]] + trigrams[row["upper"]]
        values.append("(" + ",".join(map(quote, [row["code"], row["name"], row["upper"], row["lower"]]))
                      + ",ARRAY[" + ",".join("true" if n else "false" for n in lines) + "]::boolean[],"
                      + f"{row['pdf_page']},{quote('MH-64-QUE-NAMES-' + str(row['printed_page']))})")
    sql.append("INSERT INTO name_import VALUES\n" + ",\n".join(values) + ";")
    sql.append(f"""DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM source_books WHERE id={book_id('MH')}
 AND file_sha256={quote(SOURCE_SHA)} AND pdf_page_count=672) THEN
 RAISE EXCEPTION 'Source PDF edition/hash mismatch'; END IF;
IF (SELECT count(*) FROM name_import n JOIN hexagrams h USING(code)
 WHERE h.upper_trigram_code=n.upper_code AND h.lower_trigram_code=n.lower_code
 AND h.lines_bottom_up=n.lines) <> 64 THEN
 RAISE EXCEPTION 'Expected all 64 existing structures with matching lines'; END IF;
END $$;""")
    for page, printed in NAME_PAGES.items():
        excerpt = (f"Danh sách tên 64 quẻ: trang in {printed}, PDF {page}. "
                   "Tên viết hoa đầu từ; giữ dấu phân biệt Bĩ/Bí, Càn/Cấn, Ly/Lý. "
                   "Cặp thượng/hạ đối chiếu sơ đồ PDF 274, trang in 281. "
                   "Nguồn kiểm bổ sung: danh sách PDF 500-501, trang in 509-510. "
                   "Chưa có xác nhận độc lập TV2 cho bộ tên.")
        sql.append("INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) "
                   f"VALUES ({book_id('MH')},{quote('MH-64-QUE-NAMES-' + str(printed))},"
                   f"{quote(str(printed))},{page},{quote(excerpt)}) "
                   "ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;")
    sql.append("INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) "
               f"VALUES ({book_id('MH')},'MH-64-QUE-DIAGRAM','281',274,"
               "'Sơ đồ 64 quẻ hình tròn và hình vuông: đối chiếu tên với hình sáu hào; cần TV2 review độc lập.') "
               "ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;")
    sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM source_sections WHERE source_book_id={book_id('MH')}
 AND ((section_label='MH-64-QUE-NAMES-276' AND pdf_page=269 AND printed_page_label='276')
   OR (section_label='MH-64-QUE-NAMES-277' AND pdf_page=270 AND printed_page_label='277')
   OR (section_label='MH-64-QUE-NAMES-278' AND pdf_page=271 AND printed_page_label='278')
   OR (section_label='MH-64-QUE-DIAGRAM' AND pdf_page=274 AND printed_page_label='281'))) <> 4 THEN
 RAISE EXCEPTION 'Existing source page metadata differs from reviewed manifest'; END IF;
IF EXISTS (
 SELECT 1 FROM hexagrams h JOIN name_import n USING(code)
 WHERE (
  (h.name_kind='STRUCTURAL_LABEL' AND h.verification_status='DRAFT'
   AND h.source_section_id IS NULL AND h.reviewer IS NULL AND h.editor='TV3_STRUCTURE_SEED'
   AND h.name=(SELECT '[CẤU TRÚC] ' || u.name || ' trên ' || l.name
    FROM trigrams u JOIN trigrams l ON l.code=h.lower_trigram_code
    WHERE u.code=h.upper_trigram_code))
  OR (h.name_kind='CANONICAL_TITLE' AND h.name=n.name AND h.source_section_id IN (
   SELECT s.id FROM source_sections s WHERE s.source_book_id={book_id('MH')}
    AND s.section_label=n.label AND s.pdf_page=n.pdf)
   AND (h.verification_status='VERIFIED' AND h.reviewer IS NOT NULL
     OR h.verification_status='SOURCE_LOCATED' AND h.reviewer IS NULL AND h.editor={quote(EDITOR)}))
 ) IS NOT TRUE) THEN RAISE EXCEPTION 'Protected or manually changed names: review before overwriting'; END IF;
END $$;
UPDATE hexagrams h SET name=n.name, name_kind='CANONICAL_TITLE',
 source_section_id=s.id, verification_status='SOURCE_LOCATED', editor={quote(EDITOR)}
FROM name_import n JOIN source_sections s ON s.source_book_id={book_id('MH')}
 AND s.section_label=n.label AND s.pdf_page=n.pdf
WHERE h.code=n.code AND h.name_kind='STRUCTURAL_LABEL' AND h.verification_status='DRAFT'
 AND h.reviewer IS NULL AND h.editor='TV3_STRUCTURE_SEED';
DO $$ BEGIN
IF (SELECT count(*) FROM name_import n JOIN hexagrams h USING(code)
 JOIN source_sections s ON s.id=h.source_section_id
 WHERE h.name=n.name AND h.name_kind='CANONICAL_TITLE' AND s.pdf_page=n.pdf
 AND s.section_label=n.label AND s.source_book_id={book_id('MH')}
 AND h.verification_status IN ('SOURCE_LOCATED','VERIFIED')) <> 64 THEN
 RAISE EXCEPTION 'Final name/source validation failed'; END IF;
END $$;
COMMIT;""")
    return "\n".join(sql) + "\n"


def psql(args, statement: str) -> str:
    result = subprocess.run(
        [find_psql(args.psql), "-X", "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
         "-h", args.host, "-p", str(args.port), "-U", args.user, "-d", args.database],
        input=statement, text=True, encoding="utf-8", capture_output=True, timeout=90,
        env=dict(os.environ, PGCLIENTENCODING="UTF8", PGCONNECT_TIMEOUT="10"))
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--sql-output", type=Path, default=ROOT / "scripts/generated/hexagram_names.sql")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    try:
        rows = load_names()
        verify_pdf(args.pdf_dir)
        sql = build_sql(rows)
        args.sql_output.parent.mkdir(parents=True, exist_ok=True)
        args.sql_output.write_text(sql, encoding="utf-8")
        print(f"Đã chuẩn bị 64 tên / 64 cặp quái, có trang nguồn: {args.sql_output}")
        if not args.apply:
            print("DRY RUN: chưa ghi database; các tên chưa được TV2 xác nhận VERIFIED.")
            return 0
        if not os.environ.get("PGPASSWORD"):
            raise RuntimeError("Thiếu PGPASSWORD; dùng scripts/import_hexagram_names.ps1 để nhập mật khẩu ẩn.")
        backup = psql(args, "BEGIN READ ONLY; SELECT json_build_object('hexagrams',"
                      "(SELECT json_agg(h ORDER BY code) FROM hexagrams h), 'source_sections',"
                      "(SELECT json_agg(s ORDER BY id) FROM source_sections s))::text; COMMIT;")
        payload = json.loads(backup)
        folder = ROOT / "scripts/generated/db-backups"
        folder.mkdir(parents=True, exist_ok=True)
        destination = folder / ("before-hexagram-names-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")
        destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã sao lưu trước cập nhật: {destination}")
        psql(args, sql)
        print("Đã kiểm/nhập 64 tên có nguồn; bản ghi VERIFIED hiện có được giữ nguyên.")
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        print(f"Chưa hoàn tất nhập tên quẻ: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
