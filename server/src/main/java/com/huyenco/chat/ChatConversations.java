package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.Actor;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import com.huyenco.chat.ChatConversationLifecycle.State;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatConversations {
    public record Conversation(UUID conversationId, UUID userId, UUID consultantId,
                               OffsetDateTime createdAt, State state) {}

    public record Page(List<Conversation> items, int page, int size, long totalElements, long totalPages) {}

    record Creation(Conversation conversation, boolean created) {}

    static final String COLUMNS = "id, user_account_id, consultant_account_id, created_at, "
            + ChatConversationLifecycle.STATE_COLUMNS;
    static final RowMapper<Conversation> CONVERSATION = (row, index) -> new Conversation(
            row.getObject("id", UUID.class), row.getObject("user_account_id", UUID.class),
            row.getObject("consultant_account_id", UUID.class), row.getObject("created_at", OffsetDateTime.class),
            ChatConversationLifecycle.readState(row));

    private final ChatSessionAccess sessions;
    private final ChatConsultantProfiles profiles;
    private final JdbcTemplate db;
    private final ApplicationEventPublisher events;

    ChatConversations(ChatSessionAccess sessions, ChatConsultantProfiles profiles, JdbcTemplate db, ApplicationEventPublisher events) {
        this.sessions = sessions;
        this.profiles = profiles;
        this.db = db;
        this.events = events;
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public Conversation create(HttpServletRequest request, UUID consultantId) {
        var actor = requireRequester(request);
        requireEligibleConsultant(consultantId);
        return insert(actor.accountId(), consultantId, null).orElseThrow();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Creation create(HttpServletRequest request, UUID consultantId, UUID requestId) {
        return create(requireRequester(request), consultantId, requestId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Creation create(SocketIdentity identity, UUID consultantId, UUID requestId) {
        var actor = sessions.requireSocket(identity);
        if (actor.role() != Role.USER) throw new ContractException("FORBIDDEN", "Chỉ người dùng được tạo yêu cầu tư vấn.");
        return create(actor, consultantId, requestId);
    }

    private Creation create(Actor actor, UUID consultantId, UUID requestId) {
        if (requestId == null) {
            throw new ContractException("INVALID_INPUT", "Cần mã yêu cầu tư vấn.");
        }
        var existing = findByRequest(actor.accountId(), requestId);
        if (existing.isPresent()) return replay(existing.get(), consultantId);

        requireEligibleConsultant(consultantId);
        return insert(actor.accountId(), consultantId, requestId)
                .map(conversation -> new Creation(conversation, true))
                // A competing insert committed. READ COMMITTED lets this lookup see its row.
                .orElseGet(() -> replay(findByRequest(actor.accountId(), requestId).orElseThrow(), consultantId));
    }

    private Actor requireRequester(HttpServletRequest request) {
        var actor = sessions.requireWrite(request);
        if (actor.role() != Role.USER) {
            throw new ContractException("FORBIDDEN", "Chỉ người dùng được tạo yêu cầu tư vấn.");
        }
        return actor;
    }

    private void requireEligibleConsultant(UUID consultantId) {
        if (consultantId == null) {
            throw new ContractException("INVALID_INPUT", "Cần chọn tư vấn viên.");
        }
        if (profiles.findEligible(consultantId).isEmpty()) {
            throw new ContractException("NOT_FOUND", "Không tìm thấy hồ sơ tư vấn viên.");
        }
    }

    private Optional<Conversation> insert(UUID userId, UUID consultantId, UUID requestId) {
        var inserted = db.query("""
                INSERT INTO chat_conversations (id, user_account_id, consultant_account_id, create_request_id)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (user_account_id, create_request_id) DO NOTHING
                RETURNING
                """ + COLUMNS, CONVERSATION, UUID.randomUUID(), userId, consultantId, requestId)
                .stream().findFirst();
        inserted.ifPresent(room -> events.publishEvent(new ChatWorkspaceEvents.Changed(room, true)));
        return inserted;
    }

    private Optional<Conversation> findByRequest(UUID userId, UUID requestId) {
        return db.query("SELECT " + COLUMNS + " FROM chat_conversations WHERE user_account_id = ? AND create_request_id = ?",
                CONVERSATION, userId, requestId).stream().findFirst();
    }

    private static Creation replay(Conversation existing, UUID consultantId) {
        if (!existing.consultantId().equals(consultantId)) {
            throw new ContractException("REQUEST_ID_CONFLICT", "Mã yêu cầu đã được dùng cho tư vấn viên khác.");
        }
        return new Creation(existing, false);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page list(HttpServletRequest request, int page, int size) {
        var actor = sessions.requireRead(request);
        if (page < 0 || size < 1 || size > 50) {
            throw new ContractException("INVALID_INPUT", "Phân trang cuộc trò chuyện không hợp lệ.");
        }
        String filter = " FROM chat_conversations WHERE " + ChatRoomAccess.participantColumn(actor.role()) + " = ?";
        long total = db.queryForObject("SELECT COUNT(*)" + filter, Long.class, actor.accountId());
        long offset = (long) page * size;
        List<Conversation> items = offset >= total ? List.of() : db.query(
                "SELECT " + COLUMNS + filter + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                CONVERSATION, actor.accountId(), size, offset);
        long totalPages = total / size + (total % size == 0 ? 0 : 1);
        return new Page(items, page, size, total, totalPages);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Conversation detail(HttpServletRequest request, UUID conversationId) {
        return detail(sessions.requireRead(request), conversationId);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Conversation detail(SocketIdentity identity, UUID conversationId) {
        return detail(sessions.requireSocket(identity), conversationId);
    }

    private Conversation detail(Actor actor, UUID conversationId) {
        return db.query("SELECT " + COLUMNS + " FROM chat_conversations WHERE id = ? AND "
                        + ChatRoomAccess.participantColumn(actor.role()) + " = ?",
                CONVERSATION, conversationId, actor.accountId()).stream().findFirst()
                .orElseThrow(ChatRoomAccess::roomNotFound);
    }
}
