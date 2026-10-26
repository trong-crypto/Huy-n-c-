"""Regression checks for source-review gates; no PostgreSQL connection needed."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from check_m01_readings import DATA, MANIFEST, ROOT, load_review, read_json, validate


class ReviewedSourceGates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_review()
        cls.manifest = read_json(MANIFEST)
        cls.survey = read_json(ROOT/'data/s04_reading_source_survey.json')

    def rejects(self, mutate):
        data = copy.deepcopy(self.data)
        mutate(data)
        with self.assertRaises((ValueError,KeyError)):
            validate(data,self.manifest,self.survey)

    def test_review_cannot_claim_independent_humans(self):
        self.rejects(lambda d: d['review'].update(independentHumanReview=True))

    def test_source_review_does_not_switch_runtime_on(self):
        self.rejects(lambda d: d.update(runtimeEnabled=True))

    def test_team_convention_cannot_become_verified_interpretation(self):
        self.rejects(lambda d: d['decisions'][0].update(basis='SOURCE_VERIFIED',purpose='INTERPRETATION'))

    def test_relation_direction_or_topic_cannot_be_duplicated(self):
        self.rejects(lambda d: d['maiHoaTemplates'].__setitem__(1,copy.deepcopy(d['maiHoaTemplates'][0])))

    def test_table_label_may_not_be_silently_corrected(self):
        self.rejects(lambda d: d['tamTheResults'][17].update(tableLabel='Phá'))

    def test_table_cell_cannot_be_changed_while_retaining_full_count(self):
        self.rejects(lambda d: d['tamTheMappings'][0].update(resultCode='TT-SANG-HEN-02'))

    def test_source_passage_pages_required(self):
        self.rejects(lambda d: d['maiHoaTemplates'][0]['source'].update(pdfPages=[]))

    def test_original_conflict_decision_cannot_be_omitted(self):
        self.rejects(lambda d: d['tamTheResults'][2].update(decisionIds=[]))

    def test_content_is_not_a_literal_book_quote(self):
        self.rejects(lambda d: d['tamTheResults'][0].update(textKind='VERBATIM'))

    def test_modified_content_and_updated_manifest_still_fail_code_pin(self):
        data = copy.deepcopy(self.data)
        data['tamTheResults'][0]['content'] = 'Unreviewed replacement'
        manifest = copy.deepcopy(self.manifest)
        import hashlib
        text = json.dumps(data,ensure_ascii=False)
        manifest['dataSha256'] = hashlib.sha256(text.encode('utf-8')).hexdigest()
        with tempfile.TemporaryDirectory() as folder:
            path, meta = Path(folder)/'data.json', Path(folder)/'manifest.json'
            path.write_text(text,encoding='utf-8')
            meta.write_text(json.dumps(manifest),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Pinned M01'):
                load_review(path,meta)

    def test_duplicate_json_keys_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'duplicate.json'
            path.write_text('{"topic":"LOVE","topic":"WEALTH"}',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Duplicate JSON key'):
                read_json(path)


if __name__ == '__main__':
    unittest.main()
