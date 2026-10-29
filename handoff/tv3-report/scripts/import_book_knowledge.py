#!/usr/bin/env python3
"""Nhập dữ liệu có địa chỉ trang sách cho Huyền Cơ.

Các ô bảng được chép từ docs/04-MAIHOA-RULES.md và
docs/05-TAMTHE-RULES.md (đã đối chiếu sơ bộ với hai PDF).
Chỉ nhập trạng thái SOURCE_LOCATED / SOURCE_AMBIGUOUS, không tự VERIFIED.
Không dùng OCR hay tự tạo nội dung luận giải từ ảnh scan.
"""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
BOOKS = {
    "MH": {
        "filename": "Mai hoa dich so-Thieu-khang Tiet.pdf",
        "title": "Mai Hoa Dịch Số",
        "author": "Thiệu Khang Tiết; Ông Văn Tùng dịch/chú thích",
        "publisher": "NXB Văn hóa – Thông tin",
        "pages": 672,
    },
    "TT": {
        "filename": "Diễn Cầm Tam Thế Diễn Nghĩa.pdf",
        "title": "Diễn Cầm Tam Thế Diễn Nghĩa",
        "author": "Dương Công Hầu soạn giải; Khương Đức hiệu",
        "publisher": None,
        "pages": 360,
    },
}
EDITION = "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in"

# (sách, nhãn mục ổn định, trang PDF, nhãn trang in, mô tả mục)
SECTIONS = [
    ("MH", "MH-QUAI-SO", 39, "44", "Số Tiên thiên của tám quái"),
    ("MH", "MH-NGU-HANH", 35, "40", "Ngũ hành của tám quái"),
    ("MH", "MH-HAO-6", 41, "46", "Hào trừ 6; dư 0 là hào sáu"),
    ("MH", "MH-QUE-HO-BIEN", 42, "47", "Sáu hào, quẻ hỗ và quẻ biến"),
    ("MH", "MH-TIME", 43, "48", "Lập quẻ theo thời gian"),
    ("MH", "MH-TIME-CONFLICT", 45, "50", "Mâu thuẫn chữ in phép trừ 8/6"),
    ("MH", "MH-OBJECT-COUNT", 46, "51", "Xem bằng số vật"),
    ("MH", "MH-THE-DUNG", 118, "124", "Quy tắc Thể và Dụng"),
    ("TT", "TT-NGU-HANH", 11, "12", "Số 4: 60 Can Chi và hành mệnh"),
    ("TT", "TT-GIO-SINH", 12, "13", "Số 5: giờ sinh tháng 1, 2, 8, 9"),
    ("TT", "TT-GIO-SINH-3-7-4-6", 13, "14", "Số 5: giờ sinh tháng 3, 7, 4, 6"),
    ("TT", "TT-GIO-SINH-5", 14, "15", "Ô tháng 5: bản in ghi Dậu, nhóm chọn Dần"),
    ("TT", "TT-GIO-SINH-11", 14, "15", "Số 5: giờ sinh tháng 11"),
    ("TT", "TT-GIO-SINH-10-12", 15, "16", "Số 5: giờ sinh tháng 10, 12"),
    ("TT", "TT-36-PHAN", 25, "26", "Số 8: ba phần cho mỗi giờ Chi"),
    ("TT", "TT-CONG-DANH-11", 32, "33", "Số 11: hành mệnh và tháng sinh"),
    ("TT", "TT-CONG-DANH-13", 35, "36", "Số 13: Thiên Can năm và tháng sinh"),
]

