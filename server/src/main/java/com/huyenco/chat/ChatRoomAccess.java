package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.Actor;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatRoomAccess {
    private final ChatSessionAccess sessions;
    private final JdbcTemplate db;

    ChatRoomAccess(ChatSessionAccess sessions, JdbcTemplate db) {
        this.sessions = sessions;
        this.db = db;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Actor requireParticipant(HttpServletRequest request, UUID conversationId) {
        return requireParticipant(sessions.requireRead(request), conversationId);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Actor requireSocketParticipant(SocketIdentity identity, UUID conversationId) {
        return requireParticipant(sessions.requireSocket(identity), conversationId);
    }

    private Actor requireParticipant(Actor actor, UUID conversationId) {
        boolean participant = Boolean.TRUE.equals(db.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM chat_conversations WHERE id = ? AND " + participantColumn(actor.role()) + " = ?)",
                Boolean.class, conversationId, actor.accountId()));
        if (!participant) throw roomNotFound();
        return actor;
    }

    static String participantColumn(Role role) {
        return switch (role) {
            case USER -> "user_account_id";
            case CONSULTANT -> "consultant_account_id";
        };
    }

    static ContractException roomNotFound() {
        return new ContractException("NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }
}
