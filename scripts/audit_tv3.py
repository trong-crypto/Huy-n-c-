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
import import_tam_the_career as career_source
import verify_calendar_rule as calendar_source
import verify_time_decision as time_decision
import import_tam_the_d02 as d02_source
import import_hexagram_glosses as e01_source


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
                'reviewer',reviewer,'reviewed_at',to_jsonb(a)->>'reviewed_at',
                'verification_note',to_jsonb(a)->>'verification_note','label',s.section_label,
                'printed',s.printed_page_label,'book_sha',b.file_sha256) ORDER BY lunar_month), '[]'::json)
                FROM tam_the_hour_anchors a JOIN source_sections s ON a.source_section_id=s.id
                JOIN source_books b ON b.id=s.source_book_id),
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
  'career_entries', (SELECT coalesce(json_agg(json_build_object(
                'rule',r.rule_code,'key',e.lookup_key,'code',e.result_code,'title',e.title,'content',e.description,
                'table_page',s.pdf_page,'content_page',cs.pdf_page,
                'table_label',to_jsonb(e)->>'source_table_label','heading',to_jsonb(e)->>'source_content_heading',
                'note',to_jsonb(e)->>'verification_note','status',e.verification_status,
                'editor',e.editor,'reviewer',e.reviewer,'reviewed_at',to_jsonb(e)->>'reviewed_at',
                'book_sha',b.file_sha256,'printed',s.printed_page_label,'label',s.section_label,
                'content_book_sha',cb.file_sha256,'content_printed',cs.printed_page_label,'content_label',cs.section_label)), '[]'::json)
                FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
                JOIN source_sections s ON s.id=e.source_section_id JOIN source_books b ON b.id=s.source_book_id
                LEFT JOIN source_sections cs ON cs.id=(to_jsonb(e)->>'content_source_section_id')::bigint
                LEFT JOIN source_books cb ON cb.id=cs.source_book_id
                WHERE r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code IN('TT-CONG-DANH-11','TT-CONG-DANH-13')),
  'rules', (SELECT coalesce(json_agg(json_build_object('code',rule_code,'module',module,
                 'status',verification_status,'source',source_section_id,'external_id',to_jsonb(r)->>'external_source_id',
                 'reviewer',to_jsonb(r)->>'reviewer',
                 'reviewed_at',to_jsonb(r)->>'reviewed_at',
                 'verification_note',to_jsonb(r)->>'verification_note',
                 'description',r.description,
                 'pdf',s.pdf_page,'printed',s.printed_page_label,'label',s.section_label,
                 'book_sha',b.file_sha256)), '[]'::json)
                 FROM calculation_rules r LEFT JOIN source_sections s ON s.id=r.source_section_id
                 LEFT JOIN source_books b ON b.id=s.source_book_id),
  'external_sources', __C01_EXTERNAL_QUERY__,
  'd02_entries', __D02_ENTRIES_QUERY__,
  'e01_glosses', __E01_GLOSSES_QUERY__,
  'migrations', (SELECT coalesce(json_agg(version ORDER BY installed_rank), '[]'::json)
                 FROM flyway_schema_history WHERE success=true)
)::text;
"""


def query_database(args: argparse.Namespace) -> dict:
    if not os.getenv("PGPASSWORD"):
        raise RuntimeError("Chưa có biến PGPASSWORD; dùng scripts/audit_tv3.ps1 để nhập mật khẩu ẩn.")
    command = [find_psql(args.psql), "-X", "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
               "-h", args.host, "-p", str(args.port), "-U", args.user, "-d", args.database]
    probe = subprocess.run(command + ['-c', "SELECT to_regclass('public.external_sources') IS NOT NULL"],
                           capture_output=True, encoding='utf-8', text=True, timeout=10,
                           env=dict(os.environ, PGCLIENTENCODING='UTF8'))
    if probe.returncode: raise RuntimeError('Không đọc được schema nguồn ngoài sách.')
    external_query = "(SELECT coalesce(json_agg(x),'[]'::json) FROM external_sources x)" if probe.stdout.strip() == 't' else "'[]'::json"
    probe_d02 = subprocess.run(command + ['-c', "SELECT to_regclass('public.tam_the_lookup_source_pages') IS NOT NULL"],
                               capture_output=True, encoding='utf-8', text=True, timeout=10,
                               env=dict(os.environ, PGCLIENTENCODING='UTF8'))
    if probe_d02.returncode: raise RuntimeError('Không đọc được schema D02.')
    d02_query = '(SELECT coalesce(json_agg(x),\'[]\'::json) FROM ('+d02_source.ENTRY_QUERY+') x)' if probe_d02.stdout.strip()=='t' else "'[]'::json"
    probe_e01 = subprocess.run(command + ['-c', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interpretations' AND column_name='printed_source_label')"],
                               capture_output=True, encoding='utf-8', text=True, timeout=10,
                               env=dict(os.environ, PGCLIENTENCODING='UTF8'))
    if probe_e01.returncode: raise RuntimeError('Không đọc được schema E01.')
    e01_query = """(SELECT coalesce(json_agg(json_build_object(
        'code',i.hexagram_code,'content',i.content,'status',i.verification_status,
        'editor',i.editor,'reviewer',i.reviewer,'reviewed_at',i.reviewed_at,
        'note',i.verification_note,'source_order',i.source_order,
        'printed_source_label',i.printed_source_label,'rule_id',i.rule_id,
        'pdf_page',s.pdf_page,'printed_page',s.printed_page_label,
        'source_label',s.section_label,'source_sha',b.file_sha256)), '[]'::json)
        FROM interpretations i JOIN source_sections s ON s.id=i.source_section_id
        JOIN source_books b ON b.id=s.source_book_id
        WHERE i.category='NAME_GLOSS')""" if probe_e01.stdout.strip() == 't' else "'[]'::json"
    sql = (SQL.replace('__C01_EXTERNAL_QUERY__', external_query)
              .replace('__D02_ENTRIES_QUERY__', d02_query)
              .replace('__E01_GLOSSES_QUERY__', e01_query))
    completed = subprocess.run(command, input="BEGIN READ ONLY;\n" + sql + "\nCOMMIT;\n",
                               capture_output=True, encoding="utf-8", text=True, timeout=30,
                               env=dict(os.environ, PGCLIENTENCODING="UTF8"))
    if completed.returncode:
        raise RuntimeError("psql trả lỗi: " + completed.stderr.strip()[:600])
    # json_agg(record) may insert physical newlines between records. Parse the
    # complete scalar result instead of assuming a one-line JSON document.
    return json.loads(completed.stdout.strip())


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


def audit_career(audit: Audit, db: dict) -> bool:
    rows = db.get('career_entries', [])
    rules = [r for r in db['rules'] if r['module'] == 'TAM_THE' and r['code'] in career_source.CODES]
    if not any(r.get('status') == 'VERIFIED' for r in rules) and not any(r.get('status') == 'VERIFIED' for r in rows):
        audit.note('D01 công danh chưa duyệt', 'Cần kiểm 51 giao điểm, 120 ô và 12 đoạn trước VERIFIED.')
        return False
    expected = {(e['rule'], e['key'], e['code']): e for e in career_source.load_records()}
    def matches(row):
        item = expected.get((row['rule'], row['key'], row['code']))
        if item is None or any(row.get(k) != v for k, v in item.items()):
            return False
        label, printed = career_source.SOURCE_PAGES[item['table_page']]
        if (row.get('label'), row.get('printed'), row.get('book_sha')) != (label, printed, career_source.SOURCE_SHA):
            return False
        page = item['content_page']
        if page is not None and (row.get('content_label'), row.get('content_printed'), row.get('content_book_sha')) != (
                career_source.SOURCE_PAGES[page][0], str(page + 1), career_source.SOURCE_SHA):
            return False
        return (row.get('status') == 'VERIFIED' and row.get('reviewer') == career_source.REVIEWER
                and bool(row.get('reviewed_at')) and row.get('editor') in ('AUTO_FROM_DOCS', career_source.EDITOR))
    complete = (len(rows) == 171 and len({(r['rule'], r['key'], r['code']) for r in rows}) == 171
                and all(matches(r) for r in rows))
    audit.check('D01 171 giao điểm/ô nghề và nội dung khớp nguồn đã duyệt', complete)
    rule_ok = len(rules) == 2 and all(
        r['status'] == 'VERIFIED' and r.get('reviewer') == career_source.REVIEWER
        and bool(r.get('reviewed_at')) and r.get('verification_note') == career_source.RULE_NOTES[r['code']]
        and r.get('description') == career_source.DESCRIPTIONS[r['code']]
        and (r.get('pdf'), r.get('label'), r.get('book_sha')) == (
            32 if r['code'] == career_source.CODES[0] else 35,
            r['code'], career_source.SOURCE_SHA) for r in rules)
    audit.check('D01 hai rule công danh có phạm vi và metadata duyệt', rule_ok)
    audit.check('D01 V7 lưu riêng nguồn/nhãn bảng và đoạn', '7' in db['migrations'])
    return complete and rule_ok and '7' in db['migrations']


def audit_calendar(audit: Audit, db: dict) -> None:
    rules = [r for r in db['rules'] if r['module']=='CALENDAR' and r['code']=='LUNAR-CONVERSION']
    if not any(r['status']=='VERIFIED' for r in rules):
        audit.note('C01 lịch chưa duyệt', 'Chưa áp dụng biên bản nguồn/thuật toán lịch.')
        return
    m = calendar_source.load_review()
    sources = [x for x in db.get('external_sources',[]) if x['source_id']==m['sourceId']]
    expected = {column:m[key] for column,key in zip(('source_id','title','version','section','url','sha256'),
                ('sourceId','title','version','section','url','resourceSha256'))}
    audit.check('C01 nguồn ngoài sách khớp phiên bản và hash bảng lịch', sources==[expected])
    audit.check('C01 LUNAR-CONVERSION VERIFIED đúng phạm vi/biên bản', len(rules)==1 and all(
        r['status']=='VERIFIED' and r.get('external_id')==m['sourceId'] and r.get('source') is None
        and r.get('reviewer')==m['reviewer'] and bool(r.get('reviewed_at'))
        and r.get('verification_note')==calendar_source.NOTE and r.get('description')==calendar_source.DESCRIPTION for r in rules))
    audit.check('C01 migration V8 nguồn thuật toán ngoài sách', '8' in db['migrations'])


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
    if not db.get('d02_entries'):
        audit.check("Quy tắc toàn bộ 12 tháng cần biên bản D02 trước VERIFIED",
                    len(tam_the_rules) == 1 and tam_the_rules[0]["status"] == "BLOCKED_SOURCE_CONFLICT")
    trigram_rules = [r for r in db["rules"] if r["module"] == "MAI_HOA" and r["code"] == "MH-TRIGRAM"]
    if any(r["status"] == "VERIFIED" for r in trigram_rules):
        audit.check("MH-TRIGRAM VERIFIED có metadata và nguồn đúng", len(trigram_rules) == 1 and all(
            bool(r.get("reviewer")) and bool(r.get("reviewed_at")) and bool(r.get("verification_note"))
            and (r.get("pdf"), r.get("printed"), r.get("label"), r.get("book_sha"))
            == (39, "44", "MH-QUAI-SO", SOURCE_SHA) for r in trigram_rules))
    object_rules = [r for r in db["rules"] if r["module"] == "MAI_HOA" and r["code"] == "MH-OBJECT-COUNT"]
    time_rules = [r for r in db['rules'] if r['module']=='MAI_HOA' and r['code']=='MH-TIME']
    audit.check('MH-TIME VERIFIED theo xac nhan chia6 cua chu du an', len(time_rules)==1 and all(
        r['status']=='VERIFIED' and r.get('reviewer')==time_decision.REVIEWER and bool(r.get('reviewed_at'))
        and r.get('verification_note')==time_decision.NOTE and r.get('description')==time_decision.DESCRIPTION
        and (r.get('pdf'),r.get('printed'),r.get('label'),r.get('book_sha'))==(45,'50','MH-TIME-CONFLICT',SOURCE_SHA)
        for r in time_rules))
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
    audit_e01(audit, db)
    audit_year_elements(audit, db)
    audit_calendar(audit, db)
    remaining = [] if len(db.get("year_elements", [])) == 60 else ["60 Can Chi"]
    career_ready = audit_career(audit, db)
    if not career_ready:
        remaining.append('công danh D01')
    if not audit_d02(audit, db):
        remaining.extend(["D02: 36 phần giờ, tài lộc, tình duyên và 12 mốc"])
    if remaining:
        audit.note("Bảng Tam Thế còn thiếu", ", ".join(remaining) + "; cần nhập có trang nguồn và review.")


def audit_e01(audit: Audit, db: dict) -> None:
    rows = db.get('e01_glosses', [])
    if not rows:
        audit.note('E01 chưa nhập 64 nghĩa tên quẻ',
                   'Chưa có NAME_GLOSS; dữ liệu này khác với lời luận quẻ/hào.')
        return
    expected = e01_source.load_review()
    by_code = {row['hexagram_code']: row for row in expected}
    unique = len(rows) == 64 and len({r['code'] for r in rows}) == 64
    audit.check('E01 đủ 64 NAME_GLOSS không trùng mã', unique,
                'Chỉ là nghĩa tên ngắn, chưa phải lời luận chi tiết.')

    def match(row: dict) -> bool:
        entry = by_code.get(row['code'])
        if entry is None:
            return False
        return (row['content'] == entry['gloss'] and
                row['source_order'] == int(entry['order']) and
                row['printed_source_label'] == entry['printed_source_label'] and
                row['pdf_page'] == int(entry['pdf_page']) and
                row['printed_page'] == entry['printed_page'] and
                row['source_label'] == 'MH-64-QUE-NAMES-' + entry['printed_page'] and
                row['source_sha'] == SOURCE_SHA and row['rule_id'] is None and
                row['note'] == e01_source.note(entry))

    audit.check('E01 nghĩa tên và trang nguồn đúng CSV/manifest/PDF',
                unique and all(match(row) for row in rows))
    audit.check('E01 64 mục VERIFIED có biên bản cùng công cụ',
                unique and all(row['status'] == 'VERIFIED' and
                               row['editor'] == e01_source.EDITOR and
                               row['reviewer'] == e01_source.REVIEWER and
                               bool(row['reviewed_at']) for row in rows),
                'Reviewer là Codex lượt hai, không đại diện xác minh độc lập của con người.')
    forty_eight = [r for r in rows if r['source_order'] == 48]
    audit.check('E01 mục 48 giữ chữ in Ích, chuẩn hóa thành Tỉnh',
                len(forty_eight) == 1 and forty_eight[0]['code'] == 'H_KHAM_TON' and
                forty_eight[0]['content'] == 'Giếng nước' and
                forty_eight[0]['printed_source_label'] == 'Ích' and
                forty_eight[0]['note'] == e01_source.note(by_code['H_KHAM_TON']))
    audit.check('E01 Flyway V10 đã áp dụng', '10' in db['migrations'])


def audit_d02(audit: Audit, db: dict) -> bool:
    entries, anchors=d02_source.load_records()
    actual=db.get('d02_entries',[])
    if not actual: return False
    expected={(e['rule'],e['key'],e['code']):e for e in entries}
    content_ok=len(actual)==216 and len({(a['rule'],a['key'],a['code']) for a in actual})==216
    pages_ok=content_ok
    for a in actual:
        e=expected.get((a['rule'],a['key'],a['code']))
        content_ok = content_ok and e is not None and all(a.get(k)==e[k] for k in (
            'title','content','table_page','content_page','table_label','heading')) and (
            a.get('status')=='VERIFIED' and a.get('editor')==d02_source.EDITOR
            and a.get('reviewer')==d02_source.REVIEWER and bool(a.get('reviewed_at')) and a.get('note')==e['note'])
        pages_ok = pages_ok and e is not None and (
            a.get('page_sources')==d02_source.page_sources(e) and a.get('table_sha')==d02_source.SOURCE_SHA
            and a.get('content_sha')==d02_source.SOURCE_SHA
            and a.get('table_source')==d02_source.source_label(e['table_page'])
            and a.get('content_source')==d02_source.source_label(e['content_page'])
            and a.get('table_printed')==str(e['table_page']+1) and a.get('content_printed')==str(e['content_page']+1))
    audit.check('D02 216 ô/đoạn khớp nội dung và metadata duyệt',content_ok)
    audit.check('D02 đủ chuỗi trang nguồn, gồm ba bài thơ qua hai trang',pages_ok)
    rules_ok=True
    for code in d02_source.CODES:
        rows=[r for r in db['rules'] if r['module']=='TAM_THE' and r['code']==code]
        label,page=d02_source.RULE_LOCATIONS[code]
        rules_ok=rules_ok and len(rows)==1 and all(r.get('status')=='VERIFIED' and r.get('reviewer')==d02_source.REVIEWER
            and bool(r.get('reviewed_at')) and r.get('verification_note')==d02_source.RULE_NOTES[code]
            and r.get('description')==d02_source.DESCRIPTIONS[code]
            and (r.get('label'),r.get('pdf'),r.get('printed'),r.get('book_sha'))==(label,page,str(page+1),d02_source.SOURCE_SHA) for r in rows)
    audit.check('D02 bốn quy tắc VERIFIED đúng phạm vi/biên bản',rules_ok)
    anchors_ok=len(db['anchors'])==12
    for a in db['anchors']:
        expected_anchor=next((x for x in anchors if int(x['month'])==a['month']),None)
        anchors_ok=anchors_ok and expected_anchor is not None and (
            a['start']==expected_anchor['start'] and a['source']==expected_anchor['source_branch']
            and a['adopted']==expected_anchor['adopted_branch'] and a['pdf']==int(expected_anchor['primary_page'])
            and a.get('label')==expected_anchor['primary_label'] and a.get('printed')==str(int(expected_anchor['primary_page'])+1)
            and a.get('book_sha')==d02_source.SOURCE_SHA
            and a['status']=='VERIFIED' and bool(a.get('reviewed_at'))
            and a.get('reviewer')==('TV2 (project owner confirmation)' if a['month']==5 else d02_source.REVIEWER)
            and a.get('verification_note')==('TV2 confirmation reported by project owner on 2026-10-23; source printed DAU, team adopts DAN only for month 5.' if a['month']==5 else d02_source.anchor_note(expected_anchor)))
    audit.check('D02 12 mốc đã duyệt, giữ reviewer TV2 tháng 5',anchors_ok)
    wealth=[a for a in actual if a['rule']==d02_source.CODES[0]]
    coverage_ok=len(wealth)==120 and len({a['key'] for a in wealth})==60 and all(
        sum(a['key']==key for a in wealth)==2 for key in {a['key'] for a in wealth})
    audit.check('D02 tài lộc: 60 khóa có hai kết quả, 60 khóa không có trong nguồn',coverage_ok,
                'Không diễn giải khóa thiếu thành số xấu; không dùng bảng khác bù tự động.')
    migration_ok='9' in db['migrations']
    audit.check('D02 migration V9 lưu đầy đủ nguồn nhiều trang',migration_ok)
    return bool(content_ok and pages_ok and rules_ok and anchors_ok and coverage_ok and migration_ok)


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
