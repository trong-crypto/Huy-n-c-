#!/usr/bin/env python3
"""Kiểm toán dữ liệu TV3: đối chiếu bộ seed và tùy chọn đọc PostgreSQL.

Không ghi vào database, không tự cấp trạng thái VERIFIED. Nếu kiểm toán DB,
PGPASSWORD phải được cấp qua biến môi trường (xem audit_tv3.ps1).
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys

from import_book_knowledge import (
    BOOKS, HOUR_ANCHORS, HOUR_SOURCE, JOB_TABLE, RULES, SECTIONS, TRIGRAMS,
    find_psql, read_books, validate_seed_data,
)
from import_hexagram_names import load_names, SOURCE_SHA
import import_tam_the_year_elements as year_source


ROOT = Path(__file__).resolve().parents[1]
BRANCHES = ("DAN", "MAO", "THIN", "TI", "NGO", "MUI",
            "THAN", "DAU", "TUAT", "HOI", "TY", "SUU")


def minute_value(hhmm: str) -> int:
    hour, minute = (int(n) for n in hhmm.split(":")[:2])
    if not (0 <= hour < 24 and 0 <= minute < 60):
        raise ValueError(f"Giờ không hợp lệ: {hhmm}")
    return hour * 60 + minute


def tam_the_branch(first_hour_start: str, hhmm: str) -> str:
    """Kiểm toán thứ tự 12 Chi theo mốc Số 5; chưa phải API luận giải."""
    minutes_from_start = (minute_value(hhmm) - minute_value(first_hour_start)) % 1440
    return BRANCHES[minutes_from_start // 120]


class Audit:
    def __init__(self) -> None:
        self.findings: list[tuple[str, str, str]] = []

    def check(self, name: str, condition: bool, details: str = "") -> None:
        self.findings.append(("PASS" if condition else "FAIL", name, details))

    def note(self, name: str, details: str) -> None:
        self.findings.append(("PENDING", name, details))

    def report(self, output: Path, live: bool) -> bool:
        title = "Kiểm toán TV3 — PostgreSQL và đối chiếu nguồn" if live else "Kiểm toán TV3 — chỉ kiểm bộ seed cục bộ"
        lines = [f"# {title}", "", f"- Ngày: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
                 "- Chương trình chỉ đọc; không sửa database và không cấp trạng thái VERIFIED.",
                 "- Nguồn: hai PDF người dùng cung cấp; xem `docs/12-TV3-SOURCE-REVIEW.md`.", "",
                 "| Kết quả | Nội dung | Chi tiết |", "| --- | --- | --- |"]
        for level, name, details in self.findings:
            safe = lambda s: s.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {level} | {safe(name)} | {safe(details)} |")
        failed = sum(level == "FAIL" for level, _, _ in self.findings)
        pending = sum(level == "PENDING" for level, _, _ in self.findings)
        lines += ["", f"**Tổng:** {len(self.findings)} kiểm tra, **{failed} FAIL**, **{pending} PENDING**.",
                  "", "`PENDING` biểu thị dữ liệu chưa nhập/thiếu người kiểm chứng, không đồng nghĩa phép thử thất bại.", ""]
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("\n".join(lines), encoding="utf-8")
        print(f"Kết quả: {output} | FAIL={failed} | PENDING={pending}")
        return failed == 0


def audit_seed(audit: Audit, pdf_dir: Path) -> None:
    validate_seed_data()
    read_books(pdf_dir)
    audit.check("Hai PDF được mở và có SHA-256", len(BOOKS) == 2 and
                all(len(str(book.get("sha256", ""))) == 64 for book in BOOKS.values()),
                "Mai Hoa 672 trang; Tam Thế 360 trang (số trang được đối chiếu khi có pdfinfo).")
    audit.check("Bộ seed 104 bản ghi", (len(BOOKS), len(SECTIONS), len(RULES),
                len(TRIGRAMS), len(HOUR_ANCHORS), sum(len(months)
                for _, table in JOB_TABLE.values() for months in table.values()))
                == (2, 17, 14, 8, 12, 51))
    audit.check("Quy tắc nhập không tự duyệt VERIFIED", all(row[2] != "VERIFIED" for row in RULES))
    expected_pages = {
        1: ("04:20", 12), 2: ("04:00", 12), 3: ("04:30", 13),
        4: ("04:40", 13), 5: ("05:20", 14), 6: ("04:40", 13),
        7: ("04:30", 13), 8: ("04:00", 12), 9: ("04:20", 12),
        10: ("04:00", 15), 11: ("03:40", 14), 12: ("04:00", 15),
    }
    audit.check("12 mốc giờ khớp trang Tam Thế 12–15", all(
        start == expected_pages[month][0] and HOUR_SOURCE[month][1] == expected_pages[month][1]
        for month, start, *_ in HOUR_ANCHORS))
    audit.check("Lưu nguyên văn Dậu và quyết định Dần tháng 5", any(
        month == 5 and start == "05:20" and printed == "DAU" and adopted == "DAN"
        and decision == "TEAM_CORRECTION" and reason
        for month, start, printed, adopted, decision, reason in HOUR_ANCHORS))
    audit.check("Ranh tháng 5: 05:19 / 05:20 / 07:19 / 07:20",
                [tam_the_branch("05:20", moment) for moment in
                 ("05:19", "05:20", "07:19", "07:20")] == ["SUU", "DAN", "DAN", "MAO"])
    audit.check("12 Chi phủ 24 giờ, không chồng lấn", all(
        {tam_the_branch(start, f"{minute // 60:02d}:{minute % 60:02d}") for minute in range(1440)}
        == set(BRANCHES) for _, start, *_ in HOUR_ANCHORS))
    migration_v4 = ROOT / "server/src/main/resources/db/migration/V4__verify_tv2_reviewed_rules.sql"
    migration_text = migration_v4.read_text(encoding="utf-8") if migration_v4.is_file() else ""
    audit.check("Đã chuẩn bị xác nhận TV2: quẻ hỗ / quẻ biến",
                all(code in migration_text for code in ("MH-MUTUAL", "MH-CHANGE", "VERIFIED")),
                "Chủ dự án đã báo TV2 xác nhận; chỉ kiểm DB --live mới chứng minh Flyway V4 đã áp dụng.")
    audit.check("Đã chuẩn bị xác nhận TV2: giờ tháng 5",
                "lunar_month = 5" in migration_text and "source_branch = 'DAU'" in migration_text,
                "V4 duyệt ô tháng 5; vẫn bảo lưu bản in Dậu, chọn Dần. Chưa xác nhận DB ở lượt offline.")
    names = load_names()
    audit.check("Bộ tên 64 quẻ có nguồn và đủ cặp thượng/hạ", len(names) == 64 and
                BOOKS["MH"]["sha256"] == SOURCE_SHA,
                "Tên PDF 269–271 / trang in 276–278; sơ đồ PDF 274 / trang in 281. Chờ TV2 review.")


SQL = r"""
SELECT json_build_object(
  'counts', json_build_object(
    'source_books', (SELECT count(*) FROM source_books),
    'source_sections', (SELECT count(*) FROM source_sections),
    'calculation_rules', (SELECT count(*) FROM calculation_rules),
    'trigrams', (SELECT count(*) FROM trigrams),
    'tam_the_hour_anchors', (SELECT count(*) FROM tam_the_hour_anchors),
    'tam_the_lookup_entries', (SELECT count(*) FROM tam_the_lookup_entries),
    'hexagrams', (SELECT count(*) FROM hexagrams),
    'hexagram_lines', (SELECT count(*) FROM hexagram_lines),
    'interpretations', (SELECT count(*) FROM interpretations)),
  'books', (SELECT coalesce(json_agg(json_build_object('title',title,'sha',file_sha256)), '[]'::json) FROM source_books),
  'trigrams', (SELECT coalesce(json_agg(json_build_object('code',code,'number',heaven_number,
                 'element',element,'lines',lines_bottom_up)), '[]'::json) FROM trigrams),
  'hexagram_data', (SELECT coalesce(json_agg(json_build_object(
                'code',h.code,'upper',h.upper_trigram_code,'lower',h.lower_trigram_code,
                'lines',h.lines_bottom_up,'name_kind',to_jsonb(h)->>'name_kind',
                'status',h.verification_status,'name',h.name,'source',h.source_section_id,
                'pdf',s.pdf_page,'printed',s.printed_page_label,'label',s.section_label,
                'book_sha',b.file_sha256,'reviewer',h.reviewer,
                'reviewed_at',to_jsonb(h)->>'reviewed_at',
                'verification_note',to_jsonb(h)->>'verification_note')), '[]'::json)
                FROM hexagrams h LEFT JOIN source_sections s ON s.id=h.source_section_id
                LEFT JOIN source_books b ON b.id=s.source_book_id),
  'hexagram_mapping_sources', (SELECT coalesce(json_agg(json_build_object(
                'pdf',s.pdf_page,'printed',s.printed_page_label,'book_sha',b.file_sha256)), '[]'::json)
                FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
                WHERE s.section_label='MH-64-QUE-DIAGRAM'),
  'hexagram_line_data', (SELECT coalesce(json_agg(json_build_object(
                'code',hexagram_code,'line',line_number,'yang',is_yang)), '[]'::json)
                FROM hexagram_lines),
  'anchors', (SELECT coalesce(json_agg(json_build_object('month', lunar_month,
                'start', to_char(first_hour_start,'HH24:MI'), 'source',source_branch,
                'adopted',adopted_branch,'decision',decision_status,
                'reason',decision_reason,'pdf',s.pdf_page,'status',verification_status,
                'reviewer',reviewer,'reviewed_at',to_jsonb(a)->>'reviewed_at') ORDER BY lunar_month), '[]'::json)
                FROM tam_the_hour_anchors a JOIN source_sections s ON a.source_section_id=s.id),
  'jobs', (SELECT coalesce(json_agg(json_build_object('key',e.lookup_key,'code',e.result_code,
                'status',e.verification_status, 'reviewer',e.reviewer,
                'pdf',s.pdf_page)), '[]'::json)
                FROM tam_the_lookup_entries e JOIN source_sections s ON e.source_section_id=s.id
                JOIN calculation_rules r ON r.id=e.rule_id
                WHERE r.module='TAM_THE' AND r.rule_code='TT-CONG-DANH-11' AND r.rule_version='1.0'),
  'year_elements', (SELECT coalesce(json_agg(json_build_object('key',e.lookup_key,'code',e.result_code,
                'title',e.title,'description',e.description,'status',e.verification_status,
                'editor',e.editor,'reviewer',e.reviewer,'reviewed_at',to_jsonb(e)->>'reviewed_at',
                'verification_note',to_jsonb(e)->>'verification_note','pdf',s.pdf_page,
                'printed',s.printed_page_label,'label',s.section_label,'book_sha',b.file_sha256)), '[]'::json)
                FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
                JOIN source_sections s ON s.id=e.source_section_id JOIN source_books b ON b.id=s.source_book_id
                WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'),
  'rules', (SELECT coalesce(json_agg(json_build_object('code',rule_code,'module',module,
                 'status',verification_status,'source',source_section_id,
                 'reviewer',to_jsonb(r)->>'reviewer',
                 'reviewed_at',to_jsonb(r)->>'reviewed_at',
                 'verification_note',to_jsonb(r)->>'verification_note',
                 'pdf',s.pdf_page,'printed',s.printed_page_label,'label',s.section_label,
                 'book_sha',b.file_sha256)), '[]'::json)
                 FROM calculation_rules r LEFT JOIN source_sections s ON s.id=r.source_section_id
                 LEFT JOIN source_books b ON b.id=s.source_book_id),
  'migrations', (SELECT coalesce(json_agg(version ORDER BY installed_rank), '[]'::json)
                 FROM flyway_schema_history WHERE success=true)
)::text;
"""


def query_database(args: argparse.Namespace) -> dict:
    if not os.getenv("PGPASSWORD"):
        raise RuntimeError("Chưa có biến PGPASSWORD; dùng scripts/audit_tv3.ps1 để nhập mật khẩu ẩn.")
    command = [find_psql(args.psql), "-X", "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
               "-h", args.host, "-p", str(args.port), "-U", args.user, "-d", args.database]
    completed = subprocess.run(command, input="BEGIN READ ONLY;\n" + SQL + "\nCOMMIT;\n",
                               capture_output=True, encoding="utf-8", text=True, timeout=30,
                               env=dict(os.environ, PGCLIENTENCODING="UTF8"))
    if completed.returncode:
        raise RuntimeError("psql trả lỗi: " + completed.stderr.strip()[:600])
    for line in completed.stdout.splitlines():
        if line.startswith("{"):
            return json.loads(line)
    raise RuntimeError("Không nhận được JSON từ truy vấn kiểm toán.")


def audit_year_elements(audit: Audit, db: dict) -> None:
    rows = db.get("year_elements", [])
    rules = [r for r in db["rules"] if r["module"] == "TAM_THE" and r["code"] == "TT-NGU-HANH"]
    if not rows and not any(r["status"] == "VERIFIED" for r in rules):
        return
    expected = {year_source.entry_key(r): r for r in year_source.load_records()}
    audit.check("S02 đủ 60 Can Chi/hành và trang nguồn", len(rows) == 60 and len({r["key"] for r in rows}) == 60
                and all(r["key"] in expected and r["code"] == expected[r["key"]]["element"]
                        and r.get("title") == year_source.title(expected[r["key"]]) and r.get("description") is None
                        and (r.get("pdf"), r.get("printed"), r.get("label"), r.get("book_sha"))
                        == (11, "12", "TT-NGU-HANH", year_source.SOURCE_SHA) for r in rows))
    audit.check("S02 từng ô VERIFIED có biên bản đúng phạm vi", len(rows) == 60 and all(
        r["key"] in expected and r["status"] == "VERIFIED" and r.get("reviewer") == year_source.REVIEWER
        and r.get("editor") == year_source.EDITOR and bool(r.get("reviewed_at"))
        and r.get("verification_note") == year_source.entry_note(expected[r["key"]]) for r in rows))
    audit.check("S02 TT-NGU-HANH VERIFIED có nguồn/biên bản", len(rules) == 1 and all(
        r["status"] == "VERIFIED" and r.get("reviewer") == year_source.REVIEWER and bool(r.get("reviewed_at"))
        and r.get("verification_note") == year_source.RULE_NOTE
        and (r.get("pdf"), r.get("printed"), r.get("label"), r.get("book_sha"))
        == (11, "12", "TT-NGU-HANH", year_source.SOURCE_SHA) for r in rules))
    audit.check("S02 migration V6 metadata ô tra cứu", "6" in db["migrations"])


def audit_database(audit: Audit, db: dict) -> None:
    counts = db["counts"]
    baseline = {"source_books": 2, "source_sections": 17, "calculation_rules": 14,
                "trigrams": 8, "tam_the_hour_anchors": 12, "tam_the_lookup_entries": 51}
    for table, expected in baseline.items():
        audit.check("DB " + table, counts[table] >= expected, f"Có {counts[table]}, tối thiểu {expected}")
    audit.check("Flyway V1/V2 đã được áp dụng", {"1", "2"}.issubset(set(db["migrations"])),
                "Migration: " + ", ".join(db["migrations"]))
    expected_shas = {info["title"]: info["sha256"] for info in BOOKS.values()}
    audit.check("PDF database khớp nội dung tệp đang dùng", all(
        expected_shas.get(book["title"]) == book["sha"] for book in db["books"])
        and len(db["books"]) == len(expected_shas))
    trigram_expected = {code: (number, element, [bool(n) for n in lines])
                        for code, _, number, element, lines in TRIGRAMS}
    audit.check("Trigram code/số/hành/hào khớp seed", len(db["trigrams"]) == 8 and all(
        trigram_expected.get(row["code"]) == (row["number"], row["element"], row["lines"])
        for row in db["trigrams"]))
    anchor_expected = {month: (start, printed, adopted, decision, HOUR_SOURCE[month][1])
                       for month, start, printed, adopted, decision, _ in HOUR_ANCHORS}
    audit.check("DB lưu đúng toàn bộ 12 mốc, nguồn và sửa tháng 5",
                len(db["anchors"]) == 12 and all(
                    anchor_expected.get(row["month"]) == (row["start"], row["source"],
                    row["adopted"], row["decision"], row["pdf"])
                    for row in db["anchors"]))
    month5 = [row for row in db["anchors"] if row["month"] == 5]
    audit.check("Xác nhận TV2 VERIFIED mốc tháng 5, vẫn giữ chữ Dậu", len(month5) == 1 and
                month5[0]["status"] == "VERIFIED" and
                str(month5[0].get("reviewer") or "").startswith("TV2") and
                bool(month5[0].get("reviewed_at")) and
                (month5[0]["source"], month5[0]["adopted"], month5[0]["decision"])
                == ("DAU", "DAN", "TEAM_CORRECTION"))
    expected_jobs = {(f"ELEMENT:{element}|MONTH:{month:02d}", code)
                     for code, (_, table) in JOB_TABLE.items() for element, months in table.items()
                     for month in months}
    audit.check("51 ô công danh khớp khóa/loại nghề và nguồn trang 32",
                len(db["jobs"]) == 51 and
                {(row["key"], row["code"]) for row in db["jobs"]} == expected_jobs and
                all(row["pdf"] == 32 for row in db["jobs"]))
    audit.check("Không VERIFIED thiếu người review ở ô nghề / mốc giờ", all(
        row["status"] != "VERIFIED" or bool(row["reviewer"])
        for row in db["jobs"] + db["anchors"]))
    expected_rules = {(module, code) for module, code, *_ in RULES}
    audit.check("14 mã quy tắc bắt buộc có mặt", expected_rules.issubset(
        {(row["module"], row["code"]) for row in db["rules"]}))
    maihoa_rules = [row for row in db["rules"] if
                    row["module"] == "MAI_HOA" and row["code"] in ("MH-MUTUAL", "MH-CHANGE")]
    audit.check("Xác nhận TV2 VERIFIED hai quy tắc Mai Hoa",
                len(maihoa_rules) == 2 and all(
                    row["status"] == "VERIFIED" and row["source"] is not None and
                    str(row.get("reviewer") or "").startswith("TV2") and
                    bool(row.get("reviewed_at")) for row in maihoa_rules))
    tam_the_rules = [row for row in db["rules"] if
                     row["module"] == "TAM_THE" and row["code"] == "TT-GIO-SINH"]
    audit.check("Quy tắc toàn bộ 12 tháng chưa bị nâng VERIFIED",
                len(tam_the_rules) == 1 and tam_the_rules[0]["status"] == "BLOCKED_SOURCE_CONFLICT")
    trigram_rules = [r for r in db["rules"] if r["module"] == "MAI_HOA" and r["code"] == "MH-TRIGRAM"]
    if any(r["status"] == "VERIFIED" for r in trigram_rules):
        audit.check("MH-TRIGRAM VERIFIED có metadata và nguồn đúng", len(trigram_rules) == 1 and all(
            bool(r.get("reviewer")) and bool(r.get("reviewed_at")) and bool(r.get("verification_note"))
            and (r.get("pdf"), r.get("printed"), r.get("label"), r.get("book_sha"))
            == (39, "44", "MH-QUAI-SO", SOURCE_SHA) for r in trigram_rules))
    object_rules = [r for r in db["rules"] if r["module"] == "MAI_HOA" and r["code"] == "MH-OBJECT-COUNT"]
    audit.check("OBJECT_COUNT vẫn giữ trạng thái nguồn đa nghĩa", len(object_rules) == 1
                and object_rules[0]["status"] == "SOURCE_AMBIGUOUS")
    audit.check("Flyway V4 đã áp dụng", "4" in db["migrations"])
    for table, expected in (("hexagrams", 64), ("hexagram_lines", 384)):
        if counts[table] < expected:
            audit.note(f"Còn thiếu {table}", f"Hiện có {counts[table]}/{expected}; đây là task TV3 kế tiếp.")
    if counts["hexagrams"] >= 64 and counts["hexagram_lines"] >= 384:
        trigram_lines = {code: [bool(n) for n in lines]
                         for code, _, _, _, lines in TRIGRAMS}
        pairs = {(upper, lower) for upper in trigram_lines for lower in trigram_lines}
        rows = db["hexagram_data"]
        by_code = {row["code"]: row for row in rows}
        lines_by_code: dict[str, dict[int, bool]] = {}
        for row in db["hexagram_line_data"]:
            lines_by_code.setdefault(row["code"], {})[row["line"]] = row["yang"]
        all_pairs = {(row["upper"], row["lower"]) for row in rows}
        structure_valid = (len(rows) == 64 and len(by_code) == 64 and
                           len(db["hexagram_line_data"]) == 384 and all_pairs == pairs and
                           all(row["lines"] == trigram_lines[row["lower"]] + trigram_lines[row["upper"]]
                               and lines_by_code.get(row["code"]) == {
                                   i: value for i, value in enumerate(row["lines"], start=1)}
                               for row in rows if row["lower"] in trigram_lines and
                               row["upper"] in trigram_lines) and
                           all(row["lower"] in trigram_lines and row["upper"] in trigram_lines
                               for row in rows))
        audit.check("64 tổ hợp và 384 hào khớp 8 quái", structure_valid,
                    "Mỗi quẻ gồm hạ quái ở hào 1–3 và thượng quái ở hào 4–6.")
        audit.check("Migration V3 về nguồn/tên quẻ", "3" in db["migrations"])
        named = [row for row in rows if row.get("name_kind") == "CANONICAL_TITLE"]
        if named:
            expected_names = {row["code"]: row for row in load_names()}
            def matching_name(row):
                expected = expected_names.get(row["code"])
                return expected is not None and row.get("name") == expected["name"] and (
                    row.get("pdf"), row.get("printed"), row.get("label"), row.get("book_sha")) == (
                    expected["pdf_page"], str(expected["printed_page"]),
                    "MH-64-QUE-NAMES-" + str(expected["printed_page"]), SOURCE_SHA) and (
                    row.get("status") in ("SOURCE_LOCATED", "VERIFIED")) and (
                    row.get("status") != "VERIFIED" or (
                        bool(row.get("reviewer")) and bool(row.get("reviewed_at"))
                        and bool(row.get("verification_note"))))
            audit.check("64 tên quẻ và trang nguồn khớp bộ chép sách",
                        len(named) == 64 and all(matching_name(row) for row in named))
            audit.check("Có nguồn sơ đồ đối chiếu tên / hình hào", any(
                (source.get("pdf"), source.get("printed"), source.get("book_sha")) ==
                (274, "281", SOURCE_SHA) for source in db.get("hexagram_mapping_sources", [])))
        if any(row.get("name_kind") == "STRUCTURAL_LABEL" or row.get("status") != "VERIFIED"
               for row in rows):
            details = ("Đã nhập đủ 64 tên có nguồn; chờ TV2 đối chiếu độc lập."
                       if len(named) == 64 else "Đã có cấu trúc hào; còn thiếu tên truyền thống, trang nguồn và review độc lập.")
            audit.note("64 tên quẻ chưa VERIFIED", details)
    if counts["interpretations"] == 0:
        audit.note("Chưa có lời giải 64 quẻ", "Bảng interpretations còn trống; không sinh luận giải giả.")
    audit_year_elements(audit, db)
    remaining = [] if len(db.get("year_elements", [])) == 60 else ["60 Can Chi"]
    remaining.extend(["120 ô Số 13", "36 phần giờ", "tài lộc", "tình duyên"])
    audit.note("Bảng Tam Thế còn thiếu", ", ".join(remaining) + "; cần nhập có trang nguồn và review. 51 ô Số 11 và 11 mốc giờ còn cần kiểm chéo.")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Đọc và so sánh dữ liệu PostgreSQL")
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    audit = Audit()
    try:
        audit_seed(audit, args.pdf_dir)
        if args.live:
            audit_database(audit, query_database(args))
        output = args.output or ROOT / "scripts/generated" / (
            "tv3_audit_report.md" if args.live else "tv3_seed_audit_report.md")
        return 0 if audit.report(output, args.live) else 1
    except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        print(f"Kiểm toán chưa hoàn tất: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
