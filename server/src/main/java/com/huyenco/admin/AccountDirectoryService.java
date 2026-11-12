package com.huyenco.admin;

import com.huyenco.common.exception.ContractException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
final class AccountDirectoryService {
    enum Role { USER, ADMIN, CONSULTANT }
    enum Status { ACTIVE, LOCKED }
    record Account(UUID id, String identifier, String displayName, Role role, Status status, int version,
                   String createdAt, boolean canChangeStatus) {}
    record StatusChange(UUID actorId, Status previousStatus, Status status, int revokedSessions, String occurredAt) {}
    record RoleChange(UUID actorId, Role previousRole, Role role, int revokedSessions, String occurredAt) {}
    record Detail(Account account, StatusChange lastStatusChange, RoleChange lastRoleChange, List<Role> allowedRoleChanges,
                  String phoneNumber, PasswordRequest passwordRequest) {}
    record PasswordRequest(UUID id, String requestedAt) {}
    record Page(List<Account> items, int page, int size, long totalElements, long totalPages) {}

    private static final String COLUMNS = "id,identifier_normalized,display_name,role,status,status_version,created_at";
    private final JdbcTemplate db;
    private final Clock clock;
    private final TransactionTemplate reads;
    private final TransactionTemplate writes;

    AccountDirectoryService(JdbcTemplate db, Clock clock, PlatformTransactionManager transactions) {
        this.db = db;
        this.clock = clock;
        this.writes = new TransactionTemplate(transactions);
        this.reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    Page list(String query, Role role, Status status, boolean passwordPending, int page, int size) {
        String filter = """
                FROM accounts
                WHERE (strpos(lower(identifier_normalized),lower(?)) > 0 OR strpos(lower(display_name),lower(?)) > 0)
                """;
        var parameters = new java.util.ArrayList<Object>(List.of(query, query));
        if (role != null) { filter += " AND role=?"; parameters.add(role.name()); }
        if (status != null) { filter += " AND status=?"; parameters.add(status.name()); }
        if (passwordPending) filter += " AND EXISTS (SELECT 1 FROM password_change_requests r WHERE r.account_id=accounts.id AND r.status='PENDING')";
        String where = filter;
        return reads.execute(tx -> {
            long total = db.queryForObject("SELECT count(*) " + where, Long.class, parameters.toArray());
            var paged = new java.util.ArrayList<>(parameters);
            paged.add(size);
            paged.add((long) page * size);
            var items = db.query("SELECT " + COLUMNS + " " + where + " ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
                    AccountDirectoryService::account, paged.toArray());
            return new Page(items, page, size, total, (total + size - 1) / size);
        });
    }

    Detail detail(UUID id) {
        return reads.execute(tx -> detail(load(id, false)));
    }

    Detail change(UUID id, int expectedVersion, Status requested, UUID actor) {
        return writes.execute(tx -> {
            // Login also locks this account row before issuing a session.
            Account current = load(id, true);
            if (!current.canChangeStatus()) throw new ContractException("FORBIDDEN", "Không thể đổi trạng thái tài khoản Admin tại đây.");
            requireVersion(current, expectedVersion);
            if (current.status() == requested) throw new ContractException("INVALID_TRANSITION", "Trạng thái tài khoản chưa thay đổi.");

            OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
            int version = Math.incrementExact(current.version());
            db.update("UPDATE accounts SET status=?, status_version=? WHERE id=?", requested.name(), version, id);
            int revoked = requested == Status.LOCKED ? revokeSessions(id, now) : 0;
            db.update("""
                    INSERT INTO admin_account_status_events(account_id,version,actor_id,previous_status,status,revoked_sessions,occurred_at)
                    VALUES (?,?,?,?,?,?,?)
                    """, id, version, actor, current.status().name(), requested.name(), revoked, now);
            return detail(load(id, false));
        });
    }

    Detail changeRole(UUID id, int expectedVersion, Role requested, UUID actor, boolean approveProfile) {
        return writes.execute(tx -> {
            // Login and status updates take this same account lock. Review writers must take it before the profile lock.
            Account current = load(id, true);
            if (actor.equals(id) || current.role() == Role.ADMIN || requested == Role.ADMIN) {
                throw new ContractException("FORBIDDEN", "Thao tác này chỉ áp dụng giữa vai trò người dùng và tư vấn viên.");
            }
            requireVersion(current, expectedVersion);
            if (current.status() != Status.ACTIVE) {
                throw new ContractException("ACCOUNT_LOCKED", "Hãy mở khóa tài khoản trước khi đổi vai trò.");
            }
            if (current.role() == requested) throw new ContractException("INVALID_TRANSITION", "Vai trò tài khoản chưa thay đổi.");
            OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
            if (requested == Role.CONSULTANT && !approvedConsultant(id, true)) {
                if (!approveProfile) {
                    throw new ContractException("CONSULTANT_APPROVAL_REQUIRED", "Tài khoản cần hồ sơ tư vấn viên đã được duyệt.");
                }
                db.update("""
                        INSERT INTO consultant_profiles(account_id,review_status,reviewed_by,reviewed_at)
                        VALUES (?,'APPROVED',?,?)
                        ON CONFLICT (account_id) DO UPDATE SET review_status='APPROVED',
                        reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at,
                        rejection_reason=NULL, review_version=consultant_profiles.review_version+1
                        """, id, actor, now);
            }
            int version = Math.incrementExact(current.version());
            db.update("UPDATE accounts SET role=?, status_version=? WHERE id=?", requested.name(), version, id);
            int revoked = revokeSessions(id, now);
            db.update("""
                    INSERT INTO admin_account_role_events(account_id,version,actor_id,previous_role,role,revoked_sessions,occurred_at)
                    VALUES (?,?,?,?,?,?,?)
                    """, id, version, actor, current.role().name(), requested.name(), revoked, now);
            return detail(load(id, false));
        });
    }

    private static void requireVersion(Account account, int expectedVersion) {
        if (expectedVersion != account.version()) {
            throw new ContractException("VERSION_CONFLICT", "Tài khoản đã thay đổi. Hãy tải lại chi tiết.");
        }
    }

    private int revokeSessions(UUID id, OffsetDateTime now) {
        return db.update("""
                UPDATE account_sessions SET revoked_at=greatest(created_at, ?)
                WHERE account_id=? AND revoked_at IS NULL AND expires_at>?
                """, now, id, now);
    }

    private boolean approvedConsultant(UUID id, boolean lock) {
        return db.query("SELECT review_status FROM consultant_profiles WHERE account_id=?" + (lock ? " FOR UPDATE" : ""),
                (row, index) -> row.getString(1), id).stream().anyMatch("APPROVED"::equals);
    }

    private Detail detail(Account account) {
        var statusChange = db.query("""
                SELECT actor_id,previous_status,status,revoked_sessions,occurred_at
                FROM admin_account_status_events WHERE account_id=? ORDER BY version DESC LIMIT 1
                """, (row, index) -> new StatusChange(row.getObject("actor_id", UUID.class),
                Status.valueOf(row.getString("previous_status")), Status.valueOf(row.getString("status")),
                row.getInt("revoked_sessions"), instant(row, "occurred_at")), account.id())
                .stream().findFirst().orElse(null);
        var roleChange = db.query("""
                SELECT actor_id,previous_role,role,revoked_sessions,occurred_at
                FROM admin_account_role_events WHERE account_id=? ORDER BY version DESC LIMIT 1
                """, (row, index) -> new RoleChange(row.getObject("actor_id", UUID.class),
                Role.valueOf(row.getString("previous_role")), Role.valueOf(row.getString("role")),
                row.getInt("revoked_sessions"), instant(row, "occurred_at")), account.id())
                .stream().findFirst().orElse(null);
        String phoneNumber = db.queryForObject("SELECT phone_number FROM accounts WHERE id=?", String.class, account.id());
        var passwordRequest = db.query("""
                SELECT id, requested_at FROM password_change_requests WHERE account_id=? AND status='PENDING'
                """, (row, index) -> new PasswordRequest(row.getObject("id", UUID.class), instant(row, "requested_at")), account.id())
                .stream().findFirst().orElse(null);
        return new Detail(account, statusChange, roleChange, allowedRoleChanges(account), phoneNumber, passwordRequest);
    }

    private List<Role> allowedRoleChanges(Account account) {
        if (account.status() != Status.ACTIVE || account.role() == Role.ADMIN) return List.of();
        if (account.role() == Role.CONSULTANT) return List.of(Role.USER);
        return approvedConsultant(account.id(), false) ? List.of(Role.CONSULTANT) : List.of();
    }

    private Account load(UUID id, boolean lock) {
        return db.query("SELECT " + COLUMNS + " FROM accounts WHERE id=?" + (lock ? " FOR UPDATE" : ""),
                AccountDirectoryService::account, id).stream().findFirst()
                .orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy tài khoản."));
    }

    private static Account account(ResultSet row, int index) throws SQLException {
        Role role = Role.valueOf(row.getString("role"));
        return new Account(row.getObject("id", UUID.class), row.getString("identifier_normalized"), row.getString("display_name"),
                role, Status.valueOf(row.getString("status")), row.getInt("status_version"), instant(row, "created_at"), role != Role.ADMIN);
    }

    private static String instant(ResultSet row, String field) throws SQLException {
        return row.getObject(field, OffsetDateTime.class).toInstant().toString();
    }
}
