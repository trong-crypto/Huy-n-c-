package com.huyenco.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AccountAuthService {
    enum Realm {
        CUSTOMER("huyenco_account_session", Duration.ofHours(24)),
        ADMIN("huyenco_admin_session", Duration.ofHours(8));

        final String cookie;
        final Duration lifetime;

        Realm(String cookie, Duration lifetime) {
            this.cookie = cookie;
            this.lifetime = lifetime;
        }

        boolean allows(String role) {
            return this == ADMIN ? "ADMIN".equals(role) : "USER".equals(role) || "CONSULTANT".equals(role);
        }
    }

    record Account(UUID id, String displayName, String role) {}
    record Registration(Account account) {}
    record Session(Account account, String expiresAt, String csrfToken) {}
    record Issued(String token, Session session) {}
    private record Credentials(Account account, String hash, boolean active) {}
    record StoredSession(Account account, OffsetDateTime expiresAt, UUID sessionId) {}
    private record PendingPassword(UUID id, String fingerprint, String replacementHash) {}
    enum PasswordDecision { APPROVE, REJECT }

    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final SecretKeySpec csrfKey;
    private final SecureRandom random = new SecureRandom();
    private final Argon2PasswordEncoder passwords = passwordEncoder();
    private final Semaphore passwordSlots = new Semaphore(4);
    private final String dummyHash;

    AccountAuthService(JdbcTemplate db, PlatformTransactionManager transactionManager, Clock clock,
                       @Value("${huyenco.auth.csrf-key}") String csrfKey) {
        this.db = db;
        this.transactions = new TransactionTemplate(transactionManager);
        this.clock = clock;
        byte[] key = Base64.getDecoder().decode(csrfKey);
        if (key.length != 32) throw new IllegalArgumentException("AUTH_CSRF_KEY must be 32 bytes encoded as Base64");
        this.csrfKey = new SecretKeySpec(key, "HmacSHA256");
        this.dummyHash = passwords.encode(newToken());
    }

    static Argon2PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19 * 1024, 2);
    }

    Registration register(String displayName, String identifier, String password, String phoneNumber) {
        Account account = new Account(UUID.randomUUID(), displayName, "USER");
        String hash = passwordWork(() -> passwords.encode(password));
        int created = db.update("""
                INSERT INTO accounts(id, identifier_normalized, display_name, password_hash, role, created_at, phone_number)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (identifier_normalized) DO NOTHING
                """, account.id(), identifier, displayName, hash, account.role(), now(), phoneNumber);
        if (created == 0) throw new AuthFailure(409, "IDENTIFIER_TAKEN", "Định danh đã được sử dụng.");
        return new Registration(account);
    }

    Issued login(Realm realm, String identifier, String password, String previousToken) {
        Credentials credentials = credentials("identifier_normalized", identifier, false).orElse(null);
        String hash = credentials == null ? dummyHash : credentials.hash();
        boolean matches = passwordWork(() -> passwords.matches(password, hash));
        if (!matches || credentials == null || !credentials.active()) throw invalidCredentials();

        return transactions.execute(transaction -> {
            Credentials current = credentials("identifier_normalized", identifier, true)
                    .orElseThrow(AccountAuthService::invalidCredentials);
            if (!current.active() || !current.account().id().equals(credentials.account().id())
                    || !current.hash().equals(hash)) {
                throw invalidCredentials();
            }
            if (!realm.allows(current.account().role())) {
                throw new AuthFailure(403, "FORBIDDEN", "Tài khoản không có quyền đăng nhập tại cổng này.");
            }
            OffsetDateTime createdAt = now();
            OffsetDateTime expiresAt = createdAt.plus(realm.lifetime);
            if (previousToken != null) revoke(realm, previousToken, createdAt);
            String token = newToken();
            db.update("""
                    INSERT INTO account_sessions(id, account_id, realm, token_hash, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), current.account().id(), realm.name(), tokenHash(token), createdAt, expiresAt);
            return new Issued(token, session(current.account(), expiresAt, realm, token));
        });
    }

    Session requireSession(Realm realm, String token) {
        StoredSession stored = requireStoredSession(realm, token);
        return session(stored.account(), stored.expiresAt(), realm, token);
    }

    StoredSession requireStoredSession(Realm realm, String token) {
        if (token == null) throw AuthFailure.session();
        return requireStoredSession(realm, "s.token_hash", tokenHash(token));
    }

    StoredSession requireStoredSessionById(Realm realm, UUID sessionId) {
        return requireStoredSession(realm, "s.id", sessionId);
    }

    private StoredSession requireStoredSession(Realm realm, String column, Object value) {
        StoredSession stored = db.query("""
                SELECT a.id, a.display_name, a.role, s.expires_at, s.id AS session_id
                FROM account_sessions s JOIN accounts a ON a.id = s.account_id
                WHERE
                """ + column + """
                 = ? AND s.realm = ? AND s.revoked_at IS NULL
                  AND s.expires_at > ? AND a.status = 'ACTIVE'
                """, (row, index) -> new StoredSession(
                new Account(row.getObject("id", UUID.class), row.getString("display_name"), row.getString("role")),
                row.getObject("expires_at", OffsetDateTime.class), row.getObject("session_id", UUID.class)),
                value, realm.name(), now())
                .stream().findFirst().orElseThrow(AuthFailure::session);
        if (!realm.allows(stored.account().role())) throw AuthFailure.session();
        return stored;
    }

    void logout(Realm realm, String token, String csrf) {
        Session current = requireSession(realm, token);
        checkCsrf(current, csrf);
        if (revoke(realm, token, now()) == 0) throw AuthFailure.session();
    }

    void changePassword(Realm realm, String token, UUID accountId, String currentPassword, String newPassword) {
        Credentials initial = credentials("id", accountId, false).orElseThrow(AuthFailure::session);
        if (!initial.active() || !realm.allows(initial.account().role())) throw AuthFailure.session();
        String replacement = passwordWork(() -> {
            if (!passwords.matches(currentPassword, initial.hash())) throw invalidCredentials();
            return passwords.encode(newPassword);
        });

        transactions.executeWithoutResult(transaction -> {
            // Login locks the same account before issuing a session and rechecks its password hash.
            Credentials locked = credentials("id", accountId, true).orElseThrow(AuthFailure::session);
            if (!locked.active() || !realm.allows(locked.account().role()) || !locked.hash().equals(initial.hash())) {
                throw AuthFailure.session();
            }
            OffsetDateTime changedAt = now();
            // A concurrent logout or expiry must prevent the password update.
            if (revoke(realm, token, changedAt) == 0) throw AuthFailure.session();
            replacePassword(accountId, replacement, changedAt);
            db.update("""
                    UPDATE password_change_requests SET status='CANCELLED', expected_hash_fingerprint=NULL,
                        replacement_hash=NULL, decided_at=?
                    WHERE account_id=? AND status='PENDING'
                    """, changedAt, accountId);
        });
    }

    void requestPasswordChange(String token, UUID accountId, String currentPassword, String newPassword) {
        Credentials initial = credentials("id", accountId, false).orElseThrow(AuthFailure::session);
        String replacement = passwordWork(() -> {
            if (!passwords.matches(currentPassword, initial.hash())) throw invalidCredentials();
            return passwords.encode(newPassword);
        });
        transactions.executeWithoutResult(tx -> {
            Credentials locked = credentials("id", accountId, true).orElseThrow(AuthFailure::session);
            if (!locked.hash().equals(initial.hash()) || !requireSession(Realm.CUSTOMER, token).account().id().equals(accountId)) {
                throw AuthFailure.session();
            }
            int inserted = db.update("""
                    INSERT INTO password_change_requests(id, account_id, requested_at, status, expected_hash_fingerprint, replacement_hash)
                    VALUES (?, ?, ?, 'PENDING', ?, ?) ON CONFLICT (account_id) WHERE status='PENDING' DO NOTHING
                    """, UUID.randomUUID(), accountId, now(), tokenHash(locked.hash()), replacement);
            if (inserted == 0) throw new AuthFailure(409, "PASSWORD_REQUEST_PENDING", "Tài khoản đã có yêu cầu chờ duyệt.");
        });
    }

    void decidePasswordChange(UUID accountId, UUID requestId, UUID adminId, PasswordDecision decision) {
        transactions.executeWithoutResult(tx -> {
            Credentials locked = credentials("id", accountId, true).orElseThrow(AccountAuthService::passwordRequestChanged);
            if (!Realm.CUSTOMER.allows(locked.account().role())) throw passwordRequestChanged();
            var request = db.query("""
                    SELECT id, expected_hash_fingerprint, replacement_hash FROM password_change_requests
                    WHERE id=? AND account_id=? AND status='PENDING'
                    """, (row, index) -> new PendingPassword(row.getObject("id", UUID.class), row.getString(2), row.getString(3)),
                    requestId, accountId).stream().findFirst().orElseThrow(AccountAuthService::passwordRequestChanged);
            OffsetDateTime decidedAt = now();
            if (decision == PasswordDecision.APPROVE) {
                if (!locked.active() || !tokenHash(locked.hash()).equals(request.fingerprint())) throw passwordRequestChanged();
                replacePassword(accountId, request.replacementHash(), decidedAt);
            }
            db.update("""
                    UPDATE password_change_requests SET status=?, expected_hash_fingerprint=NULL, replacement_hash=NULL,
                        decided_by=?, decided_at=? WHERE id=?
                    """, decision == PasswordDecision.APPROVE ? "APPROVED" : "REJECTED", adminId, decidedAt, request.id());
        });
    }

    private void replacePassword(UUID accountId, String replacement, OffsetDateTime changedAt) {
        db.update("UPDATE accounts SET password_hash = ? WHERE id = ?", replacement, accountId);
        db.update("""
                UPDATE account_sessions SET revoked_at = greatest(created_at, ?)
                WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ?
                """, changedAt, accountId, changedAt);
    }

    private static AuthFailure passwordRequestChanged() {
        return new AuthFailure(409, "PASSWORD_REQUEST_CHANGED", "Yêu cầu đã thay đổi hoặc tài khoản không thể đổi mật khẩu.");
    }

    void checkCsrf(Session session, String supplied) {
        checkCsrfToken(session.csrfToken(), supplied);
    }

    static void checkCsrfToken(String expected, String supplied) {
        if (supplied == null || !MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            throw AuthFailure.csrf();
        }
    }

    private Optional<Credentials> credentials(String column, Object value, boolean lock) {
        String sql = """
                SELECT id, display_name, role, password_hash, status
                FROM accounts WHERE
                """ + column + " = ?";
        return db.query(lock ? sql + " FOR UPDATE" : sql, (row, index) -> new Credentials(
                new Account(row.getObject("id", UUID.class), row.getString("display_name"), row.getString("role")),
                row.getString("password_hash"), "ACTIVE".equals(row.getString("status"))), value)
                .stream().findFirst();
    }

    private int revoke(Realm realm, String token, OffsetDateTime now) {
        return db.update("""
                UPDATE account_sessions SET revoked_at = ?
                WHERE token_hash = ? AND realm = ? AND revoked_at IS NULL AND expires_at > ?
                """, now, tokenHash(token), realm.name(), now);
    }

    Session session(Account account, OffsetDateTime expiresAt, Realm realm, String token) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(csrfKey);
            byte[] payload = ("huyenco-auth-csrf-v1:" + realm.name() + ":" + token).getBytes(StandardCharsets.UTF_8);
            return new Session(account, expiresAt.toInstant().toString(), TOKEN_ENCODER.encodeToString(mac.doFinal(payload)));
        } catch (GeneralSecurityException failure) {
            throw new IllegalStateException("Cannot derive account CSRF token", failure);
        }
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return TOKEN_ENCODER.encodeToString(bytes);
    }

    private static String tokenHash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (GeneralSecurityException failure) {
            throw new IllegalStateException("Cannot hash account session token", failure);
        }
    }

    private <T> T passwordWork(Supplier<T> work) {
        if (!passwordSlots.tryAcquire()) throw AuthFailure.limited(1);
        try {
            return work.get();
        } finally {
            passwordSlots.release();
        }
    }

    private OffsetDateTime now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
    }

    private static AuthFailure invalidCredentials() {
        return new AuthFailure(401, "INVALID_CREDENTIALS", "Định danh hoặc mật khẩu không hợp lệ.");
    }
}
