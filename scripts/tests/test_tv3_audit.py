"""Kiểm thử ranh giờ Tam Thế và bộ kiểm toán offline, không cần PostgreSQL."""

import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_tv3 import Audit, audit_database, minute_value, tam_the_branch, BRANCHES
from import_book_knowledge import BOOKS, HOUR_ANCHORS, HOUR_SOURCE, JOB_TABLE, RULES, TRIGRAMS


class HourBranchTests(unittest.TestCase):
    def test_all_twelve_months_cover_day_exactly(self):
        for month, first, *_ in HOUR_ANCHORS:
            with self.subTest(month=month):
                counts = {branch: 0 for branch in BRANCHES}
                for minute in range(24 * 60):
                    counts[tam_the_branch(first, f"{minute // 60:02d}:{minute % 60:02d}")] += 1
                self.assertEqual(set(counts.values()), {120})

    def test_each_boundary(self):
        for month, first, *_ in HOUR_ANCHORS:
            base = minute_value(first)
            with self.subTest(month=month):
                for index, branch in enumerate(BRANCHES):
                    at = (base + index * 120) % 1440
                    end = (at + 119) % 1440
                    next_ = (at + 120) % 1440
                    fmt = lambda n: f"{n // 60:02d}:{n % 60:02d}"
                    self.assertEqual(tam_the_branch(first, fmt(at)), branch)
                    self.assertEqual(tam_the_branch(first, fmt(end)), branch)
                    self.assertEqual(tam_the_branch(first, fmt(next_)), BRANCHES[(index + 1) % 12])

    def test_month_five_preserves_printed_conflict(self):
        month5 = [a for a in HOUR_ANCHORS if a[0] == 5][0]
        self.assertEqual(month5[:5], (5, "05:20", "DAU", "DAN", "TEAM_CORRECTION"))
        self.assertEqual(HOUR_SOURCE[5], ("TT-GIO-SINH-5", 14))
        self.assertEqual([tam_the_branch("05:20", s) for s in
                          ("05:19", "05:20", "07:19", "07:20")],
                         ["SUU", "DAN", "DAN", "MAO"])

    def test_invalid_clock(self):
        for value in ("24:00", "01:60", "-1:00"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                minute_value(value)


class DatabaseAuditTests(unittest.TestCase):
    def setUp(self):
        self.book_patch = patch.dict(
            BOOKS,
            {key: dict(info, sha256="0" * 64) for key, info in BOOKS.items()},
            clear=True,
        )
        self.book_patch.start()
        self.addCleanup(self.book_patch.stop)

    def sample_db(self):
        anchors = [{"month": month, "start": start, "source": source,
                    "adopted": adopted, "decision": decision,
                    "pdf": HOUR_SOURCE[month][1], "status": "SOURCE_LOCATED",
                    "reviewer": None, "reviewed_at": None}
                   for month, start, source, adopted, decision, _ in HOUR_ANCHORS]
        anchors[4].update(status="VERIFIED", reviewer="TV2 (project owner confirmation)",
                          reviewed_at="2026-10-23T14:00:00+07:00")
        jobs = [{"key": f"ELEMENT:{element}|MONTH:{month:02d}",
                 "code": code, "pdf": 32, "status": "SOURCE_LOCATED", "reviewer": None}
                for code, (_, table) in JOB_TABLE.items()
                for element, months in table.items() for month in months]
        rules = [{"module": module, "code": code, "status": status,
                  "source": 42 if book else None,
                  "reviewer": "TV2 (project owner confirmation)" if code in ("MH-MUTUAL", "MH-CHANGE") else None,
                  "reviewed_at": "2026-10-23T14:00:00+07:00" if code in ("MH-MUTUAL", "MH-CHANGE") else None}
                 for module, code, status, book, *_ in RULES]
        for rule in rules:
            if rule["code"] in ("MH-MUTUAL", "MH-CHANGE"):
                rule["status"] = "VERIFIED"
        return {"counts": {"source_books": 2, "source_sections": 17,
                           "calculation_rules": 14, "trigrams": 8,
                           "tam_the_hour_anchors": 12, "tam_the_lookup_entries": 51,
                           "hexagrams": 0, "hexagram_lines": 0, "interpretations": 0},
                "migrations": ["1", "2", "3", "4"],
                "books": [{"title": info["title"], "sha": info["sha256"]}
                          for info in BOOKS.values()],
                "trigrams": [{"code": code, "number": number,
                              "element": element, "lines": [bool(n) for n in lines]}
                             for code, _, number, element, lines in TRIGRAMS],
                "anchors": anchors, "jobs": jobs, "rules": rules}

    @staticmethod
    def status(audit, prefix):
        return next(row[0] for row in audit.findings if row[1].startswith(prefix))

    def test_tv2_confirmed_scope_passes(self):
        result = Audit()
        audit_database(result, self.sample_db())
        for prefix in ("Xác nhận TV2 VERIFIED hai", "Xác nhận TV2 VERIFIED mốc",
                       "Quy tắc toàn bộ 12", "Flyway V4 đã áp dụng"):
            with self.subTest(prefix=prefix):
                self.assertEqual(self.status(result, prefix), "PASS")

    def test_verified_rule_missing_reviewer_is_rejected(self):
        db = self.sample_db()
        next(row for row in db["rules"] if row["code"] == "MH-MUTUAL")["reviewer"] = None
        result = Audit()
        audit_database(result, db)
        self.assertEqual(self.status(result, "Xác nhận TV2 VERIFIED hai"), "FAIL")

    def test_verified_month_five_missing_reviewer_is_rejected(self):
        db = self.sample_db()
        db["anchors"][4]["reviewer"] = None
        result = Audit()
        audit_database(result, db)
        self.assertEqual(self.status(result, "Xác nhận TV2 VERIFIED mốc"), "FAIL")

    def test_full_tam_the_rule_must_remain_unverified(self):
        db = self.sample_db()
        next(row for row in db["rules"] if row["code"] == "TT-GIO-SINH")["status"] = "VERIFIED"
        result = Audit()
        audit_database(result, db)
        self.assertEqual(self.status(result, "Quy tắc toàn bộ 12"), "FAIL")

    def test_missing_v4_is_rejected(self):
        db = self.sample_db()
        db["migrations"].remove("4")
        result = Audit()
        audit_database(result, db)
        self.assertEqual(self.status(result, "Flyway V4 đã áp dụng"), "FAIL")

    def test_month_five_bad_data_is_rejected(self):
        db = self.sample_db()
        db["anchors"][4]["source"] = "DAN"  # giả lập thao tác xóa dấu vết bản in
        result = Audit()
        audit_database(result, db)
        finding = next(row for row in result.findings if row[1].startswith("DB lưu đúng toàn bộ 12"))
        self.assertEqual(finding[0], "FAIL")

    def test_false_verified_without_reviewer_is_rejected(self):
        db = self.sample_db()
        db["jobs"][0]["status"] = "VERIFIED"
        result = Audit()
        audit_database(result, db)
        finding = next(row for row in result.findings if row[1].startswith("Không VERIFIED thiếu người"))
        self.assertEqual(finding[0], "FAIL")

    def test_all_64_combinations_and_384_lines(self):
        db = self.sample_db()
        codes = [(code, [bool(n) for n in lines]) for code, _, _, _, lines in TRIGRAMS]
        db["hexagram_data"] = [
            {"code": f"H_{upper}_{lower}", "upper": upper, "lower": lower,
             "lines": lower_lines + upper_lines, "name_kind": "STRUCTURAL_LABEL", "status": "DRAFT"}
            for upper, upper_lines in codes for lower, lower_lines in codes
        ]
        db["hexagram_line_data"] = [
            {"code": h["code"], "line": index, "yang": value}
            for h in db["hexagram_data"] for index, value in enumerate(h["lines"], start=1)
        ]
        db["counts"].update(hexagrams=64, hexagram_lines=384)
        result = Audit()
        audit_database(result, db)
        structure = next(row for row in result.findings if row[1].startswith("64 tổ hợp"))
        self.assertEqual(structure[0], "PASS")
        self.assertIn("64 tên quẻ chưa VERIFIED", [r[1] for r in result.findings if r[0] == "PENDING"])

        db["hexagram_line_data"][0]["yang"] = not db["hexagram_line_data"][0]["yang"]
        result = Audit()
        audit_database(result, db)
        structure = next(row for row in result.findings if row[1].startswith("64 tổ hợp"))
        self.assertEqual(structure[0], "FAIL")


if __name__ == "__main__":
    unittest.main()
