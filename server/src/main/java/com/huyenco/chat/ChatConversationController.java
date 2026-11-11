package com.huyenco.chat;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.chat.ChatConversationLifecycle.Action;
import com.huyenco.chat.ChatConversationLifecycle.EndReason;
import com.huyenco.chat.ChatConversationLifecycle.Status;
import com.huyenco.chat.ChatConversations.Conversation;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
@RequestMapping(value = ChatConversationController.PATH, produces = MediaType.APPLICATION_JSON_VALUE)
final class ChatConversationController {
    static final String PATH = "/api/v1/chat/conversations";
    private static final Logger LOG = LoggerFactory.getLogger(ChatConversationController.class);
    private static final int MAX_BODY_BYTES = 1024;

    private final ChatConversations conversations;
    private final ChatConversationLifecycle lifecycle;
    private final ChatMessages messages;
    private final ObjectReader reader;

    ChatConversationController(ChatConversations conversations, ChatConversationLifecycle lifecycle,
                               ChatMessages messages, ObjectMapper mapper) {
        this.conversations = conversations;
        this.lifecycle = lifecycle;
        this.messages = messages;
        reader = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @PostMapping
    ResponseEntity<Envelope> create(HttpServletRequest request) {
        return respond(() -> {
            query(request, Set.of());
            JsonNode input = body(request, 2);
            var result = conversations.create(request, uuid(input.path("consultantId").textValue()),
                    uuid(input.path("requestId").textValue()));
            var data = view(result.conversation());
            return result.created()
                    ? new Success(data, URI.create(PATH + "/" + data.conversationId()))
                    : new Success(data, null);
        });
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(() -> {
            query(request, Set.of("page", "size"));
            var page = conversations.list(request, number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
            return new Success(new PageView(page.items().stream().map(ChatConversationController::view).toList(),
                    page.page(), page.size(), page.totalElements(), page.totalPages()), null);
        });
    }

    @GetMapping("/{conversationId}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String conversationId) {
        return respond(() -> {
            query(request, Set.of());
            return new Success(view(conversations.detail(request, uuid(conversationId))), null);
        });
    }

    @GetMapping("/{conversationId}/messages")
    ResponseEntity<Envelope> history(HttpServletRequest request, @PathVariable String conversationId) {
        return respond(() -> {
            query(request, Set.of("afterSequence", "size"));
            var page = messages.readAfter(request, uuid(conversationId), cursor(request.getParameter("afterSequence")),
                    number(request.getParameter("size"), 50, 1, ChatMessages.MAX_PAGE_SIZE));
            return new Success(new MessagePage(page.items().stream().map(ChatConversationController::messageView).toList(),
                    Long.toString(page.nextAfterSequence()), page.hasMore()), null);
        });
    }

    @PostMapping("/{conversationId}/transition")
    ResponseEntity<Envelope> transition(HttpServletRequest request, @PathVariable String conversationId) {
        return respond(() -> {
            query(request, Set.of());
            UUID id = uuid(conversationId);
            String value = body(request, 1).path("action").textValue();
            if (value == null) throw invalid();
            Action action;
            try {
                action = Action.valueOf(value);
            } catch (IllegalArgumentException failure) {
                throw invalid();
            }
            var state = lifecycle.transition(request, id, action);
            return new Success(new TransitionView(id, state.status(), instant(state.startedAt()), instant(state.endedAt()),
                    state.endReason(), state.endedByAccountId()), null);
        });
    }

    private JsonNode body(HttpServletRequest request, int fields) {
        try {
            if (request.getContentType() == null) throw invalid();
            var type = MediaType.parseMediaType(request.getContentType());
            if (!MediaType.APPLICATION_JSON.equalsTypeAndSubtype(type)
                    || type.getCharset() != null && !StandardCharsets.UTF_8.equals(type.getCharset())) throw invalid();
            byte[] bytes = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
            if (bytes.length == 0 || bytes.length > MAX_BODY_BYTES) throw invalid();
            JsonNode body = reader.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
            if (!body.isObject() || body.size() != fields) throw invalid();
            return body;
        } catch (IOException | IllegalArgumentException failure) {
            throw invalid();
        }
    }

    static UUID uuid(String value) {
        if (value == null || value.length() != 36) throw invalid();
        try {
            UUID parsed = UUID.fromString(value);
            if (!parsed.toString().equalsIgnoreCase(value)) throw invalid();
            return parsed;
        } catch (IllegalArgumentException failure) {
            throw invalid();
        }
    }

    private static int number(String value, int fallback, int minimum, int maximum) {
        if (value == null) return fallback;
        if (!value.matches("[0-9]{1,10}")) throw invalid();
        long parsed = Long.parseLong(value);
        if (parsed < minimum || parsed > maximum) throw invalid();
        return (int) parsed;
    }

    private static long cursor(String value) {
        if (value == null) return 0;
        if (!value.matches("0|[1-9][0-9]{0,18}")) throw invalid();
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException failure) {
            throw invalid();
        }
    }

    private static void query(HttpServletRequest request, Set<String> allowed) {
        request.getParameterMap().forEach((key, values) -> {
            if (!allowed.contains(key) || values.length != 1) throw invalid();
        });
    }

    private static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Dữ liệu yêu cầu hội thoại không hợp lệ.");
    }

