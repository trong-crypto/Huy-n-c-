"""Guard statistical interpretation and half-open time bins; no live DB required."""
from pathlib import Path
import statistics
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from summarize_x01_benchmark import nearest_rank, three_runs, relative_change, completion_bins


class AnalysisStatisticsTests(unittest.TestCase):
    def test_nearest_rank_is_not_interpolated(self):
        self.assertEqual(nearest_rank(list(range(1, 21)), .95), 19)
        self.assertEqual(nearest_rank([1, 2, 100], .95), 100)

    def test_median_of_run_p95_is_distinct_from_pooled_p95(self):
        runs = [[1] * 10, [10] * 10, [100] * 200]
        per_run = [nearest_rank(r, .95) for r in runs]
        self.assertEqual(three_runs(per_run)["median"], 10)
        self.assertEqual(nearest_rank(sum(runs, []), .95), 100)

    def test_three_runs_preserves_values_range_and_rejects_missing_run(self):
        self.assertEqual(three_runs([4, 1, 9]), {"values": [4, 1, 9], "median": 4, "min": 1, "max": 9})
        with self.assertRaises(ValueError): three_runs([1, 2])
        with self.assertRaises(ValueError): three_runs([1, 2, float("nan")])

    def test_delta_sign_and_denominator(self):
        self.assertAlmostEqual(relative_change(90, 100), -10)
        self.assertAlmostEqual(relative_change(110, 100), 10)
        with self.assertRaises(ValueError): relative_change(1, 0)

    def test_completion_bin_edges_do_not_include_end_or_warmup(self):
        rows = [{"terminalMonoMs": value} for value in (999, 1000, 1999.99, 2000, 60999.99, 61000)]
        bins = completion_bins(rows, {"start": 1000, "end": 61000})
        self.assertEqual(len(bins), 60)
        self.assertEqual((bins[0], bins[1], bins[-1], sum(bins)), (2, 1, 1, 4))

    def test_fractional_monotonic_window_preserves_float_precision(self):
        window = {"start": 10123.4567, "end": 70123.4567}
        bins = completion_bins([{"terminalMonoMs": 70123.4566}], window)
        self.assertEqual(sum(bins), 1)
        self.assertEqual(bins[-1], 1)


if __name__ == "__main__": unittest.main()
