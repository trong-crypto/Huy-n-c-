"""Safety checks for X01 cloning; no live database access."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare_x01_test_database import assert_clone_matches, validate_database_name, write_new_json


class PreparationSafetyTests(unittest.TestCase):
    def test_rejects_production_and_malformed_names(self):
        for name in ("huyenco", "postgres", "huyenco_benchmark_test_20260230_000000",
                     "huyenco_benchmark_test_20261029_120000'; DROP DATABASE huyenco;--"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_database_name(name, source=False)
        with self.assertRaises(ValueError):
            validate_database_name("huyenco_benchmark_test_20261029_120000", source=True)

    def test_accepts_only_corresponding_test_scopes(self):
        self.assertEqual(validate_database_name("huyenco_acceptance_test_20261028_184149", source=True),
                         "huyenco_acceptance_test_20261028_184149")
        validate_database_name("huyenco_benchmark_test_20261029_120000", source=False)

    def test_rejects_changed_knowledge_schema_and_private_rows(self):
        original = {"tables": {"hexagrams": {"count": 64, "sha256": "a"}}, "schemaSha256": "schema",
                    "runtimeCounts": {"anonymous_sessions": 0, "interpretation_history": 0}}
        assert_clone_matches(original, original)
        for path, value in (("tables", {}), ("schemaSha256", "different"),
                            ("runtimeCounts", {"anonymous_sessions": 1, "interpretation_history": 0})):
            with self.subTest(path=path), self.assertRaises(ValueError):
                assert_clone_matches(original, dict(original, **{path: value}))

    def test_existing_manifest_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "target.json"
            write_new_json(path, {"database": "original"})
            with self.assertRaises(FileExistsError):
                write_new_json(path, {"database": "replacement"})
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"database": "original"})


if __name__ == "__main__":
    unittest.main()
