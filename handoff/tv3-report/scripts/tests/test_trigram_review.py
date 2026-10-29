import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify_trigram_rule as review


class TrigramReviewTest(unittest.TestCase):
    def test_manifest_matches_all_eight_imported_numbers_forms_and_elements(self):
        self.assertEqual(8, len(review.load_review()))

    def test_modified_manifest_cannot_be_used_for_approval(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "changed.csv"
            path.write_text(review.REVIEW.read_text(encoding="utf-8").replace("111", "110", 1), encoding="utf-8")
            with self.assertRaises(ValueError):
                review.load_review(path)


if __name__ == "__main__":
    unittest.main()