    static ConversationView view(Conversation room) {
        var state = room.state();
        return new ConversationView(room.conversationId(), room.userId(), room.consultantId(), room.createdAt().toInstant(),
                state.status(), instant(state.startedAt()), instant(state.endedAt()), state.endReason(), state.endedByAccountId());
    }

    private static MessageView messageView(ChatMessages.Message message) {
        return new MessageView(message.conversationId(), message.messageId(), message.senderAccountId(),
                Long.toString(message.sequence()), message.text(), message.createdAt().toInstant().toString());
    }

    private static Instant instant(OffsetDateTime time) {
        return time == null ? null : time.toInstant();
    }

    private static ResponseEntity<Envelope> respond(Supplier<Success> action) {
        String requestId = UUID.randomUUID().toString();
        try {
            var success = action.get();
            var response = success.location() == null ? ResponseEntity.ok() : ResponseEntity.created(success.location());
            return response.cacheControl(CacheControl.noStore())
                    .body(new Envelope(requestId, "COMPLETED", success.data(), null));
        } catch (ContractException failure) {
            HttpStatus status = switch (failure.code()) {
                case "INVALID_INPUT" -> HttpStatus.BAD_REQUEST;
                case "INVALID_SESSION" -> HttpStatus.UNAUTHORIZED;
                case "CSRF_REJECTED", "FORBIDDEN" -> HttpStatus.FORBIDDEN;
                case "NOT_FOUND" -> HttpStatus.NOT_FOUND;
                case "REQUEST_ID_CONFLICT", "INVALID_TRANSITION" -> HttpStatus.CONFLICT;
                default -> HttpStatus.INTERNAL_SERVER_ERROR;
            };
            if (status != HttpStatus.INTERNAL_SERVER_ERROR) return failed(requestId, status, failure.code(), failure.getMessage());
            return internalError(requestId);
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            LOG.warn("Chat conversation DATABASE_UNAVAILABLE requestId={}", requestId);
            return failed(requestId, HttpStatus.SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Kho dữ liệu hội thoại tạm thời không khả dụng.");
        } catch (RuntimeException failure) {
            return internalError(requestId);
        }
    }

    private static ResponseEntity<Envelope> internalError(String requestId) {
        LOG.warn("Chat conversation INTERNAL_ERROR requestId={}", requestId);
        return failed(requestId, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Không thể xử lý yêu cầu hội thoại.");
    }

    private static ResponseEntity<Envelope> failed(String id, HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new Envelope(id, "FAILED", null, new ApiError(code, message, null, null)));
    }

    private record Success(Object data, URI location) {}
    record Envelope(String requestId, String status, Object data, ApiError error) {}
    record PageView(List<ConversationView> items, int page, int size, long totalElements, long totalPages) {}
    record MessagePage(List<MessageView> items, String nextAfterSequence, boolean hasMore) {}
    record MessageView(UUID conversationId, UUID messageId, UUID senderAccountId,
                       String sequence, String text, String createdAt) {}
    record TransitionView(UUID conversationId, Status status,
                          @JsonFormat(shape = JsonFormat.Shape.STRING) Instant startedAt,
                          @JsonFormat(shape = JsonFormat.Shape.STRING) Instant endedAt,
                          EndReason endReason, UUID endedByAccountId) {}
    record ConversationView(UUID conversationId, UUID userId, UUID consultantId,
                            @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt, Status status,
                            @JsonFormat(shape = JsonFormat.Shape.STRING) Instant startedAt,
                            @JsonFormat(shape = JsonFormat.Shape.STRING) Instant endedAt,
                            EndReason endReason, UUID endedByAccountId) {}
}
