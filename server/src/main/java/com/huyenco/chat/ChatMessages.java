package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess.Actor;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
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
public class ChatMessages {
    public record Message(UUID messageId, UUID conversationId, UUID senderAccountId, UUID clientMessageId,
                          long sequence, String text, OffsetDateTime createdAt) {}

    public record Append(Message message, UUID recipientAccountId, boolean created) {}
    public record Page(List<Message> items, long nextAfterSequence, boolean hasMore) {}
    private record Room(String status, UUID recipientAccountId) {}
    private record StoredMessage(Message message, boolean retained) {}

    private static final int MAX_TEXT_LENGTH = 2000;
    static final int MAX_PAGE_SIZE = 100;
    private static final String COLUMNS = "id, conversation_id, sender_account_id, client_message_id, sequence, body, created_at";
    private static final RowMapper<Message> MESSAGE = (row, index) -> new Message(
            row.getObject("id", UUID.class), row.getObject("conversation_id", UUID.class),
            row.getObject("sender_account_id", UUID.class), row.getObject("client_message_id", UUID.class),
            row.getLong("sequence"), row.getString("body"), row.getObject("created_at", OffsetDateTime.class));

    private final JdbcTemplate db;
    private final ChatRoomAccess rooms;

    ChatMessages(JdbcTemplate db, ChatRoomAccess rooms) {
        this.db = db;
        this.rooms = rooms;
    }

    // The transport must resolve a fresh server-side actor for each send before calling this method.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Append append(Actor sender, UUID conversationId, UUID clientMessageId, String text) {
        validateMessage(clientMessageId, text);
        Room room = db.query("SELECT status, user_account_id, consultant_account_id FROM chat_conversations WHERE id = ? AND "
                        + ChatRoomAccess.participantColumn(sender.role()) + " = ? FOR UPDATE",
                (row, index) -> new Room(row.getString("status"), row.getObject(
                        sender.role() == Role.USER ? "consultant_account_id" : "user_account_id", UUID.class)),
                conversationId, sender.accountId())
                .stream().findFirst().orElseThrow(ChatRoomAccess::roomNotFound);

        var existing = db.query("SELECT " + COLUMNS + ", created_at > " + ChatMessageRetention.CUTOFF + " AS retained"
                        + " FROM chat_messages"
                        + " WHERE conversation_id = ? AND sender_account_id = ? AND client_message_id = ?",
                (row, index) -> row.getBoolean("retained") ? new StoredMessage(MESSAGE.mapRow(row, index), true)
                        : new StoredMessage(null, false),
                conversationId, sender.accountId(), clientMessageId).stream().findFirst();
        if (existing.isPresent()) {
            StoredMessage stored = existing.get();
            if (!stored.retained()) throw expired();
            Message message = stored.message();
            if (!message.text().equals(text)) {
                throw new ContractException("MESSAGE_ID_CONFLICT", "Mã tin nhắn đã được dùng cho nội dung khác.");
            }
            return new Append(message, room.recipientAccountId(), false);
        }
        boolean expired = Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM chat_expired_message_keys
                    WHERE conversation_id = ? AND sender_account_id = ? AND client_message_id = ?)
                """, Boolean.class, conversationId, sender.accountId(), clientMessageId));
        if (expired) throw expired();
        if (!ChatConversationLifecycle.Status.ACTIVE.name().equals(room.status())) {
            throw new ContractException("ROOM_NOT_ACTIVE", "Chỉ có thể gửi tin trong cuộc trò chuyện đang hoạt động.");
        }

        Long sequence = db.queryForObject("""
                UPDATE chat_conversations SET last_message_sequence = last_message_sequence + 1
                WHERE id = ? RETURNING last_message_sequence
                """, Long.class, conversationId);
        Message message = db.queryForObject("""
                INSERT INTO chat_messages (id, conversation_id, sender_account_id, client_message_id, sequence, body)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING
                """ + COLUMNS, MESSAGE, UUID.randomUUID(), conversationId, sender.accountId(), clientMessageId, sequence, text);
        return new Append(message, room.recipientAccountId(), true);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page readAfter(HttpServletRequest request, UUID conversationId, long afterSequence, int size) {
        rooms.requireParticipant(request, conversationId);
        if (afterSequence < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ContractException("INVALID_INPUT", "Tham số đọc tin nhắn không hợp lệ.");
        }
        List<Message> fetched = db.query("SELECT " + COLUMNS + " FROM chat_messages"
                        + " WHERE conversation_id = ? AND sequence > ? AND created_at > " + ChatMessageRetention.CUTOFF
                        + " ORDER BY sequence LIMIT ?",
                MESSAGE, conversationId, afterSequence, size + 1);
        boolean hasMore = fetched.size() > size;
        List<Message> items = List.copyOf(fetched.subList(0, Math.min(fetched.size(), size)));
        long next = items.isEmpty() ? afterSequence : items.get(items.size() - 1).sequence();
        return new Page(items, next, hasMore);
    }

    private static ContractException expired() {
        return new ContractException("MESSAGE_EXPIRED", "Tin nhắn đã hết thời hạn lưu.");
    }

    private static void validateMessage(UUID clientMessageId, String text) {
        if (clientMessageId == null || text == null || text.length() > MAX_TEXT_LENGTH
                || text.codePoints().allMatch(codePoint -> Character.isWhitespace(codePoint)
                        || Character.isSpaceChar(codePoint) || codePoint == 0xfeff)
                || text.codePoints().anyMatch(codePoint -> codePoint == 0
                        || codePoint >= Character.MIN_SURROGATE && codePoint <= Character.MAX_SURROGATE)) {
            throw new ContractException("INVALID_INPUT", "Tin nhắn phải có mã và nội dung văn bản hợp lệ, tối đa 2.000 ký tự.");
        }
    }
}
