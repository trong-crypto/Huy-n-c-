package com.huyenco.chat;

import com.huyenco.websocket.ChatSocketSecurity;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class ChatSocketDelivery {
    private static final Logger LOG = LoggerFactory.getLogger(ChatSocketDelivery.class);
    private final SimpMessagingTemplate broker;
    private final SimpUserRegistry users;

    ChatSocketDelivery(SimpMessagingTemplate broker, SimpUserRegistry users) {
        this.broker = broker;
        this.users = users;
    }

    void sendToAccount(UUID accountId, String destination, Object payload, String excludedSocket) {
        var user = users.getUser(ChatSocketSecurity.accountDestination(accountId));
        if (user == null) return;
        for (var socket : user.getSessions()) {
            if (!socket.getId().equals(excludedSocket)) sendToSocket(socket.getId(), destination, payload);
        }
    }

    void sendToSocket(String sessionId, String destination, Object payload) {
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(sessionId);
        headers.setLeaveMutable(true);
        try {
            broker.convertAndSendToUser(sessionId, destination, payload, headers.getMessageHeaders());
        } catch (MessagingException failure) {
            LOG.warn("Chat WebSocket event could not be delivered");
        }
    }
}
