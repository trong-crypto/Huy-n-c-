package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class ChatReadPositions {
    private final JdbcTemplate db;
    private final ChatSessionAccess sessions;
    private final ChatRoomAccess rooms;

    ChatReadPositions(JdbcTemplate db, ChatSessionAccess sessions, ChatRoomAccess rooms) {
        this.db = db;
        this.sessions = sessions;
        this.rooms = rooms;
    }

    List<UUID> unread(SocketIdentity identity) {
        var actor = sessions.requireSocket(identity);
        return db.query("""
                SELECT c.id FROM chat_conversations c
                LEFT JOIN chat_read_positions r ON r.conversation_id = c.id AND r.account_id = ?
                WHERE
                """ + " c." + ChatRoomAccess.participantColumn(actor.role()) + " = ? AND ("
                + (actor.role() == ChatSessionAccess.Role.CONSULTANT ? "c.status = 'PENDING' OR " : "")
                + "EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id"
                + " AND m.sender_account_id <> ? AND m.sequence > COALESCE(r.last_read_sequence, 0)"
                + " AND m.created_at > " + ChatMessageRetention.CUTOFF + "))",
                (row, index) -> row.getObject("id", UUID.class), actor.accountId(), actor.accountId(), actor.accountId());
    }

    @Transactional
    void markRead(SocketIdentity identity, UUID conversationId, long sequence) {
        var actor = rooms.requireSocketParticipant(identity, conversationId);
        db.update("""
                INSERT INTO chat_read_positions (conversation_id, account_id, last_read_sequence)
                SELECT id, ?, LEAST(last_message_sequence, ?) FROM chat_conversations WHERE id = ?
                ON CONFLICT (conversation_id, account_id) DO UPDATE
                SET last_read_sequence = GREATEST(chat_read_positions.last_read_sequence, EXCLUDED.last_read_sequence)
                """, actor.accountId(), sequence, conversationId);
    }
}
