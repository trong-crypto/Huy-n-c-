package com.huyenco.admin;

import com.huyenco.admin.AccountDirectoryService.Role;
import com.huyenco.admin.AccountDirectoryService.Status;
import com.huyenco.common.exception.ContractException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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
final class ConsultantDirectoryService {
    enum ReviewStatus { PENDING_REVIEW, APPROVED, REJECTED }
    enum Decision { APPROVED, REJECTED }
    record ProfileSummary(UUID accountId, String displayName, Role role, Status accountStatus,
                          ReviewStatus reviewStatus, int version, String submittedAt) {}
    record Detail(ProfileSummary profile, String summary, UUID submittedBy, UUID reviewedBy,
                  String reviewedAt, String rejectionReason) {}
    record Page(List<ProfileSummary> items, int page, int size, long totalElements, long totalPages) {}

    private static final String COLUMNS = """
            p.account_id,a.display_name,a.role,a.status,p.review_status,p.review_version,p.submitted_at
            """;
    private static final String FROM = " FROM consultant_profiles p JOIN accounts a ON a.id=p.account_id";

    private final JdbcTemplate db;
    private final Clock clock;
    private final TransactionTemplate reads;
    private final TransactionTemplate writes;

    ConsultantDirectoryService(JdbcTemplate db, Clock clock, PlatformTransactionManager transactions) {
        this.db = db;
        this.clock = clock;
        reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        writes = new TransactionTemplate(transactions);
    }

    Page list(String query, Status accountStatus, ReviewStatus reviewStatus, int page, int size) {
        String filter = FROM + " WHERE a.role <> 'ADMIN' AND strpos(lower(a.display_name), lower(?)) > 0";
        var parameters = new ArrayList<Object>(List.of(query));
        if (accountStatus != null) { filter += " AND a.status=?"; parameters.add(accountStatus.name()); }
        if (reviewStatus != null) { filter += " AND p.review_status=?"; parameters.add(reviewStatus.name()); }
        String where = filter;
        return reads.execute(tx -> {
            long count = db.queryForObject("SELECT count(*)" + where, Long.class, parameters.toArray());
            var paged = new ArrayList<>(parameters);
            paged.add(size);
            paged.add((long) page * size);
            var items = db.query("SELECT " + COLUMNS + where
                    + " ORDER BY p.submitted_at DESC NULLS LAST,p.account_id DESC LIMIT ? OFFSET ?",
                    (row, index) -> summary(row), paged.toArray());
            return new Page(items, page, size, count, (count + size - 1) / size);
        });
    }

    Detail detail(UUID id) {
        return reads.execute(tx -> load(id, false));
    }

    Detail create(UUID id, String summary, UUID actor) {
        return writes.execute(tx -> {
            lockAccount(id);
            int inserted = db.update("""
                    INSERT INTO consultant_profiles(account_id,summary,submitted_by,submitted_at)
                    VALUES (?,?,?,?) ON CONFLICT (account_id) DO NOTHING
                    """, id, summary, actor, now());
            if (inserted == 0) throw new ContractException("PROFILE_EXISTS", "Tài khoản đã có hồ sơ tư vấn viên.");
            return load(id, false);
        });
    }

    Detail review(UUID id, int expectedVersion, Decision decision, String reason, UUID actor) {
        return writes.execute(tx -> {
            // Keep the same lock order as ADM-05. Reviewing a profile never writes the account role or status.
            lockAccount(id);
            ProfileSummary current = load(id, true).profile();
            if (current.version() != expectedVersion) {
                throw new ContractException("VERSION_CONFLICT", "Hồ sơ đã thay đổi. Hãy tải lại chi tiết.");
            }
            if (current.reviewStatus() != ReviewStatus.PENDING_REVIEW) {
                throw new ContractException("INVALID_TRANSITION", "Chỉ hồ sơ chờ duyệt mới có thể được xử lý.");
            }
            db.update("""
                    UPDATE consultant_profiles SET review_status=?,review_version=?,reviewed_by=?,reviewed_at=?,rejection_reason=?
                    WHERE account_id=?
                    """, decision.name(), Math.incrementExact(current.version()), actor, now(), reason, id);
            return load(id, false);
        });
    }

    private void lockAccount(UUID id) {
        Role role = db.query("SELECT role FROM accounts WHERE id=? FOR UPDATE",
                (row, index) -> Role.valueOf(row.getString(1)), id).stream().findFirst()
                .orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy tài khoản."));
        if (role == Role.ADMIN) throw new ContractException("FORBIDDEN", "Hồ sơ chỉ áp dụng cho tài khoản khách hàng hoặc tư vấn viên.");
    }

    private Detail load(UUID id, boolean lock) {
        return db.query("SELECT " + COLUMNS + ",p.summary,p.submitted_by,p.reviewed_by,p.reviewed_at,p.rejection_reason"
                + FROM + " WHERE p.account_id=? AND a.role <> 'ADMIN'" + (lock ? " FOR UPDATE OF p" : ""),
                (row, index) -> new Detail(summary(row), row.getString("summary"),
                        row.getObject("submitted_by", UUID.class), row.getObject("reviewed_by", UUID.class),
                        instant(row, "reviewed_at"), row.getString("rejection_reason")), id)
                .stream().findFirst().orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy hồ sơ tư vấn viên."));
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    private static ProfileSummary summary(ResultSet row) throws SQLException {
        return new ProfileSummary(row.getObject("account_id", UUID.class), row.getString("display_name"),
                Role.valueOf(row.getString("role")), Status.valueOf(row.getString("status")),
                ReviewStatus.valueOf(row.getString("review_status")), row.getInt("review_version"), instant(row, "submitted_at"));
    }

    private static String instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant().toString();
    }
}
