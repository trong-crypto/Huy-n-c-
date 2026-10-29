import copy
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import import_tam_the_career as source
from audit_tv3 import Audit, audit_career


class CareerSourceTests(unittest.TestCase):
    def test_source_lookup_is_inverse_of_printed_month_cells(self):
        rows = source.load_records()
        career = {(r['key'], r['code']): r for r in rows if r['rule'] == source.CODES[1]}
        self.assertEqual(120, len(career))
        self.assertIn(('STEM:AT|MONTH:01', 'CAREER13_C12'), career)
        self.assertIn(('STEM:AT|MONTH:02', 'CAREER13_C01'), career)
        self.assertIn(('STEM:QUY|MONTH:01', 'CAREER13_C04'), career)
        self.assertEqual({35, 36}, {r['content_page'] for r in career.values()})

    def test_source_correction_preserves_multiple_occupations(self):
        rows = source.load_records()
        pairs = {(r['key'], r['code']) for r in rows if r['rule'] == source.CODES[0]}
        self.assertEqual(51, len(pairs))
        self.assertIn(('ELEMENT:THUY|MONTH:08', 'CAU_CHAI'), pairs)
        self.assertNotIn(('ELEMENT:THUY|MONTH:09', 'CAU_CHAI'), pairs)
        self.assertIn(('ELEMENT:THUY|MONTH:08', 'MUA_BAN'), pairs)
        self.assertEqual({'MUA_BAN', 'CAU_CHAI', 'LAM_THO'},
                         {code for key, code in pairs if key == 'ELEMENT:KIM|MONTH:10'})

    def test_source_labels_and_passage_headings_are_not_silently_rewritten(self):
        rows = source.load_records()
        at1 = next(r for r in rows if r['key'] == 'STEM:AT|MONTH:01')
        self.assertEqual(('Thứ Tác', 'Thủ Tất'), (at1['table_label'], at1['heading']))
        self.assertIn('trồng răng', at1['content'])
        self.assertIn('POSITIONAL_EDITORIAL_LINK', at1['note'])
        self.assertIsNone(next(r for r in rows if r['rule'] == source.CODES[0])['content'])

    def test_modified_source_text_cells_review_or_manifest_cannot_be_auto_approved(self):
        for filename, old, new in (
            ('tam_the_career11_source.csv', '2;4;6;8;11', '2;4;6;9;11'),
            ('tam_the_career13_matrix.csv', 'GIAP,1,2,3', 'GIAP,2,1,3'),
            ('tam_the_career13_texts.csv', 'thợ rèn', 'invented result'),
            ('tam_the_career13_column_review.csv', '1;2;3;4;5;6;7;8;9;10', '2;1;3;4;5;6;7;8;9;10'),
            ('tam_the_career_review.json', 'same-tool second pass', 'independent reviewer'),
        ):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as folder:
                for path in (source.ROOT / 'data').glob('tam_the_career*'):
                    shutil.copyfile(path, Path(folder) / path.name)
                changed = Path(folder) / filename
                text = changed.read_text(encoding='utf-8')
                self.assertIn(old, text)
                changed.write_text(text.replace(old, new, 1), encoding='utf-8')
                with self.assertRaises(ValueError):
                    source.load_records(folder)

    def test_windows_newlines_keep_review_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            for path in (source.ROOT / 'data').glob('tam_the_career*'):
                (Path(folder) / path.name).write_bytes(path.read_text(encoding='utf-8').replace('\n', '\r\n').encode())
            self.assertEqual(source.load_records(), source.load_records(folder))

    def test_audit_detects_changed_passage_labels_source_or_reviewer(self):
        rows = []
        for e in source.load_records():
            label, printed = source.SOURCE_PAGES[e['table_page']]
            page = e['content_page']
            rows.append(dict(e, label=label, printed=printed, book_sha=source.SOURCE_SHA,
                             status='VERIFIED', editor=source.EDITOR, reviewer=source.REVIEWER,
                             reviewed_at='2026-10-24', content_label=source.SOURCE_PAGES[page][0] if page else None,
                             content_printed=str(page+1) if page else None, content_book_sha=source.SOURCE_SHA if page else None))
        rules = [dict(module='TAM_THE', code=code, status='VERIFIED', reviewer=source.REVIEWER,
                      reviewed_at='2026-10-24', verification_note=source.RULE_NOTES[code],
                      description=source.DESCRIPTIONS[code], pdf=32 if code==source.CODES[0] else 35,
                      label=code, book_sha=source.SOURCE_SHA) for code in source.CODES]
        db = dict(career_entries=rows, rules=rules, migrations=['7'])
        self.assertTrue(audit_career(Audit(), db))
        index = next(i for i,r in enumerate(rows) if r['key']=='STEM:AT|MONTH:01')
        for field,value in (('content','invented'),('heading','Thứ Tác'),('content_page',35),
                            ('content_book_sha','wrong'),('reviewer',None),('status','SOURCE_LOCATED')):
            changed=copy.deepcopy(db)
            changed['career_entries'][index][field]=value
            with self.subTest(field=field):
                self.assertFalse(audit_career(Audit(), changed))


if __name__ == '__main__':
    unittest.main()
