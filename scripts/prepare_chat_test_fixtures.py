"""Create one synthetic CHAT-DATA-06 cohort in a dedicated local TEST database."""
from __future__ import annotations

import argparse
from getpass import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
from uuid import uuid4
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATTERN = r"huyenco_chat_fixture_test(?:_[a-z0-9]+)?"
SERVER_JAR = ROOT / "server/target/huyen-co-server-0.1.0-SNAPSHOT.jar"
HASH_SOURCE = """
import java.io.BufferedReader;
import java.io.InputStreamReader;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;

class ChatFixturePasswords {
    public static void main(String[] args) throws Exception {
        var encoder = new Argon2PasswordEncoder(16, 32, 1, 19 * 1024, 2);
        var input = new BufferedReader(new InputStreamReader(System.in));
        String password;
        while ((password = input.readLine()) != null) {
            System.out.println(encoder.encode(password));
        }
    }
}
"""


def hashes(jar: Path, java: str, passwords: list[str]) -> list[str]:
    with ZipFile(jar) as archive, tempfile.TemporaryDirectory(prefix="huyenco-chat-hash-") as directory:
        target = Path(directory)
        libraries = []
        for prefix in ("spring-security-crypto-", "spring-jcl-", "bcprov-"):
            matches = [name for name in archive.namelist()
                       if name.startswith("BOOT-INF/lib/" + prefix) and name.endswith(".jar")]
            if len(matches) != 1:
                raise ValueError(f"Expected one {prefix} library in the packaged Backend.")
            library = target / Path(matches[0]).name
            library.write_bytes(archive.read(matches[0]))
            libraries.append(str(library))
        source = target / "ChatFixturePasswords.java"
        source.write_text(HASH_SOURCE, encoding="utf-8")
        result = subprocess.run([java, "-cp", os.pathsep.join(libraries), str(source)],
                                input="\n".join(passwords) + "\n", text=True, encoding="utf-8",
                                capture_output=True, timeout=45)
    encoded = result.stdout.splitlines()
    if result.returncode or len(encoded) != len(passwords) or any(
            not re.fullmatch(r"\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+", item)
            for item in encoded):
        raise RuntimeError("Could not generate compatible Argon2id hashes. Check JDK 17 and the packaged Backend.")
    return encoded


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def fixture_statement(database: str, accounts: dict, active: str, pending: str) -> str:
    user, consultant, outsider, reviewer = (accounts[key] for key in ("user", "consultant", "outsider", "reviewer"))
    values = []
    for account in (user, consultant, outsider, reviewer):
        fields = [literal(account[key]) for key in ("id", "identifier", "displayName", "hash", "role", "status")]
        values.append("(" + ", ".join([*fields, "CURRENT_TIMESTAMP"]) + ")")
    account_rows = ",\n    ".join(values)
    return f"""
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $fixture_guard$
BEGIN
    IF current_database() <> {literal(database)}
        OR COALESCE((SELECT max(version::int) FROM public.flyway_schema_history WHERE success), 0) NOT BETWEEN 33 AND 38
        OR EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success)
    THEN
        RAISE EXCEPTION 'Expected the selected dedicated TEST database with successful Flyway V33 to V38';
    END IF;
END
$fixture_guard$;
INSERT INTO public.accounts (id, identifier_normalized, display_name, password_hash, role, status, created_at)
VALUES {account_rows};
INSERT INTO public.consultant_profiles
    (account_id, review_status, reviewed_by, reviewed_at, summary, submitted_by, submitted_at)
VALUES ('{consultant["id"]}', 'APPROVED', '{reviewer["id"]}', CURRENT_TIMESTAMP,
    'Hồ sơ tổng hợp dùng cho nghiệm thu Chat 1:1', '{reviewer["id"]}', CURRENT_TIMESTAMP);
INSERT INTO public.chat_conversations
    (id, user_account_id, consultant_account_id, status, started_at, create_request_id, last_message_sequence)
VALUES
    ('{active}', '{user["id"]}', '{consultant["id"]}', 'ACTIVE', CURRENT_TIMESTAMP, '{uuid4()}', 2),
    ('{pending}', '{user["id"]}', '{consultant["id"]}', 'PENDING', NULL, '{uuid4()}', 0);
INSERT INTO public.chat_messages
    (id, conversation_id, sender_account_id, client_message_id, sequence, body, created_at)
VALUES
    ('{uuid4()}', '{active}', '{user["id"]}', '{uuid4()}', 1, 'Tin TEST từ người dùng', CURRENT_TIMESTAMP),
    ('{uuid4()}', '{active}', '{consultant["id"]}', '{uuid4()}', 2, 'Tin TEST từ tư vấn viên', CURRENT_TIMESTAMP);
COMMIT;
"""


def prepare(args: argparse.Namespace) -> dict:
    if not re.fullmatch(DATABASE_PATTERN, args.database) or len(args.database) > 63:
        raise ValueError("Use a dedicated huyenco_chat_fixture_test database, optionally with a lowercase alphanumeric suffix.")
    if not 1 <= args.port <= 65535:
        raise ValueError("Invalid PostgreSQL port.")
    batch = secrets.token_hex(5)
    accounts = {}
    for key, label, role in (
        ("user", "Người dùng", "USER"),
        ("consultant", "Tư vấn viên", "CONSULTANT"),
        ("outsider", "Ngoài phòng", "USER"),
        ("reviewer", "Người duyệt", "ADMIN"),
    ):
        accounts[key] = dict(id=str(uuid4()), identifier=f"chat-{batch}-{key}",
                             displayName=f"Chat TEST {label} {batch}", role=role,
                             status="LOCKED" if key == "reviewer" else "ACTIVE", password=secrets.token_urlsafe(24))
    for account, password_hash in zip(accounts.values(), hashes(args.jar, args.java, [
            account["password"] for account in accounts.values()]), strict=True):
        account["hash"] = password_hash
    active, pending = str(uuid4()), str(uuid4())
    pg_password = os.environ.get("PGPASSWORD")
    if pg_password is None:
        pg_password = getpass("PostgreSQL TEST password: ")
    result = subprocess.run(
        [args.psql, "-X", "-w", "-q", "-h", "127.0.0.1", "-p", str(args.port),
         "-U", args.user, "-d", args.database, "-v", "ON_ERROR_STOP=1"],
        input=fixture_statement(args.database, accounts, active, pending),
        env=dict(os.environ, PGPASSWORD=pg_password, PGCLIENTENCODING="UTF8", PGCONNECT_TIMEOUT="5"),
        text=True, encoding="utf-8", capture_output=True, timeout=30,
    )
    if result.returncode:
        raise RuntimeError("Fixture transaction failed. Check the TEST datasource, Flyway V33–V38 and database permissions.")
    return {
        "database": args.database,
        "batch": batch,
        "accounts": {key: {field: account[field] for field in ("id", "identifier", "displayName", "role", "password")}
                     for key, account in accounts.items() if key != "reviewer"},
        "rooms": {"active": active, "pending": pending},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--psql", default="psql.exe")
    parser.add_argument("--java", default="java")
    parser.add_argument("--jar", type=Path, default=SERVER_JAR)
    try:
        output = prepare(parser.parse_args())
    except (ValueError, OSError, RuntimeError, subprocess.TimeoutExpired, EOFError) as failure:
        print(f"CHAT-DATA-06: {failure}", file=sys.stderr)
        return 1
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