# (module, mã, trạng thái, sách, nhãn mục, trang PDF, mô tả)
RULES = [
    ("MAI_HOA", "MH-TRIGRAM", "SOURCE_LOCATED", "MH", "MH-QUAI-SO", 39,
     "Bảng tám quái, số Tiên thiên và Ngũ hành; cần đối chiếu chéo."),
    ("MAI_HOA", "MH-MUTUAL", "SOURCE_LOCATED", "MH", "MH-QUE-HO-BIEN", 42,
     "Hạ quái hỗ: hào 2-4; thượng quái hỗ: hào 3-5."),
    ("MAI_HOA", "MH-CHANGE", "SOURCE_LOCATED", "MH", "MH-HAO-6", 41,
     "Đảo âm/dương tại hào động tính từ dưới lên."),
    ("MAI_HOA", "MH-TIME", "BLOCKED_SOURCE_CONFLICT", "MH", "MH-TIME-CONFLICT", 45,
     "Nhóm chọn chia 6; trang 50 in trừ 8, chưa duyệt VERIFIED."),
    ("MAI_HOA", "MH-OBJECT-COUNT", "SOURCE_AMBIGUOUS", "MH", "MH-OBJECT-COUNT", 46,
     "Nhóm chọn hào=(số vật+chỉ số giờ)%6; cụm 'số quẻ' còn mơ hồ."),
    ("MAI_HOA", "MH-THE-DUNG", "SOURCE_AMBIGUOUS", "MH", "MH-THE-DUNG", 118,
     "Chưa xác minh đầy đủ cách chọn quái Thể theo hào động."),
    ("TAM_THE", "TT-NGU-HANH", "SOURCE_LOCATED", "TT", "TT-NGU-HANH", 11,
     "Bảng 60 Can Chi chưa chép đủ 60 ô từ sách."),
    ("TAM_THE", "TT-GIO-SINH", "BLOCKED_SOURCE_CONFLICT", "TT", "TT-GIO-SINH-5", 14,
     "Tháng 5: nguồn Dậu, quyết định nhóm Dần; kiểm đủ 12 tháng trước VERIFIED."),
    ("TAM_THE", "TT-36-PHAN", "SOURCE_AMBIGUOUS", "TT", "TT-36-PHAN", 25,
     "36 phần đầu/giữa/sau; mỗi phần 40 phút là quy ước cần đối chiếu."),
    ("TAM_THE", "TT-CONG-DANH-11", "SOURCE_LOCATED", "TT", "TT-CONG-DANH-11", 32,
     "Bảng ngành nghề theo hành mệnh và tháng âm."),
    ("TAM_THE", "TT-CONG-DANH-13", "SOURCE_LOCATED", "TT", "TT-CONG-DANH-13", 35,
     "Bảng 120 ô Can năm x tháng âm cần đối chiếu đủ."),
    ("TAM_THE", "TT-TAI-LOC", "DRAFT", None, None, None,
     "Chưa định vị chính xác bảng nguồn về tài lộc."),
    ("TAM_THE", "TT-TINH-DUYEN", "DRAFT", None, None, None,
     "Chưa định vị chính xác bảng nguồn về tình duyên."),
    ("CALENDAR", "LUNAR-CONVERSION", "DRAFT", None, None, None,
     "Chưa chốt nguồn thuật toán lịch Âm-Dương/tiết khí."),
]

# Trật tự từng hào từ DƯỚI lên TRÊN, theo Số Tiên thiên.
TRIGRAMS = [
    ("CAN", "Càn", 1, "KIM", (1, 1, 1)),
    ("DOAI", "Đoài", 2, "KIM", (1, 1, 0)),
    ("LY", "Ly", 3, "HOA", (1, 0, 1)),
    ("CHAN", "Chấn", 4, "MOC", (1, 0, 0)),
    ("TON", "Tốn", 5, "MOC", (0, 1, 1)),
    ("KHAM", "Khảm", 6, "THUY", (0, 1, 0)),
    ("CAN2", "Cấn", 7, "THO", (0, 0, 1)),
    ("KHON", "Khôn", 8, "THO", (0, 0, 0)),
]

# Chép bảng Số 11 từ docs/05-TAMTHE-RULES.md (trang in 33 / PDF 32).
# Mỗi giao điểm (hành, tháng) có thể có nhiều nghề khác nhau.
JOB_TABLE = {
    "MUA_BAN": ("Mua bán", {
        "KIM": [4, 5, 8, 10], "MOC": [2, 4, 6, 10], "THUY": [4, 8, 12],
        "HOA": [5, 11], "THO": [7, 8, 10],
    }),
    "CAU_CHAI": ("Câu/chài lưới/đáy rọ/mua thủy lợi", {
        "KIM": [1, 3, 9, 10], "MOC": [4, 5, 6, 12],
        "THUY": [2, 4, 6, 8, 11], "HOA": [2, 6, 7, 11],
        "THO": [1, 2, 3, 6, 8, 9],
    }),
    "LAM_THO": ("Làm thợ", {
        "KIM": [8, 10], "MOC": [6, 10], "THUY": [7, 11, 12],
        "HOA": [1], "THO": [1, 3, 7, 10],
    }),
}

