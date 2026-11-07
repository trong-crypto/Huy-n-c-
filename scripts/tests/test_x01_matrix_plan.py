"""Matrix coverage guards; never starts a process or accesses PostgreSQL."""
from collections import Counter
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_x01_matrix import MATRIX, validate_matrix


class MatrixPlanTests(unittest.TestCase):
    def test_official_order_covers_six_cells_three_times(self):
        validate_matrix(MATRIX)
        self.assertEqual(Counter((clients, mode) for _, clients, mode in MATRIX),
                         {(clients, mode): 3 for clients in (2, 5, 20) for mode in ("direct", "bounded")})
        self.assertEqual([row[0] for row in MATRIX], [1] * 6 + [2] * 6 + [3] * 6)
        self.assertEqual(MATRIX[:2], [(1, 2, "direct"), (1, 2, "bounded")])
        self.assertEqual(MATRIX[-2:], [(3, 20, "bounded"), (3, 20, "direct")])

    def test_missing_or_duplicate_cell_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_matrix(MATRIX[:-1])
        with self.assertRaises(ValueError):
            validate_matrix([*MATRIX[:-1], MATRIX[0]])


if __name__ == "__main__":
    unittest.main()
