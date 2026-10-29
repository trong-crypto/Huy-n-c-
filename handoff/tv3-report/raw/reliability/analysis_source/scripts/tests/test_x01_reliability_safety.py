"""Safety invariants for TEST-only X01.5; never opens a network connection."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_x01_reliability import reliability_command, ContentionGate, LOCK_SQL
from run_x01_benchmark import JVM_FLAGS, SETTINGS


class ReliabilitySafetyTests(unittest.TestCase):
    def setUp(self):
        self.target = {"database": "huyenco_benchmark_test_20261029_010531", "host": "127.0.0.1", "port": 5432, "username": "postgres",
            "jdbcUrl": "jdbc:postgresql://127.0.0.1:5432/huyenco_benchmark_test_20261029_010531", "schemaVersion": 12,
            "flywayEnabled": False, "backendHttpUrl": "http://127.0.0.1:18091", "webSocketUrl": "ws://127.0.0.1:18091/ws",
            "origin": "http://127.0.0.1:3173"}
        self.backend = {"javaExecutable": "java.exe", "jvmFlags": JVM_FLAGS, "jar": "scripts/generated/x01_test/backend.jar", "settings": SETTINGS}

    def test_stress_changes_only_worker_and_queue_and_keeps_real_ttl(self):
        normal = reliability_command(self.target, self.backend, "idempotency")
        stress = reliability_command(self.target, self.backend, "overload")
        self.assertEqual([(a, b) for a, b in zip(normal, stress) if a != b], [
            ("--huyenco.calculation-workers=4", "--huyenco.calculation-workers=2"),
            ("--huyenco.calculation-queue-capacity=100", "--huyenco.calculation-queue-capacity=4")])
        for command in (normal, stress):
            self.assertIn("--spring.flyway.enabled=false", command)
            self.assertIn("--spring.datasource.hikari.read-only=true", command)
            self.assertIn("--huyenco.idempotency-ttl-seconds=60", command)
            self.assertNotIn("password", " ".join(command).lower())

    def test_gate_refuses_production_and_arbitrary_sql(self):
        with self.assertRaises(ValueError):
            ContentionGate(dict(self.target, database="huyenco"), Path("."), Path("."))
        gate = ContentionGate(self.target, Path("."), Path("."))
        with self.assertRaises(ValueError): gate.action("DROP TABLE hexagrams")
        with self.assertRaises(ValueError): reliability_command(self.target, self.backend, "other")

    def test_gate_has_crash_watchdog_and_no_data_mutation_statement(self):
        self.assertIn("idle_in_transaction_session_timeout='4s'", LOCK_SQL)
        self.assertIn("LOCK TABLE public.hexagrams IN ACCESS EXCLUSIVE MODE", LOCK_SQL)
        for verb in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "ALTER", "DROP"):
            self.assertNotIn(verb, LOCK_SQL)


if __name__ == "__main__": unittest.main()
