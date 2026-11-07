"""Fail-closed checks for the X01 orchestrator; no DB or Server is launched."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_x01_benchmark import generated_path, server_command, validate_target, JVM_FLAGS, SETTINGS


class RunnerSafetyTests(unittest.TestCase):
    def setUp(self):
        self.target = {"database": "huyenco_benchmark_test_20261029_010531", "host": "127.0.0.1", "port": 5432,
                       "jdbcUrl": "jdbc:postgresql://127.0.0.1:5432/huyenco_benchmark_test_20261029_010531",
                       "schemaVersion": 12, "flywayEnabled": False,
                       "backendHttpUrl": "http://127.0.0.1:18091", "webSocketUrl": "ws://127.0.0.1:18091/ws",
                       "origin": "http://127.0.0.1:3173"}

    def test_rejects_production_or_mismatched_target(self):
        validate_target(self.target)
        for key, value in (("database", "huyenco"), ("jdbcUrl", "jdbc:postgresql://127.0.0.1:5432/huyenco"),
                           ("host", "192.168.1.10"), ("flywayEnabled", True), ("schemaVersion", 11),
                           ("backendHttpUrl", "http://127.0.0.1:18090")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_target(dict(self.target, **{key: value}))

    def test_generated_paths_cannot_escape_artifact_directory(self):
        generated_path("scripts/generated/x01_test/backend.jar")
        with self.assertRaises(ValueError):
            generated_path("scripts/generated/../../server/pom.xml")

    def test_launch_is_read_only_and_cannot_enable_flyway_or_use_unknown_mode(self):
        backend = {"javaExecutable": "java.exe", "jvmFlags": JVM_FLAGS,
                   "jar": "scripts/generated/x01_test/backend.jar", "settings": SETTINGS}
        command = server_command(self.target, backend, "bounded")
        self.assertIn("--spring.flyway.enabled=false", command)
        self.assertIn("--spring.datasource.hikari.read-only=true", command)
        self.assertIn("--server.port=18091", command)
        self.assertIn("--huyenco.calculation-workers=4", command)
        self.assertFalse(any("password" in argument.lower() for argument in command))
        direct = server_command(self.target, backend, "direct")
        differences = [(a, b) for a, b in zip(command, direct) if a != b]
        self.assertEqual(differences, [("--huyenco.calculation-mode=bounded", "--huyenco.calculation-mode=direct")])
        with self.assertRaises(ValueError):
            server_command(self.target, backend, "bounded --spring.flyway.enabled=true")


if __name__ == "__main__":
    unittest.main()