# (tháng âm, mốc giờ Dần, giờ in gốc, giờ dùng, trạng thái, lý do)
HOUR_ANCHORS = [
    (1, "04:20", "DAN", "DAN", "AS_PRINTED", None),
    (2, "04:00", "DAN", "DAN", "AS_PRINTED", None),
    (3, "04:30", "DAN", "DAN", "AS_PRINTED", None),
    (4, "04:40", "DAN", "DAN", "AS_PRINTED", None),
    (5, "05:20", "DAU", "DAN", "TEAM_CORRECTION",
     "Nhóm chọn Dần theo chuỗi giờ kế tiếp Mão-Thìn-Tỵ-Ngọ-Mùi; bản in ghi Dậu."),
    (6, "04:40", "DAN", "DAN", "AS_PRINTED", None),
    (7, "04:30", "DAN", "DAN", "AS_PRINTED", None),
    (8, "04:00", "DAN", "DAN", "AS_PRINTED", None),
    (9, "04:20", "DAN", "DAN", "AS_PRINTED", None),
    (10, "04:00", "DAN", "DAN", "AS_PRINTED", None),
    (11, "03:40", "DAN", "DAN", "AS_PRINTED", None),
    (12, "04:00", "DAN", "DAN", "AS_PRINTED", None),
]

HOUR_SOURCE = {
    1: ("TT-GIO-SINH", 12),
    2: ("TT-GIO-SINH", 12),
    3: ("TT-GIO-SINH-3-7-4-6", 13),
    4: ("TT-GIO-SINH-3-7-4-6", 13),
    5: ("TT-GIO-SINH-5", 14),
    6: ("TT-GIO-SINH-3-7-4-6", 13),
    7: ("TT-GIO-SINH-3-7-4-6", 13),
    8: ("TT-GIO-SINH", 12),
    9: ("TT-GIO-SINH", 12),
    10: ("TT-GIO-SINH-10-12", 15),
    11: ("TT-GIO-SINH-11", 14),
    12: ("TT-GIO-SINH-10-12", 15),
}


