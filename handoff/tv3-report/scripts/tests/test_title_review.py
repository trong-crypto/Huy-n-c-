import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_hexagram_names import REVIEW, REVIEW_SHA, REVIEWER, build_sql, load_review


class TitleReviewTests(unittest.TestCase):
    def test_second_pass_has_64_distinct_patterns_and_matches_original_import(self):
        rows = load_review()
        self.assertEqual(len(rows), 64)
        self.assertEqual(len({row['lines_bottom_up'] for row in rows}), 64)
        by_code = {row['code']: row for row in rows}
        self.assertEqual(by_code['H_KHAM_LY']['name'], 'Ký tế')
        self.assertEqual(by_code['H_KHAM_LY']['lines_bottom_up'], '101010')
        self.assertEqual(by_code['H_CAN_DOAI']['name'], 'Lý')

    def test_modified_review_cannot_be_reused_as_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'changed.csv'
            target.write_text(REVIEW.read_text(encoding='utf-8').replace('111111', '000000', 1), encoding='utf-8')
            with self.assertRaises(ValueError):
                load_review(target)

    def test_newline_conversion_does_not_invalidate_review(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'windows.csv'
            target.write_bytes(REVIEW.read_bytes().replace(b'\n', b'\r\n'))
            self.assertEqual(len(load_review(target)), 64)

    def test_only_titles_are_approved_with_provenance_and_transaction(self):
        sql = build_sql(load_review())
        self.assertTrue(sql.startswith('BEGIN;'))
        self.assertTrue(sql.endswith('COMMIT;\n'))
        self.assertIn(REVIEWER, sql)
        self.assertIn('reviewed_at=CURRENT_TIMESTAMP', sql)
        self.assertNotIn('UPDATE calculation_rules', sql)
        self.assertNotIn('UPDATE interpretations', sql)


if __name__ == '__main__':
    unittest.main()
