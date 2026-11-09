package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatConversationLifecycle {
    public enum Status { PENDING, ACTIVE, ENDED }
    public enum EndReason { DECLINED, CANCELLED, COMPLETED }

    public enum Action {
        ACCEPT(Status.PENDING, Status.ACTIVE, Role.CONSULTANT, null),
        DECLINE(Status.PENDING, Status.ENDED, Role.CONSULTANT, EndReason.DECLINED),
        CANCEL(Status.PENDING, Status.ENDED, Role.USER, EndReason.CANCELLED),
        END(Status.ACTIVE, Status.ENDED, null, EndReason.COMPLETED);

        private final Status from;
        private final Status to;
        private final Role requiredRole;
        private final EndReason reason;

        Action(Status from, Status to, Role requiredRole, EndReason reason) {
            this.from = from;
            this.to = to;
            this.requiredRole = requiredRole;
            this.reason = reason;
        }
    }

    public record State(Status status, OffsetDateTime startedAt, OffsetDateTime endedAt,
                        EndReason endReason, UUID endedByAccountId) {}

    static final String STATE_COLUMNS = "status, started_at, ended_at, end_reason, ended_by_account_id";
    private static final RowMapper<State> STATE = (row, index) -> readState(row);

    static State readState(ResultSet row) throws SQLException {
        String reason = row.getString("end_reason");
        return new State(Status.valueOf(row.getString("status")), row.getObject("started_at", OffsetDateTime.class),
                row.getObject("ended_at", OffsetDateTime.class), reason == null ? null : EndReason.valueOf(reason),
                row.getObject("ended_by_account_id", UUID.class));
    }

    private final ChatSessionAccess sessions;
    private final JdbcTemplate db;

    ChatConversationLifecycle(ChatSessionAccess sessions, JdbcTemplate db) {
        this.sessions = sessions;
        this.db = db;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public State transition(HttpServletRequest request, UUID conversationId, Action action) {
        var actor = sessions.requireWrite(request);
        State current = db.query("SELECT " + STATE_COLUMNS + " FROM chat_conversations WHERE id = ? AND "
                        + ChatRoomAccess.participantColumn(actor.role()) + " = ? FOR UPDATE",
                STATE, conversationId, actor.accountId()).stream().findFirst().orElseThrow(ChatRoomAccess::roomNotFound);
        if (action.requiredRole != null && actor.role() != action.requiredRole) {
            throw new ContractException("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
        }
        if (current.status() == action.to && current.endReason() == action.reason
                && (action.reason == null || actor.accountId().equals(current.endedByAccountId()))) {
            return current;
        }
        if (current.status() != action.from) {
            throw new ContractException("INVALID_TRANSITION", "Trạng thái cuộc trò chuyện không cho phép thao tác này.");
        }
        if (action == Action.ACCEPT) {
            return db.queryForObject("""
                    UPDATE chat_conversations
                    SET status = 'ACTIVE', started_at = GREATEST(created_at, clock_timestamp())
                    WHERE id = ? RETURNING
                    """ + STATE_COLUMNS, STATE, conversationId);
        }
        return db.queryForObject("""
                UPDATE chat_conversations
                SET status = 'ENDED', ended_at = GREATEST(created_at, started_at, clock_timestamp()),
                    end_reason = ?, ended_by_account_id = ?
                WHERE id = ? RETURNING
                """ + STATE_COLUMNS, STATE, action.reason.name(), actor.accountId(), conversationId);
    }
}
