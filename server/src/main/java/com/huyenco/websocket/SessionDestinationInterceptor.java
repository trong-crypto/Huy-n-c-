package com.huyenco.websocket;

import java.util.Set;
import java.util.Optional;
import com.huyenco.history.HistoryStore;
import com.huyenco.history.SessionService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

/** Clients may only subscribe to their own logical user queues, never physical broker queues. */
public final class SessionDestinationInterceptor implements ChannelInterceptor {
    private static final Set<String> SUBSCRIPTIONS = Set.of("/user/queue/results", "/user/queue/errors", "/user/queue/progress");
    private static final Set<String> REQUESTS = Set.of("/app/mai-hoa/calculate", "/app/tam-the/calculate");
    private final ObjectProvider<CalculationSessions> sessions;
    private final ObjectProvider<MessageChannel> outbound;
    private final Optional<ChatSocketSecurity> chat;

    public SessionDestinationInterceptor(ObjectProvider<CalculationSessions> sessions, ObjectProvider<MessageChannel> outbound) {
        this(sessions, outbound, Optional.empty());
    }

    public SessionDestinationInterceptor(ObjectProvider<CalculationSessions> sessions, ObjectProvider<MessageChannel> outbound,
                                         Optional<ChatSocketSecurity> chat) {
        this.sessions = sessions;
        this.outbound = outbound;
        this.chat = chat;
    }

    private Message<?> denied(String sessionId) {
        sessions.getObject().disconnect(sessionId);
        // Ordered inbound delivery may invoke this interceptor asynchronously. Send the protocol
        // error explicitly to the transport, whose STOMP handler closes the offending socket.
        outbound.getObject().send(SafeStompErrorHandler.rejected(sessionId));
        return null;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        var headers = StompHeaderAccessor.wrap(message);
        if (chat.isPresent() && chat.get().owns(headers)) {
            return chat.get().inbound(message, headers, outbound.getObject());
        }
        var command = headers.getCommand();
        if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
            var attributes=headers.getSessionAttributes();
            var identity=attributes==null?null:attributes.get(SessionService.WS_OWNER);
            if (!sessions.getObject().connect(headers.getSessionId(),identity instanceof HistoryStore.Owner owner?owner:null))
                return denied(headers.getSessionId());
        } else if (command == StompCommand.SUBSCRIBE) {
            if (headers.getDestination() == null || !SUBSCRIPTIONS.contains(headers.getDestination()))
                return denied(headers.getSessionId());
        } else if (command == StompCommand.SEND) {
            if (headers.getDestination() == null || !REQUESTS.contains(headers.getDestination()))
                return denied(headers.getSessionId());
        } else if (command == StompCommand.DISCONNECT) {
            sessions.getObject().disconnect(headers.getSessionId());
        }
        return message;
    }
}
