"""Timestamp cohort boundaries are predefined, independent of latency or outcomes."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_x01_matrix import select_cohort, cpu_summary


class CohortAuditTests(unittest.TestCase):
    def test_half_open_window_preserves_all_excluded_rows(self):
        rows = [{"requestId": name, "sendMonoMs": stamp, "latencyMs": latency}
                for name, stamp, latency in (("a", 10, 100), ("b", 99.9, 1), ("c", 100, 0.1), ("d", 100.022, 1000))]
        measured, outside = select_cohort(rows, {"start": 10, "end": 100})
        self.assertEqual([row["requestId"] for row in measured], ["a", "b"])
        self.assertEqual([row["requestId"] for row in outside], ["c", "d"])
        self.assertEqual(measured + outside, rows)

    def test_before_start_is_a_separate_error_not_silently_excluded(self):
        with self.assertRaisesRegex(ValueError, "before measurement"):
            select_cohort([{"sendMonoMs": 9}], {"start": 10, "end": 100})

    def test_cpu_units_can_exceed_one_core_without_being_percent_of_whole_machine(self):
        samples = [{"time": 0, "cpu": 0}, {"time": 1000, "cpu": 1.2}, {"time": 2000, "cpu": 2.4}]
        value = cpu_summary(samples, "time", ["cpu"], 1000)
        self.assertAlmostEqual(value["meanPercentOneCore"], 120)
        self.assertAlmostEqual(value["maxSamplePercentOneCore"], 120)


if __name__ == "__main__":
    unittest.main()
