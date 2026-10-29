"""E01 data, provenance, and guarded SQL regression checks (no live DB writes)."""
from __future__ import annotations

import csv
import sys
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import import_hexagram_glosses as e01  # noqa: E402


class HexagramGlossReviewTest(TestCase):
    def test_exact_64_pinned_rows(self) -> None:
        data = e01.load_review()
        self.assertEqual(len(data), 64)
        self.assertEqual({int(r['order']) for r in data}, set(range(1, 65)))
        self.assertEqual(len({r['hexagram_code'] for r in data}), 64)
        self.assertEqual({r['review_status'] for r in data}, {'VERIFIED'})
        self.assertEqual({r['reviewer'] for r in data}, {e01.REVIEWER})

    def test_original_ich_48_preserved(self) -> None:
        rows = e01.load_review()
        row = rows[47]
        self.assertEqual((row['canonical_name'], row['hexagram_code'], row['gloss']),
                         ('Tỉnh', 'H_KHAM_TON', 'Giếng nước'))
        self.assertEqual(row['printed_source_label'], 'Ích')
        self.assertIn(e01.CONFLICT, e01.note(row))
        self.assertEqual((row['pdf_page'], row['printed_page']), ('271', '278'))

    def test_guarded_sql_requires_pinned_source_and_identity(self) -> None:
        stage = e01.build_sql(e01.load_review(), review=False)
        approved = e01.build_sql(e01.load_review(), review=True)
        self.assertIn('64 S01 verified identities/pages required', approved)
        self.assertIn('wrong source PDF', approved)
        self.assertIn('protected existing NAME_GLOSS row', approved)
        self.assertIn('edited or conflicting gloss row', approved)
        self.assertIn('WHERE NOT EXISTS (SELECT 1 FROM interpretations', approved)
        self.assertIn("i.category='NAME_GLOSS' AND i.verification_status='SOURCE_LOCATED'", approved)
        self.assertIn('COMMIT;', approved)
        self.assertNotIn("SET verification_status='VERIFIED'", stage)
        self.assertEqual(approved.count('Giếng nước'), 2)  # row + printed ambiguity note

    def test_mutated_review_rejected_by_manifest(self) -> None:
        with e01.REVIEW_FILE.open(encoding='utf-8', newline='') as handle:
            lines = list(csv.DictReader(handle))
        lines[0]['gloss'] = 'tampered'
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as work:
            corrupt = Path(work) / 'review.csv'
            with corrupt.open('w', encoding='utf-8', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=lines[0].keys())
                writer.writeheader()
                writer.writerows(lines)
            with patch.object(e01, 'REVIEW_FILE', corrupt):
                with self.assertRaisesRegex(ValueError, 'manifest/data changed'):
                    e01.load_review()
