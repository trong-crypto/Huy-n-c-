package com.huyenco.chat;

import com.huyenco.websocket.ChatSocketSecurity;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class ChatWorkspaceEvents {
    private final ChatSocketDelivery delivery;

    ChatWorkspaceEvents(ChatSocketDelivery delivery) {
        this.delivery = delivery;
    }

    record Changed(ChatConversations.Conversation room, boolean created) {}
    record Notice(String type, UUID conversationId, ChatConversationLifecycle.Status status,
                  ChatConversationLifecycle.EndReason endReason) {}
    record MessageNotice(String type, UUID conversationId) {}
    record Signal(String type, UUID conversationId) {}
    record Presence(String type, UUID conversationId, boolean online) {}

    @TransactionalEventListener
    void committed(Changed event) {
        var room = event.room();
        var notice = new Notice(event.created() ? "ROOM_CREATED" : "ROOM_CHANGED", room.conversationId(),
                room.state().status(), room.state().endReason());
        notifyAccount(room.userId(), notice);
        notifyAccount(room.consultantId(), notice);
    }

    void notifyAccount(UUID accountId, Object payload) {
        delivery.sendToAccount(accountId, ChatSocketSecurity.WORKSPACE_QUEUE, payload, null);
    }

    void reply(String sessionId, Object payload) {
        delivery.sendToSocket(sessionId, ChatSocketSecurity.WORKSPACE_QUEUE, payload);
    }
}
