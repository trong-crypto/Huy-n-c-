import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify_calendar_rule as source
from audit_tv3 import Audit, audit_calendar


class CalendarReviewTests(unittest.TestCase):
    def test_pinned_snapshot_and_sql_are_scoped_to_calendar(self):
        manifest = source.load_review()
        sql = source.build_sql(manifest)
        self.assertIn("rule_code='LUNAR-CONVERSION'", sql)
        self.assertIn("verification_status='DRAFT'", sql)
        self.assertIn('C01 protected external source changed', sql)
        self.assertNotIn('UPDATE tam_the_lookup_entries', sql)
        self.assertEqual([1899, 2099], manifest['years'])

    def test_manifest_or_resource_mutation_cannot_be_approved(self):
        real = source.digest
        for target in (source.MANIFEST, source.ROOT / source.load_review()['resource']):
            with patch.object(source,'digest',side_effect=lambda path: '0'*64 if Path(path)==target else real(path)):
                with self.assertRaises(ValueError): source.load_review()

    def test_audit_rejects_approved_wrong_snapshot_or_reviewer(self):
        m=source.load_review()
        external={column:m[key] for column,key in zip(('source_id','title','version','section','url','sha256'),
                  ('sourceId','title','version','section','url','resourceSha256'))}
        db={'rules':[dict(module='CALENDAR',code='LUNAR-CONVERSION',status='VERIFIED',source=None,
                         external_id=m['sourceId'],reviewer=m['reviewer'],reviewed_at='2026-10-24',
                         verification_note=source.NOTE,description=source.DESCRIPTION)],
            'external_sources':[external],'migrations':['8']}
        audit=Audit();audit_calendar(audit,db)
        self.assertTrue(all(row[0]=='PASS' for row in audit.findings))
        for area,field,value in (('rules','reviewer',None),('rules','external_id','wrong'),('external_sources','sha256','0'*64)):
            changed=copy.deepcopy(db);changed[area][0][field]=value
            result=Audit();audit_calendar(result,changed)
            self.assertTrue(any(row[0]=='FAIL' for row in result.findings))


if __name__=='__main__': unittest.main()
