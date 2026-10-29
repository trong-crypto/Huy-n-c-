import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import verify_time_decision as source

class TimeOwnerDecisionTests(unittest.TestCase):
    def test_only_the_approved_time_rule_changes(self):
        sql=source.build_sql()
        self.assertIn("rule_code='MH-TIME'",sql)
        self.assertNotIn('MH-OBJECT-COUNT',sql)
        self.assertNotIn('UPDATE source_sections',sql)
        self.assertIn('source or protected rule changed',sql)
        self.assertIn("verification_status='BLOCKED_SOURCE_CONFLICT'",sql)

    def test_review_records_owner_approval_without_claiming_a_publisher_erratum(self):
        self.assertIn('Project owner confirmation via chat',source.REVIEWER)
        self.assertIn('VERIFIED scope: adopted project rule/correction MOD6',source.NOTE)
        self.assertIn('not a claim that the printed text agrees',source.NOTE)
        self.assertIn('moving=(Y+M+D+H)%6',source.DESCRIPTION)

if __name__=='__main__':unittest.main()
