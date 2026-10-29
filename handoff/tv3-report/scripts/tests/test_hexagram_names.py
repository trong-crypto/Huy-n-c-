"""Kiểm tra dữ liệu tên và truy vết, không cần PostgreSQL."""
import csv
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_tv3 import Audit, audit_database
from import_hexagram_names import DATA, SOURCE_SHA, load_names
from import_book_knowledge import TRIGRAMS
import test_tv3_audit as base_audit_tests


class NameManifestTests(unittest.TestCase):
    def invalid_manifest(self, change):
        with DATA.open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        change(rows)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "names.csv"
            with path.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            with self.assertRaises(ValueError):
                load_names(path)

    def test_distinct_ambiguous_names_and_orientation(self):
        by_name = {row["name"]: row for row in load_names()}
        self.assertEqual(by_name["Bĩ"]["code"], "H_CAN_KHON")
        self.assertEqual(by_name["Bí"]["code"], "H_CAN2_LY")
        self.assertEqual(by_name["Ký tế"]["code"], "H_KHAM_LY")
        self.assertEqual(by_name["Vị tế"]["code"], "H_LY_KHAM")
        self.assertEqual(by_name["Lý"]["code"], "H_CAN_DOAI")
        self.assertEqual(by_name["Ly"]["code"], "H_LY_LY")

    def test_duplicate_pair_rejected(self):
        def change(rows):
            rows[1]["upper"] = rows[0]["upper"]
            rows[1]["lower"] = rows[0]["lower"]
        self.invalid_manifest(change)

    def test_duplicate_order_rejected(self):
        self.invalid_manifest(lambda rows: rows[1].update(order=rows[0]["order"]))

    def test_wrong_pdf_page_rejected(self):
        self.invalid_manifest(lambda rows: rows[3].update(pdf_page="269", printed_page="276"))

class NameDatabaseAuditTests(unittest.TestCase):
    def setUp(self):
        base_audit_tests.DatabaseAuditTests.setUp(self)

    def named_db(self):
        db = base_audit_tests.DatabaseAuditTests.sample_db(self)
        lines = {code: [bool(n) for n in values] for code, _, _, _, values in TRIGRAMS}
        db["hexagram_data"] = [dict(
            code=row["code"], upper=row["upper"], lower=row["lower"],
            lines=lines[row["lower"]] + lines[row["upper"]],
            name=row["name"], name_kind="CANONICAL_TITLE", status="SOURCE_LOCATED",
            pdf=row["pdf_page"], printed=str(row["printed_page"]),
            label="MH-64-QUE-NAMES-" + str(row["printed_page"]),
            book_sha=SOURCE_SHA, reviewer=None) for row in load_names()]
        db["hexagram_line_data"] = [
            dict(code=row["code"], line=index, yang=value)
            for row in db["hexagram_data"] for index, value in enumerate(row["lines"], 1)]
        db["hexagram_mapping_sources"] = [dict(pdf=274, printed="281", book_sha=SOURCE_SHA)]
        db["counts"].update(hexagrams=64, hexagram_lines=384, source_sections=21)
        return db

    def check_names(self, db):
        result = Audit()
        audit_database(result, db)
        return next(row[0] for row in result.findings if row[1].startswith("64 tên quẻ và trang"))

    def test_all_source_located_names_pass(self):
        self.assertEqual(self.check_names(self.named_db()), "PASS")

    def test_swapped_names_rejected(self):
        db = self.named_db()
        db["hexagram_data"][0]["name"], db["hexagram_data"][1]["name"] = (
            db["hexagram_data"][1]["name"], db["hexagram_data"][0]["name"])
        self.assertEqual(self.check_names(db), "FAIL")

    def test_wrong_edition_rejected(self):
        db = self.named_db()
        db["hexagram_data"][0]["book_sha"] = "0" * 64
        self.assertEqual(self.check_names(db), "FAIL")

    def test_unapproved_verified_name_rejected(self):
        db = self.named_db()
        db["hexagram_data"][0]["status"] = "VERIFIED"
        self.assertEqual(self.check_names(db), "FAIL")


if __name__ == "__main__":
    unittest.main()
