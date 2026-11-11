package com.huyenco.chat;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import com.huyenco.common.exception.ContractException;
import com.huyenco.websocket.ChatSocketSecurity;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.TransactionException;

@Controller
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class ChatWorkspaceSocketController {
    private enum Action { SYNC, CREATE, ACCEPT, DECLINE, CANCEL, END, PRESENCE, TYPING }
    private final ChatConversations conversations;
    private final ChatConversationLifecycle lifecycle;
    private final ChatWorkspaceEvents events;
    private final ChatSocketSecurity socketSecurity;
    private final ObjectReader json;
    private final Semaphore writes = new Semaphore(4);
    private final Semaphore signals = new Semaphore(4);

    ChatWorkspaceSocketController(ChatConversations conversations, ChatConversationLifecycle lifecycle,
                                  ChatWorkspaceEvents events, ChatSocketSecurity socketSecurity, ObjectMapper mapper) {
        this.conversations = conversations;
        this.lifecycle = lifecycle;
        this.events = events;
        this.socketSecurity = socketSecurity;
        json = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @MessageMapping("/chat/workspace")
    void command(Message<byte[]> frame) {
        String session = SimpMessageHeaderAccessor.getSessionId(frame.getHeaders());
        if (session == null || !(frame.getHeaders().get(ChatSocketSecurity.ACTOR_HEADER) instanceof SocketIdentity actor)) return;
        UUID requestId = null;
        boolean signal = false;
        try {
            if (frame.getPayload().length > 1024) throw invalid();
            JsonNode body = json.readValue(frame.getPayload());
            if (body == null || !body.isObject()) throw invalid();
            requestId = body.has("requestId") ? id(body, "requestId") : null;
            Action action = Action.valueOf(body.path("action").asText(""));
            if (action == Action.SYNC) {
                if (body.size() != 1) throw invalid();
                events.reply(session, new Ready("READY"));
                return;
            }
            signal = action == Action.PRESENCE || action == Action.TYPING;
            if (signal) {
                if (body.size() != 2 || requestId != null) throw invalid();
                if (!signals.tryAcquire()) return;
                try {
                    var room = conversations.detail(actor, id(body, "conversationId"));
                    if (room.state().status() == ChatConversationLifecycle.Status.ACTIVE) {
                        UUID peer = room.userId().equals(actor.accountId()) ? room.consultantId() : room.userId();
                        events.notifyAccount(peer, new ChatWorkspaceEvents.Signal(action.name(), room.conversationId()));
                        if (action == Action.PRESENCE) {
                            events.reply(session, new ChatWorkspaceEvents.Presence("PEER_ONLINE", room.conversationId(),
                                    socketSecurity.customerOnline(peer)));
                        }
                    }
                } finally {
                    signals.release();
                }
                return;
            }
            if (requestId == null || body.size() != 3) throw invalid();
            if (!writes.tryAcquire()) throw new ContractException("SERVER_BUSY", "Máy chủ đang bận.");
            ChatConversations.Conversation room;
            try {
                room = action == Action.CREATE ? conversations.create(actor, id(body, "consultantId"), requestId).conversation()
                        : lifecycle.transition(actor, id(body, "conversationId"), ChatConversationLifecycle.Action.valueOf(action.name()));
            } finally {
                writes.release();
            }
            events.reply(session, new Ack("ACK", requestId, ChatConversationController.view(room)));
        } catch (IOException | IllegalArgumentException failure) {
            if (!signal) events.reply(session, new Error("ERROR", requestId, "INVALID_INPUT"));
        } catch (ContractException failure) {
            if (!signal) events.reply(session, new Error("ERROR", requestId, failure.code()));
        } catch (DataAccessException | TransactionException failure) {
            if (!signal) events.reply(session, new Error("ERROR", requestId, "DATABASE_UNAVAILABLE"));
        }
    }

    private static UUID id(JsonNode body, String key) {
        return ChatConversationController.uuid(body.path(key).textValue());
    }

    private static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Dữ liệu yêu cầu hội thoại không hợp lệ.");
    }

    record Ack(String type, UUID requestId, ChatConversationController.ConversationView conversation) {}
    record Error(String type, UUID requestId, String code) {}
    record Ready(String type) {}
}
