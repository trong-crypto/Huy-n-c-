package com.huyenco.auth;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static com.huyenco.auth.AccountAuthService.Realm.CUSTOMER;
import static org.junit.jupiter.api.Assertions.*;

class TestAccountRecoveryTest {
    private static final String DATABASE = "huyenco_recovery_cms_test_tv1v33";
    private static final String ROLE = "tv1_v33_disposable";
    private static final String OLD = " recovery-test-original ";
    private static final String NEW = " 🔑🔑🔑🔑🔑🔑 ";

    @Test
    void refusesProtectedDatabaseWrongHostAndWrongPortBeforePrompting() {
        var input = new Input(null);
        var args = arguments("test-account", UUID.randomUUID());
        for (var pair : List.of(new String[]{"--database", "huyenco_tv1_v27_test"},
                new String[]{"--host", "192.0.2.1"}, new String[]{"--port", "5432"})) {
            var bad = args.clone();
            for (int i = 0; i < bad.length; i += 2) if (bad[i].equals(pair[0])) bad[i + 1] = pair[1];
            assertEquals(2, TestAccountRecovery.run(bad, input));
        }
        assertEquals(0, input.passwordPrompts);
        assertEquals(List.of("TEST_TARGET_NOT_ALLOWED", "TEST_TARGET_NOT_ALLOWED", "TEST_TARGET_NOT_ALLOWED"), input.output);
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "HUYENCO_RUN_RECOVERY_DISPOSABLE_TEST", matches = "1")
    void dryRunAndRejectedInputsPreserveStateThenRestoreOnlyTheSelectedAccount() {
        Fixture f = fixture();
        var a = f.account("a");
        var b = f.account("b");
        var first = f.login(a, OLD);
        var second = f.login(a, OLD);
        var other = f.login(b, OLD);
        var history = UUID.randomUUID();
        f.db.update("""
                INSERT INTO account_history (id, owner_id, calculation_request_id, calculation_type, title,
                    created_at, rule_basis, result_snapshot)
                VALUES (?, ?, ?, 'MAI_HOA', 'Disposable recovery fixture', CURRENT_TIMESTAMP, 'SOURCE_VERIFIED', '{"test":true}')
                """, history, a.id, UUID.randomUUID());
        var before = f.snapshot(a);
        var untouched = f.snapshot(b);
        var args = arguments(a.identifier, a.id);
        var dry = java.util.Arrays.copyOf(args, args.length + 1);
        dry[args.length] = "--dry-run";
        var preview = new Input(null);
        assertEquals(0, TestAccountRecovery.run(dry, preview));
        assertEquals(1, preview.passwordPrompts);
        assertTrue(preview.output.contains("DRY_RUN accounts_updated=0 sessions_revoked=0"));
        assertTrue(preview.output.stream().anyMatch(line -> line.startsWith("TARGET ") && line.endsWith("schema=V33")));
        assertTrue(preview.output.stream().anyMatch(line -> line.endsWith("role=USER status=ACTIVE")));
        assertEquals(2, TestAccountRecovery.run(arguments(a.identifier, b.id), new Input(null)));
        assertEquals(2, TestAccountRecovery.run(args, new Input("wrong confirmation")));
        assertTrue(before.equals(f.snapshot(a)), "Rejected operations or dry-run changed the account");
        assertEquals(2, f.activeSessions(a));
        var confirmed = new Input(confirmation(a));
        assertEquals(0, TestAccountRecovery.run(args, confirmed));
        assertTrue(confirmed.output.contains("COMMITTED accounts_updated=1 sessions_revoked=2"));
        assertTrue(confirmed.output.stream().noneMatch(line -> line.contains(NEW) || line.contains("$argon2")));
        assertEquals(0, f.activeSessions(a));
        assertThrows(AuthFailure.class, () -> f.auth.requireSession(CUSTOMER, first.token()));
        assertThrows(AuthFailure.class, () -> f.auth.requireSession(CUSTOMER, second.token()));
        assertEquals("INVALID_CREDENTIALS", assertThrows(AuthFailure.class, () -> f.login(a, OLD)).code);
        assertEquals(a.id, f.login(a, NEW).session().account().id());
        assertEquals(before.identity, f.snapshot(a).identity);
        assertTrue(untouched.equals(f.snapshot(b)), "Recovery changed another account");
        assertEquals(b.id, f.auth.requireSession(CUSTOMER, other.token()).account().id());
        assertEquals(b.id, f.login(b, OLD).session().account().id());
        assertEquals("true", f.db.queryForObject("SELECT result_snapshot->>'test' FROM account_history WHERE id=? AND owner_id=?",
                String.class, history, a.id));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "HUYENCO_RUN_RECOVERY_DISPOSABLE_TEST", matches = "1")
    void rollsBackHashAndSessionWhenRevocationFails() {
        Fixture f = fixture();
        var account = f.account("rollback");
        var issued = f.login(account, OLD);
        var before = f.snapshot(account);
        String name = "tv1_recovery_" + UUID.randomUUID().toString().replace("-", "");
        f.db.execute("CREATE FUNCTION " + name + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.account_id = '"
                + account.id + "'::uuid AND NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$");
        try {
            f.db.execute("CREATE TRIGGER " + name + " BEFORE UPDATE ON account_sessions FOR EACH ROW EXECUTE FUNCTION " + name + "()");
            try {
                var input = new Input(confirmation(account));
                assertEquals(1, TestAccountRecovery.run(arguments(account.identifier, account.id), input));
                assertTrue(input.output.contains("DATABASE_ERROR sqlstate=P0001"));
                assertTrue(before.equals(f.snapshot(account)), "Failed transaction changed the password hash");
                assertEquals(account.id, f.auth.requireSession(CUSTOMER, issued.token()).account().id());
                assertEquals(account.id, f.login(account, OLD).session().account().id());
            } finally {
                f.db.execute("DROP TRIGGER " + name + " ON account_sessions");
            }
        } finally {
            f.db.execute("DROP FUNCTION " + name + "()");
        }
    }

