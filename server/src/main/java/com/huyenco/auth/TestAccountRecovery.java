package com.huyenco.auth;

import java.io.Console;
import java.nio.CharBuffer;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;

/** Interactive tool for designated localhost TEST databases. Runs outside Spring Boot. */
public final class TestAccountRecovery {
    private static final String LOOPBACK = "127.0.0.1";
    private static final Map<String, Destination> TARGETS = Map.of(
            "huyenco_tv1_8b4b_clone", new Destination(5433, 27),
            "huyenco_recovery_cms_test_tv1v33", new Destination(55488, 33));
    private static final Set<String> REQUIRED = Set.of(
            "--host", "--port", "--database", "--user", "--identifier", "--account-id");

    private TestAccountRecovery() {}

    public static void main(String[] args) {
        Console console = System.console();
        if (console == null) {
            System.err.println("INTERACTIVE_CONSOLE_REQUIRED");
            System.exit(2);
            return;
        }
        int result = run(args, new Prompt() {
            @Override public char[] password(String label) { return console.readPassword("%s ", label); }
            @Override public String confirm(String label) { return console.readLine("%s ", label); }
            @Override public void print(String message) { console.writer().println(message); console.writer().flush(); }
        });
        System.exit(result);
    }

    static int run(String[] args, Prompt prompt) {
        try {
            Options target = Options.parse(args);
            try (Connection connection = connect(target, prompt)) {
                connection.setReadOnly(true);
                verifyDatabase(connection, target);
                Account account = requireAccount(connection, target, false);
                prompt.print("TARGET %s:%d/%s user=%s schema=V%d".formatted(
                        LOOPBACK, target.port, target.database, target.user, target.schema));
                prompt.print("ACCOUNT id=%s identifier=%s role=%s status=%s".formatted(
                        account.id, account.identifier, account.role, account.status));
                if (target.dryRun) {
                    prompt.print("DRY_RUN accounts_updated=0 sessions_revoked=0");
                    return 0;
                }

                String confirmation = target.database + " " + account.identifier + " " + account.id;
                prompt.print("Type exactly to confirm: " + confirmation);
                if (!confirmation.equals(prompt.confirm("Confirm:"))) throw new Stop("CONFIRMATION_MISMATCH");
                String hash = replacementHash(prompt);
                int revoked = apply(connection, target, account, hash);
                prompt.print("COMMITTED accounts_updated=1 sessions_revoked=" + revoked);
                return 0;
            }
        } catch (Stop stop) {
            prompt.print(stop.getMessage());
            return 2;
        } catch (SQLException error) {
            String state = error.getSQLState();
            prompt.print("DATABASE_ERROR" + (state != null && state.matches("[A-Z0-9]{5}") ? " sqlstate=" + state : ""));
            return 1;
        } catch (RuntimeException error) {
            prompt.print("RECOVERY_FAILED");
            return 1;
        }
    }

    private static Connection connect(Options target, Prompt prompt) throws SQLException {
        char[] password = prompt.password("PostgreSQL TEST role password:");
        if (password == null) throw new Stop("CANCELLED");
        var properties = new Properties();
        try {
            properties.setProperty("user", target.user);
            properties.setProperty("password", new String(password));
            properties.setProperty("connectTimeout", "5");
            return DriverManager.getConnection("jdbc:postgresql://" + LOOPBACK + ":" + target.port + "/" + target.database,
                    properties);
        } finally {
            properties.clear();
            Arrays.fill(password, '\0');
        }
    }

    private static void verifyDatabase(Connection connection, Options target) throws SQLException {
        try (var stmt = connection.createStatement();
             var rows = stmt.executeQuery("SELECT current_database(), host(inet_server_addr()), inet_server_port(), current_user")) {
            if (!rows.next() || !target.database.equals(rows.getString(1)) || !LOOPBACK.equals(rows.getString(2))
                    || target.port != rows.getInt(3) || !target.user.equals(rows.getString(4))) {
                throw new Stop("CONNECTED_DATABASE_MISMATCH");
            }
        }
        try (var stmt = connection.createStatement();
             var rows = stmt.executeQuery("""
                     SELECT version, success FROM flyway_schema_history
                     WHERE version IS NOT NULL ORDER BY installed_rank
                     """)) {
            for (int version = 1; version <= target.schema; version++) {
                if (!rows.next() || !Integer.toString(version).equals(rows.getString(1)) || !rows.getBoolean(2)) {
                    throw new Stop("FLYWAY_HISTORY_MISMATCH");
                }
            }
            if (rows.next()) throw new Stop("FLYWAY_HISTORY_MISMATCH");
        }
    }

