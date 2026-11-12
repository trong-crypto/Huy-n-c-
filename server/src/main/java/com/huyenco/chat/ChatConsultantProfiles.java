package com.huyenco.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatConsultantProfiles {
    private static final String PUBLIC_COLUMNS = "SELECT p.account_id, a.display_name, p.summary";
    private static final String ELIGIBLE_PROFILES = """
            FROM consultant_profiles p
            JOIN accounts a ON a.id = p.account_id
            WHERE a.role = 'CONSULTANT' AND a.status = 'ACTIVE' AND p.review_status = 'APPROVED'
            """;
    private static final RowMapper<PublicProfile> PUBLIC_PROFILE = (row, index) ->
            new PublicProfile(row.getObject("account_id", UUID.class),
                    row.getString("display_name"), row.getString("summary"));

    public record PublicProfile(UUID consultantId, String displayName, String summary) {}
    record Page(List<PublicProfile> items, int page, int size, long totalElements, long totalPages) {}

    private final JdbcTemplate db;

    ChatConsultantProfiles(JdbcTemplate db) {
        this.db = db;
    }

    public Optional<PublicProfile> findEligible(UUID consultantId) {
        return db.query(PUBLIC_COLUMNS + "\n" + ELIGIBLE_PROFILES + "AND p.account_id = ?",
                PUBLIC_PROFILE, consultantId).stream().findFirst();
    }

    public List<UUID> eligibleIds() {
        return db.query("SELECT p.account_id\n" + ELIGIBLE_PROFILES,
                (row, index) -> row.getObject("account_id", UUID.class));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page listEligible(int page, int size) {
        long total = db.queryForObject("SELECT COUNT(*)\n" + ELIGIBLE_PROFILES, Long.class);
        long offset = (long) page * size;
        List<PublicProfile> items = offset >= total ? List.of() : db.query(
                PUBLIC_COLUMNS + "\n" + ELIGIBLE_PROFILES + "ORDER BY a.display_name, p.account_id LIMIT ? OFFSET ?",
                PUBLIC_PROFILE, size, offset);
        long totalPages = total / size + (total % size == 0 ? 0 : 1);
        return new Page(items, page, size, total, totalPages);
    }
}
