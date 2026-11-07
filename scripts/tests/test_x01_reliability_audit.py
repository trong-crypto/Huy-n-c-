"""Corruption checks for the independent raw auditor, using the shared LINES fixture."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_x01_reliability import ROOT, success_oracle, cycle, STEPS


class ReliabilityAuditTests(unittest.TestCase):
    def setUp(self):
        self.response = json.loads((ROOT / "docs/examples/mai-hoa-lines.response.json").read_text(encoding="utf-8-sig"))
        self.payload = json.loads((ROOT / "docs/examples/mai-hoa-lines.request.json").read_text(encoding="utf-8-sig"))["payload"]
        self.input = {"payload": self.payload, "movingLine": 2, "pattern": 21}

    def test_shared_fixture_passes_but_wrong_session_result_fails(self):
        success_oracle(self.response, self.input)
        wrong = dict(self.input, payload=dict(self.payload, linesBottomUp=[False] * 6), pattern=0)
        with self.assertRaises(ValueError): success_oracle(self.response, wrong)

    def test_damaged_hexagram_or_unapproved_rule_is_rejected(self):
        for mutate in (lambda body: body["data"]["mutualHexagram"]["linesBottomUp"].reverse(),
                       lambda body: body["data"]["rules"][0].update(sourceStatus="SOURCE_LOCATED")):
            body = copy.deepcopy(self.response); mutate(body)
            with self.assertRaises(ValueError): success_oracle(body, self.input)

    def test_missing_progress_and_duplicate_terminal_are_rejected(self):
        frames = [{"destination": "progress", "body": {"sequence": i + 1, "step": step}} for i, step in enumerate(STEPS)]
        frames.append({"destination": "results", "body": self.response})
        cycle(frames)
        with self.assertRaises(ValueError): cycle(frames[1:])
        with self.assertRaises(ValueError): cycle(frames + [frames[-1]])

    def test_busy_rejection_must_not_have_business_progress(self):
        rejected = [{"destination": "errors", "body": {"error": {"code": "SERVER_BUSY"}}}]
        cycle(rejected, "SERVER_BUSY")
        with self.assertRaises(ValueError): cycle([{"destination": "progress", "body": {"step": "ACCEPTED"}}, *rejected], "SERVER_BUSY")


if __name__ == "__main__": unittest.main()