def quote(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def book_id(code: str) -> str:
    return ("(SELECT id FROM source_books WHERE title="
            f"{quote(BOOKS[code]['title'])} AND edition={quote(EDITION)})")


def section_id(book: str, label: str, page: int) -> str:
    return ("(SELECT id FROM source_sections WHERE source_book_id="
            f"{book_id(book)} AND section_label={quote(label)} AND pdf_page={page})")


def rule_id(module: str, rule_code: str) -> str:
    return ("(SELECT id FROM calculation_rules WHERE module="
            f"{quote(module)} AND rule_code={quote(rule_code)} AND rule_version='1.0')")


def source_pages(path: Path) -> int | None:
    pdfinfo = shutil.which("pdfinfo")
    if not pdfinfo:
        return None
    result = subprocess.run([pdfinfo, str(path)], capture_output=True, text=True, errors="replace")
    if result.returncode != 0:
        return None
    match = re.search(r"(?m)^Pages:\s*(\d+)\s*$", result.stdout)
    return int(match.group(1)) if match else None


def read_books(pdf_dir: Path) -> None:
    for code, info in BOOKS.items():
        path = pdf_dir / str(info["filename"])
        if not path.is_file():
            raise RuntimeError(f"Không tìm thấy PDF: {path}")
        h = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                h.update(chunk)
        info["sha256"] = h.hexdigest()
        actual_pages = source_pages(path)
        if actual_pages is not None and actual_pages != info["pages"]:
            raise RuntimeError(
                f"Số trang không khớp ({path.name}): {actual_pages} != {info['pages']}"
            )


def validate_seed_data() -> None:
    """Chặn dữ liệu thiếu/trùng trước khi sinh SQL hoặc ghi database."""
    if len({(b, label, page) for b, label, page, _, _ in SECTIONS}) != len(SECTIONS):
        raise RuntimeError("Trùng định danh (sách, mục, trang) của source_sections")
    if len({(module, code) for module, code, *_ in RULES}) != len(RULES):
        raise RuntimeError("Trùng module + rule_code")
    if len({code for code, *_ in TRIGRAMS}) != 8:
        raise RuntimeError("Bảng tám quái thiếu/trùng mã")
    if {number for _, _, number, _, _ in TRIGRAMS} != set(range(1, 9)):
        raise RuntimeError("Số Tiên thiên phải đủ 1..8")
    if any(len(lines) != 3 or set(lines) - {0, 1} for *_, lines in TRIGRAMS):
        raise RuntimeError("Mỗi quái phải có đúng ba hào âm/dương")
    if {month for month, *_ in HOUR_ANCHORS} != set(range(1, 13)):
        raise RuntimeError("Mốc giờ phải đủ 12 tháng âm")
    section_keys = {(book, label, page) for book, label, page, *_ in SECTIONS}
    for month, *_ in HOUR_ANCHORS:
        if ("TT", *HOUR_SOURCE[month]) not in section_keys:
            raise RuntimeError(f"Mốc tháng {month} chưa trỏ đúng trang nguồn")
    for module, rule, _, book, label, page, _ in RULES:
        if book is not None and (book, label, page) not in section_keys:
            raise RuntimeError(f"Quy tắc {module}/{rule} thiếu mục sách nguồn")
    for book, _, page, *_ in SECTIONS:
        if not 1 <= page <= BOOKS[book]["pages"]:
            raise RuntimeError(f"Trang PDF ngoài giới hạn sách {book}: {page}")
    lookup_keys = [(code, element, month)
                   for code, (_, elements) in JOB_TABLE.items()
                   for element, months in elements.items() for month in months]
    if len(lookup_keys) != len(set(lookup_keys)) or any(
            month < 1 or month > 12 for _, _, month in lookup_keys):
        raise RuntimeError("Bảng nghề có tháng không hợp lệ hoặc ô trùng")
    for month, _, source_branch, adopted_branch, decision, reason in HOUR_ANCHORS:
        if month == 5:
            if (source_branch, adopted_branch, decision) != (
                    "DAU", "DAN", "TEAM_CORRECTION") or not reason:
                raise RuntimeError("Phải giữ chữ in Dậu và quyết định sửa Dần tháng 5")
        elif source_branch != adopted_branch or decision != "AS_PRINTED":
            raise RuntimeError(f"Tháng {month} chưa có giải thích hiệu chỉnh")


def build_sql() -> str:
    sql = ["BEGIN;", "SET LOCAL client_min_messages TO warning;"]
    for code, info in BOOKS.items():
        values = [info["title"], info["author"], EDITION, info["publisher"],
                  None, info["pages"], info["sha256"]]
        sql.append("INSERT INTO source_books "
                   "(title,author,edition,publisher,publication_year,pdf_page_count,file_sha256) "
                   f"VALUES ({','.join(map(quote, values))}) "
                   "ON CONFLICT (title,edition) DO NOTHING;")
        sql.append("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM source_books WHERE "
                   f"title={quote(info['title'])} AND edition={quote(EDITION)} "
                   f"AND file_sha256={quote(info['sha256'])}) "
                   "THEN RAISE EXCEPTION 'PDF changed: create a new edition/source'; "
                   "END IF; END $$;")

    for book, label, pdf_page, printed, desc in SECTIONS:
        sql.append("INSERT INTO source_sections "
                   "(source_book_id,section_label,printed_page_label,pdf_page,excerpt) "
                   f"VALUES ({book_id(book)},{quote(label)},{quote(printed)},"
                   f"{pdf_page},{quote(desc)}) "
                   "ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;")

    for module, rule, status, book, label, page, desc in RULES:
        section = section_id(book, label, page) if book is not None else "NULL"
        sql.append("INSERT INTO calculation_rules "
                   "(module,rule_code,rule_version,verification_status,source_section_id,description) "
                   f"VALUES ({quote(module)},{quote(rule)},'1.0',{quote(status)},"
                   f"{section},{quote(desc)}) "
                   "ON CONFLICT (module,rule_code,rule_version) DO NOTHING;")

    for code, name, number, element, lines in TRIGRAMS:
        bools = ",".join("true" if n else "false" for n in lines)
        sql.append("INSERT INTO trigrams "
                   "(code,name,heaven_number,element,lines_bottom_up) "
                   f"VALUES ({quote(code)},{quote(name)},{number},{quote(element)},"
                   f"ARRAY[{bools}]::boolean[]) ON CONFLICT (code) DO NOTHING;")

    for result_code, (title, by_element) in JOB_TABLE.items():
        for element, months in by_element.items():
            for month in months:
                key = f"ELEMENT:{element}|MONTH:{month:02d}"
                sql.append("INSERT INTO tam_the_lookup_entries "
                           "(rule_id,lookup_key,result_code,title,description,"
                           "source_section_id,verification_status,editor) VALUES "
                           f"({rule_id('TAM_THE', 'TT-CONG-DANH-11')},{quote(key)},"
                           f"{quote(result_code)},{quote(title)},NULL,"
                           f"{section_id('TT', 'TT-CONG-DANH-11', 32)},"
                           "'SOURCE_LOCATED','AUTO_FROM_DOCS') "
                           "ON CONFLICT (rule_id,lookup_key,result_code) DO NOTHING;")

    for month, start, printed, adopted, decision, reason in HOUR_ANCHORS:
        label, page = HOUR_SOURCE[month]
        verification = ("BLOCKED_SOURCE_CONFLICT" if month == 5 else "SOURCE_LOCATED")
        sql.append("INSERT INTO tam_the_hour_anchors "
                   "(lunar_month,first_hour_start,source_branch,adopted_branch,"
                   "decision_status,decision_reason,source_section_id,"
                   "verification_status,editor) VALUES "
                   f"({month},{quote(start)},{quote(printed)},{quote(adopted)},"
                   f"{quote(decision)},{quote(reason)},{section_id('TT', label, page)},"
                   f"{quote(verification)},'AUTO_FROM_DOCS') "
                   "ON CONFLICT (lunar_month) DO NOTHING;")

    sql.append("COMMIT;")
    return "\n".join(sql) + "\n"


def find_psql(executable: str) -> str:
    if executable != "psql":
        return executable
    found = shutil.which("psql")
    if found:
        return found
    if sys.platform == "win32":
        base = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "PostgreSQL"
        candidates = sorted(base.glob("*/bin/psql.exe"),
                            key=lambda p: int(p.parents[1].name)
                            if p.parents[1].name.isdigit() else 0,
                            reverse=True)
        if candidates:
            return str(candidates[0])
    return executable


def main() -> int:
    # Windows PowerShell/Python stdout có thể dùng CP1252, không in được tiếng Việt.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--apply", action="store_true", help="Thực thi SQL lên PostgreSQL")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="huyenco")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--sql-output", type=Path, help="Xuất SQL có truy vết để kiểm tra")
    args = parser.parse_args()
    try:
        validate_seed_data()
        read_books(args.pdf_dir)
        sql = build_sql()
    except (OSError, RuntimeError) as exc:
        print(f"Lỗi chuẩn bị dữ liệu: {exc}", file=sys.stderr)
        return 1

    count_jobs = sum(len(months) for _, table in JOB_TABLE.values()
                     for months in table.values())
    print(f"PDF: {len(BOOKS)} | mục nguồn: {len(SECTIONS)} | quy tắc: {len(RULES)} "
          f"| quái: {len(TRIGRAMS)} | ô nghề: {count_jobs} "
          f"| mốc giờ: {len(HOUR_ANCHORS)}")
    for info in BOOKS.values():
        print(f"- {info['title']}: {info['pages']} trang, SHA256={info['sha256']}")
    print("Tất cả dữ liệu suy từ trang sách vẫn cần kiểm chéo, không tự VERIFIED.")

    if args.sql_output:
        args.sql_output.parent.mkdir(parents=True, exist_ok=True)
        args.sql_output.write_text(sql, encoding="utf-8")
        print(f"Đã xuất SQL: {args.sql_output}")

    if not args.apply:
        print("DRY RUN: chưa kết nối hoặc ghi vào database. Thêm --apply để nhập.")
        return 0

    if not os.getenv("PGPASSWORD"):
        print("Thiếu biến môi trường PGPASSWORD; không lưu mật khẩu trong mã nguồn.",
              file=sys.stderr)
        return 2
    args_psql = [find_psql(args.psql), "-X", "-v", "ON_ERROR_STOP=1", "-q",
                 "-h", args.host, "-p", str(args.port), "-U", args.user,
                 "-d", args.database]
    try:
        psql_env = dict(os.environ, PGCLIENTENCODING="UTF8")
        result = subprocess.run(args_psql, input=sql, text=True, encoding="utf-8",
                                capture_output=True, timeout=90, env=psql_env)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f"Không chạy được psql: {exc}", file=sys.stderr)
        return 2
    if result.returncode:
        print("Nhập thất bại, transaction đã rollback nếu gặp lỗi SQL. "
              "Cần chạy Flyway V1/V2 trước.\n" + result.stderr.strip(),
              file=sys.stderr)
        return result.returncode
    print("Nhập thành công. Chạy lại không nhân đôi bản ghi nhờ ON CONFLICT.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
