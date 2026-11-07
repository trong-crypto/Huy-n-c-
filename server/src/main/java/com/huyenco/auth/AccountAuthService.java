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
    private record StoredSession(Account account, OffsetDateTime expiresAt) {}

    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final SecretKeySpec csrfKey;
    private final SecureRandom random = new SecureRandom();
    private final Argon2PasswordEncoder passwords = new Argon2PasswordEncoder(16, 32, 1, 19 * 1024, 2);
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

    Registration register(String displayName, String identifier, String password) {
        Account account = new Account(UUID.randomUUID(), displayName, "USER");
        String hash = passwordWork(() -> passwords.encode(password));
        int created = db.update("""
                INSERT INTO accounts(id, identifier_normalized, display_name, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (identifier_normalized) DO NOTHING
                """, account.id(), identifier, displayName, hash, account.role(), now());
        if (created == 0) throw new AuthFailure(409, "IDENTIFIER_TAKEN", "Định danh đã được sử dụng.");
        return new Registration(account);
    }

    Issued login(Realm realm, String identifier, String password, String previousToken) {
        Credentials credentials = credentials(identifier, false).orElse(null);
        String hash = credentials == null ? dummyHash : credentials.hash();
        boolean matches = passwordWork(() -> passwords.matches(password, hash));
        if (!matches || credentials == null || !credentials.active()) throw invalidCredentials();

        return transactions.execute(transaction -> {
            Credentials current = credentials(identifier, true).orElseThrow(AccountAuthService::invalidCredentials);
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
        if (token == null) throw AuthFailure.session();
        StoredSession stored = db.query("""
                SELECT a.id, a.display_name, a.role, s.expires_at
                FROM account_sessions s JOIN accounts a ON a.id = s.account_id
                WHERE s.token_hash = ? AND s.realm = ? AND s.revoked_at IS NULL
                  AND s.expires_at > ? AND a.status = 'ACTIVE'
                """, (row, index) -> new StoredSession(
                new Account(row.getObject("id", UUID.class), row.getString("display_name"), row.getString("role")),
                row.getObject("expires_at", OffsetDateTime.class)), tokenHash(token), realm.name(), now())
                .stream().findFirst().orElseThrow(AuthFailure::session);
        if (!realm.allows(stored.account().role())) throw AuthFailure.session();
        return session(stored.account(), stored.expiresAt(), realm, token);
    }

    void logout(Realm realm, String token, String csrf) {
        Session current = requireSession(realm, token);
        checkCsrf(current, csrf);
        if (revoke(realm, token, now()) == 0) throw AuthFailure.session();
    }

    void checkCsrf(Session session, String supplied) {
        if (supplied == null || !MessageDigest.isEqual(
                session.csrfToken().getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            throw AuthFailure.csrf();
        }
    }

    private Optional<Credentials> credentials(String identifier, boolean lock) {
        String sql = """
                SELECT id, display_name, role, password_hash, status
                FROM accounts WHERE identifier_normalized = ?
                """;
        return db.query(lock ? sql + " FOR UPDATE" : sql, (row, index) -> new Credentials(
                new Account(row.getObject("id", UUID.class), row.getString("display_name"), row.getString("role")),
                row.getString("password_hash"), "ACTIVE".equals(row.getString("status"))), identifier)
                .stream().findFirst();
    }

    private int revoke(Realm realm, String token, OffsetDateTime now) {
        return db.update("""
                UPDATE account_sessions SET revoked_at = ?
                WHERE token_hash = ? AND realm = ? AND revoked_at IS NULL AND expires_at > ?
                """, now, tokenHash(token), realm.name(), now);
    }

    private Session session(Account account, OffsetDateTime expiresAt, Realm realm, String token) {
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
