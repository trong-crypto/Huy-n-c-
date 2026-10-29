import copy
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import import_tam_the_year_elements as source
from audit_tv3 import Audit, audit_year_elements


class YearElementSourceTests(unittest.TestCase):
    def test_complete_cycle_matches_thirty_source_pairs(self):
        rows = source.load_records()
        self.assertEqual(60, len({source.entry_key(r) for r in rows}))
        self.assertEqual(30, len(source.load_review(rows)))
        self.assertEqual("KIM", rows[0]["element"])
        self.assertEqual(("KY", "DAU", "THO"), tuple(rows[45][k] for k in ("stem", "branch", "element")))
        self.assertEqual(("MAU", "NGO", "HOA"), tuple(rows[54][k] for k in ("stem", "branch", "element")))
        self.assertEqual(("CANH", "THAN", "MOC"), tuple(rows[56][k] for k in ("stem", "branch", "element")))

    def test_missing_duplicate_invalid_or_wrong_source_cell_is_rejected(self):
        rows = source.load_records()
        cases = [rows[:-1], rows + [rows[0]]]
        for key, value in (("stem", "AT"), ("branch", "SUU"), ("pdf_page", "12"),
                           ("source_column", "R"), ("element", "UNKNOWN")):
            changed = copy.deepcopy(rows)
            changed[0][key] = value
            cases.append(changed)
        for changed in cases:
            with self.subTest(changed=changed[0]), self.assertRaises(ValueError):
                source.validate_records(changed)

    def test_another_legal_element_cannot_bypass_recorded_review(self):
        rows = copy.deepcopy(source.load_records())
        rows[0]["element"], rows[2]["element"] = rows[2]["element"], rows[0]["element"]
        with self.assertRaises(ValueError):
            source.load_review(rows)

    def test_modified_import_and_review_files_require_new_review(self):
        with tempfile.TemporaryDirectory() as folder:
            for original, loader in ((source.DATA, source.load_records),
                                     (source.REVIEW, lambda path: source.load_review(source.load_records(), path))):
                path = Path(folder) / original.name
                path.write_text(original.read_text(encoding="utf-8").replace("KIM", "MOC", 1), encoding="utf-8")
                with self.assertRaises(ValueError):
                    loader(path)

    def test_windows_newlines_do_not_change_manifest_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "data.csv"
            path.write_bytes(source.DATA.read_text(encoding="utf-8").replace("\n", "\r\n").encode())
            self.assertEqual(source.load_records(), source.load_records(path))

    def test_audit_rejects_wrong_values_pages_and_unreviewed_entries(self):
        location = dict(pdf=11, printed="12", label="TT-NGU-HANH", book_sha=source.SOURCE_SHA)
        rows = [dict(key=source.entry_key(r), code=r["element"], title=source.title(r), description=None,
                     status="VERIFIED", editor=source.EDITOR, reviewer=source.REVIEWER, reviewed_at="2026-10-24",
                     verification_note=source.entry_note(r), **location) for r in source.load_records()]
        rule = dict(module="TAM_THE", code="TT-NGU-HANH", status="VERIFIED", reviewer=source.REVIEWER,
                    reviewed_at="2026-10-24", verification_note=source.RULE_NOTE, **location)
        db = dict(year_elements=rows, rules=[rule], migrations=["6"])
        audit = Audit()
        audit_year_elements(audit, db)
        self.assertTrue(all(row[0] == "PASS" for row in audit.findings))
        for field, value in (("code", "HOA"), ("pdf", 12), ("status", "SOURCE_LOCATED"),
                             ("reviewer", None), ("description", "unreviewed descriptor")):
            changed = copy.deepcopy(db)
            changed["year_elements"][0][field] = value
            audit = Audit()
            audit_year_elements(audit, changed)
            self.assertTrue(any(row[0] == "FAIL" for row in audit.findings), field)


if __name__ == "__main__":
    unittest.main()
