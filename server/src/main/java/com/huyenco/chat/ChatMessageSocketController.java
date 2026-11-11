package com.huyenco.chat;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.ChatSessionAccess.Actor;
import com.huyenco.common.exception.ContractException;
import com.huyenco.websocket.ChatSocketSecurity;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.TransactionException;

@Controller
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class ChatMessageSocketController {
    private static final Logger LOG = LoggerFactory.getLogger(ChatMessageSocketController.class);
    private static final String ROOM_QUEUE = "/queue/chat/rooms/";
    private final ChatMessages messages;
    private final ChatSocketDelivery delivery;
    private final ObjectReader json;
    private final Semaphore writeSlots = new Semaphore(4);

    ChatMessageSocketController(ChatMessages messages, ChatSocketDelivery delivery, ObjectMapper mapper) {
        this.messages = messages;
        this.delivery = delivery;
        this.json = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @MessageMapping("/chat/rooms/{conversationId}/sync")
    void sync(@DestinationVariable("conversationId") UUID conversationId, Message<byte[]> frame) {
        String sessionId = SimpMessageHeaderAccessor.getSessionId(frame.getHeaders());
        if (sessionId == null || !(frame.getHeaders().get(ChatSocketSecurity.ACTOR_HEADER) instanceof Actor)
                || frame.getPayload().length != 0) return;
        delivery.sendToSocket(sessionId, ROOM_QUEUE + conversationId, new Ready("READY", conversationId));
    }

    @MessageMapping("/chat/rooms/{conversationId}/send")
    void send(@DestinationVariable("conversationId") UUID conversationId, Message<byte[]> frame) {
        String sessionId = SimpMessageHeaderAccessor.getSessionId(frame.getHeaders());
        if (sessionId == null || !(frame.getHeaders().get(ChatSocketSecurity.ACTOR_HEADER) instanceof Actor actor)) return;
        String destination = ROOM_QUEUE + conversationId;
        UUID clientMessageId = null;
        ChatMessages.Append appended;
        try {
            JsonNode payload = json.readTree(frame.getPayload());
            clientMessageId = readId(payload == null ? null : payload.get("clientMessageId"));
            JsonNode text = payload == null ? null : payload.get("text");
            if (!payload.isObject() || payload.size() != 2 || text == null || !text.isTextual()) throw invalid();
            if (!writeSlots.tryAcquire()) {
                throw new ContractException("SERVER_BUSY", "Máy chủ đang bận.");
            }
            try {
                // The service owns the transaction. A successful return means the insert has committed.
                appended = messages.append(actor, conversationId, clientMessageId, text.textValue());
            } finally {
                writeSlots.release();
            }
        } catch (IOException failure) {
            delivery.sendToSocket(sessionId, destination, new SendError("ERROR", conversationId, clientMessageId, "INVALID_INPUT"));
            return;
        } catch (ContractException failure) {
            delivery.sendToSocket(sessionId, destination, new SendError("ERROR", conversationId, clientMessageId, failure.code()));
            return;
        } catch (DataAccessException | TransactionException failure) {
            LOG.warn("Chat message storage unavailable for room {}", conversationId);
            delivery.sendToSocket(sessionId, destination, new SendError("ERROR", conversationId, clientMessageId, "DATABASE_UNAVAILABLE"));
            return;
        }
        var saved = appended.message();
        String sequence = Long.toString(saved.sequence());
        String createdAt = saved.createdAt().toInstant().toString();
        delivery.sendToSocket(sessionId, destination,
                new Ack("ACK", conversationId, saved.clientMessageId(), saved.messageId(), sequence, createdAt));
        if (appended.created()) {
            var incoming = new Incoming("MESSAGE", conversationId, saved.messageId(), saved.senderAccountId(),
                    sequence, saved.text(), createdAt);
            delivery.sendToAccount(appended.recipientAccountId(), destination, incoming, null);
            delivery.sendToAccount(actor.accountId(), destination, incoming, sessionId);
        }
    }

    private static UUID readId(JsonNode value) {
        if (value == null || !value.isTextual() || value.textValue().length() != 36) throw invalid();
        try {
            UUID id = UUID.fromString(value.textValue());
            if (id.toString().equalsIgnoreCase(value.textValue())) return id;
        } catch (IllegalArgumentException failure) {
            throw invalid();
        }
        throw invalid();
    }

    private static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Mã hoặc nội dung tin nhắn không hợp lệ.");
    }

    record Ack(String type, UUID conversationId, UUID clientMessageId, UUID messageId,
               String sequence, String createdAt) {}
    record Incoming(String type, UUID conversationId, UUID messageId, UUID senderAccountId,
                    String sequence, String text, String createdAt) {}
    record SendError(String type, UUID conversationId, UUID clientMessageId, String code) {}
    record Ready(String type, UUID conversationId) {}
}