    private static Fixture fixture() {
        var source = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55488/" + DATABASE, ROLE, "");
        var db = new JdbcTemplate(source);
        assertEquals(DATABASE + "|127.0.0.1|55488|" + ROLE + "|33", db.queryForObject("""
                SELECT concat_ws('|',current_database(),host(inet_server_addr()),inet_server_port(),current_user,
                    (SELECT count(*) FROM flyway_schema_history WHERE success AND version::int BETWEEN 1 AND 33))
                """, String.class));
        var auth = new AccountAuthService(db, new DataSourceTransactionManager(source), Clock.systemUTC(),
                Base64.getEncoder().encodeToString(new byte[32]));
        return new Fixture(db, auth);
    }

    private static String[] arguments(String identifier, UUID id) {
        return new String[]{"--host", "127.0.0.1", "--port", "55488", "--database", DATABASE,
                "--user", ROLE, "--identifier", identifier, "--account-id", id.toString()};
    }

    private static String confirmation(Account account) {
        return DATABASE + " " + account.identifier + " " + account.id;
    }

    private record Account(UUID id, String identifier) {}
    private record Snapshot(String identity, String hash) {}
    private record Fixture(JdbcTemplate db, AccountAuthService auth) {
        Account account(String label) {
            String identifier = "recovery-" + label + "-" + UUID.randomUUID().toString().substring(0, 8);
            return new Account(auth.register("Disposable " + label, identifier, OLD).account().id(), identifier);
        }

        AccountAuthService.Issued login(Account account, String password) {
            return auth.login(CUSTOMER, account.identifier, password, null);
        }

        Snapshot snapshot(Account account) {
            return db.queryForObject("""
                    SELECT concat_ws('|',id,identifier_normalized,display_name,role,status,created_at),password_hash
                    FROM accounts WHERE id=?
                    """, (row, n) -> new Snapshot(row.getString(1), row.getString(2)), account.id);
        }

        int activeSessions(Account account) {
            return db.queryForObject("SELECT count(*) FROM account_sessions WHERE account_id=? AND revoked_at IS NULL",
                    Integer.class, account.id);
        }
    }

    private static final class Input implements TestAccountRecovery.Prompt {
        private final String confirmation;
        private final List<String> output = new ArrayList<>();
        private int passwordPrompts;

        Input(String confirmation) { this.confirmation = confirmation; }
        @Override public char[] password(String label) { return passwordPrompts++ == 0 ? new char[0] : NEW.toCharArray(); }
        @Override public String confirm(String label) { return confirmation; }
        @Override public void print(String message) { output.add(message); }
    }
}
