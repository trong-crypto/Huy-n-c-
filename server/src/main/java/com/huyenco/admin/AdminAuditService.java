package com.huyenco.admin;

import java.time.OffsetDateTime;
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
final class AdminAuditService {
    enum TargetType { METHOD_GUIDE, METHOD_CATALOG, ACCOUNT, CONSULTANT_PROFILE }
    enum Action {
        CREATE, SAVE_DRAFT, SUBMIT_REVIEW, RETURN_TO_DRAFT, PUBLISH, SHOW, HIDE,
        LOCK_ACCOUNT, UNLOCK_ACCOUNT, CHANGE_ROLE, SUBMIT_PROFILE, APPROVE_PROFILE, REJECT_PROFILE,
        CREATE_METHOD, UPDATE_METHOD, SHOW_METHOD, HIDE_METHOD, DELETE_METHOD
    }

    record Filters(TargetType targetType, String targetId, Action action, UUID actorId,
                   OffsetDateTime from, OffsetDateTime to) {}
    record Event(String id, String occurredAt, UUID actorId, String targetType, String targetId, String action,
                 String outcome, int version, String previousValue, String newValue, Integer revokedSessions) {}
    record Page(List<Event> items, int page, int size, long totalElements, long totalPages) {}

    private final JdbcTemplate db;
    private final TransactionTemplate reads;

    AdminAuditService(JdbcTemplate db, PlatformTransactionManager transactions) {
        this.db = db;
        reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    Page list(Filters filters, int page, int size) {
        var sql = new StringBuilder(" FROM admin_audit_events WHERE TRUE");
        var parameters = new ArrayList<>();
        add(sql, parameters, "target_type=?", filters.targetType() == null ? null : filters.targetType().name());
        add(sql, parameters, "target_id=?", filters.targetId());
        add(sql, parameters, "action=?", filters.action() == null ? null : filters.action().name());
        add(sql, parameters, "actor_id=?", filters.actorId());
        add(sql, parameters, "occurred_at>=?", filters.from());
        add(sql, parameters, "occurred_at<?", filters.to());
        return reads.execute(tx -> {
            long total = db.queryForObject("SELECT count(*)" + sql, Long.class, parameters.toArray());
            var paged = new ArrayList<>(parameters);
            paged.add(size);
            paged.add((long) page * size);
            var items = db.query("""
                    SELECT id,occurred_at,actor_id,target_type,target_id,action,version,previous_value,new_value,revoked_sessions
                    """ + sql + " ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?",
                    (row, index) -> new Event(row.getString("id"),
                            row.getObject("occurred_at", OffsetDateTime.class).toInstant().toString(),
                            row.getObject("actor_id", UUID.class), row.getString("target_type"), row.getString("target_id"),
                            row.getString("action"), "COMPLETED", row.getInt("version"), row.getString("previous_value"),
                            row.getString("new_value"), row.getObject("revoked_sessions", Integer.class)),
                    paged.toArray());
            return new Page(items, page, size, total, (total + size - 1) / size);
        });
    }

    private static void add(StringBuilder sql, List<Object> parameters, String clause, Object value) {
        if (value == null) return;
        sql.append(" AND ").append(clause);
        parameters.add(value);
    }
}