    private static Account requireAccount(Connection connection, Options target, boolean lock) throws SQLException {
        String sql = "SELECT id, identifier_normalized, role, status FROM accounts WHERE id = ? AND identifier_normalized = ?";
        try (var stmt = connection.prepareStatement(lock ? sql + " FOR UPDATE" : sql)) {
            stmt.setObject(1, target.id);
            stmt.setString(2, target.identifier);
            try (var rows = stmt.executeQuery()) {
                if (!rows.next()) throw new Stop("ACCOUNT_IDENTITY_MISMATCH");
                var account = new Account(rows.getObject("id", UUID.class), rows.getString("identifier_normalized"),
                        rows.getString("role"), rows.getString("status"));
                if (rows.next()) throw new Stop("ACCOUNT_IDENTITY_MISMATCH");
                if (!"ACTIVE".equals(account.status)) throw new Stop("ACCOUNT_NOT_ACTIVE");
                return account;
            }
        }
    }

    private static String replacementHash(Prompt prompt) {
        char[] password = prompt.password("New account password:");
        char[] repeated = null;
        try {
            if (password == null) throw new Stop("CANCELLED");
            int length = Character.codePointCount(password, 0, password.length);
            if (length < 8 || length > 128 || CharBuffer.wrap(password).codePoints()
                    .anyMatch(c -> c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE)) {
                throw new Stop("INVALID_PASSWORD_LENGTH_OR_UNICODE");
            }
            repeated = prompt.password("Repeat new account password:");
            if (!Arrays.equals(password, repeated)) throw new Stop("PASSWORD_CONFIRMATION_MISMATCH");
            return AccountAuthService.passwordEncoder().encode(CharBuffer.wrap(password));
        } finally {
            if (password != null) Arrays.fill(password, '\0');
            if (repeated != null) Arrays.fill(repeated, '\0');
        }
    }

    private static int apply(Connection connection, Options target, Account original, String hash) throws SQLException {
        connection.setReadOnly(false);
        connection.setAutoCommit(false);
        try {
            if (!original.equals(requireAccount(connection, target, true))) throw new Stop("ACCOUNT_CHANGED");
            try (var stmt = connection.prepareStatement("UPDATE accounts SET password_hash = ? WHERE id = ? AND identifier_normalized = ?")) {
                stmt.setString(1, hash);
                stmt.setObject(2, target.id);
                stmt.setString(3, target.identifier);
                if (stmt.executeUpdate() != 1) throw new Stop("ACCOUNT_UPDATE_COUNT_MISMATCH");
            }
            try (var stmt = connection.prepareStatement("""
                    UPDATE account_sessions SET revoked_at = greatest(created_at, clock_timestamp())
                    WHERE account_id = ? AND revoked_at IS NULL AND expires_at > clock_timestamp()
                    """)) {
                stmt.setObject(1, target.id);
                int revoked = stmt.executeUpdate();
                connection.commit();
                return revoked;
            }
        } catch (SQLException | RuntimeException failure) {
            try { connection.rollback(); }
            catch (SQLException rollback) { failure.addSuppressed(rollback); }
            throw failure;
        }
    }

    interface Prompt {
        char[] password(String label);
        String confirm(String label);
        void print(String message);
    }

    private record Account(UUID id, String identifier, String role, String status) {}

    private record Destination(int port, int schema) {}

    private record Options(String database, int port, int schema, String user, String identifier, UUID id, boolean dryRun) {
        static Options parse(String[] args) {
            Map<String, String> values = new HashMap<>();
            boolean dryRun = false;
            for (int i = 0; i < args.length; i++) {
                String key = args[i];
                if ("--dry-run".equals(key) && !dryRun) {
                    dryRun = true;
                } else if (!REQUIRED.contains(key) || i + 1 >= args.length || args[i + 1].startsWith("--")
                        || values.putIfAbsent(key, args[++i]) != null) {
                    throw new Stop("INVALID_ARGUMENTS");
                }
            }
            if (!values.keySet().equals(REQUIRED)) throw new Stop("INVALID_ARGUMENTS");
            String database = values.get("--database");
            Destination destination = TARGETS.get(database);
            if (!LOOPBACK.equals(values.get("--host")) || destination == null
                    || !Integer.toString(destination.port).equals(values.get("--port"))) {
                throw new Stop("TEST_TARGET_NOT_ALLOWED");
            }
            String user = values.get("--user");
            String identifier = values.get("--identifier");
            String id = values.get("--account-id");
            if (!user.matches("[a-z][a-z0-9_]{0,62}") || "postgres".equals(user)
                    || identifier.isBlank() || identifier.length() > 254 || identifier.chars().anyMatch(Character::isISOControl)
                    || !id.matches("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
                throw new Stop("INVALID_ARGUMENTS");
            }
            return new Options(database, destination.port, destination.schema, user, identifier, UUID.fromString(id), dryRun);
        }
    }

    private static final class Stop extends RuntimeException {
        Stop(String code) { super(code); }
    }
}
