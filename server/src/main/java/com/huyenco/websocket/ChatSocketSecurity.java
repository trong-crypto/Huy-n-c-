package com.huyenco.websocket;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.Scope;
import com.huyenco.auth.ChatSessionAccess.SocketHandshake;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import com.huyenco.chat.ChatRoomAccess;
import com.huyenco.common.exception.ContractException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ExecutorChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.TransactionException;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatSocketSecurity implements HandshakeInterceptor {
    public static final String ENDPOINT = "/api/v1/ws/chat";
    public static final String ADMIN_ENDPOINT = "/api/v1/ws/admin";
    public static final String ACCOUNT_ENDPOINT = "/api/v1/ws/account";
    public static final String WORKSPACE_QUEUE = "/queue/chat/workspace";
    public static final String WORKSPACE_COMMAND = "/app/chat/workspace";
    public static final String ADMIN_QUEUE = "/queue/admin/reviews";
    public static final String SEND_PREFIX = "/app/chat/rooms/";
    public static final String SUBSCRIBE_PREFIX = "/user/queue/chat/rooms/";
    public static final String ACTOR_HEADER = "huyencoChatActor";
    private static final String PHYSICAL_PREFIX = "/queue/chat/rooms/";
    private static final String CHAT_ENDPOINT = ChatSocketSecurity.class.getName() + ".endpoint";
    private static final String HANDSHAKE = ChatSocketSecurity.class.getName() + ".handshake";
    private static final Pattern ROOM_ID = Pattern.compile("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");

    private final ChatSessionAccess sessions;
    private final ChatRoomAccess rooms;
    private final ObjectProvider<MessageChannel> outbound;
    private final Map<String, SocketIdentity> connected = new ConcurrentHashMap<>();

    ChatSocketSecurity(ChatSessionAccess sessions, ChatRoomAccess rooms,
                       @Qualifier("clientOutboundChannel") ObjectProvider<MessageChannel> outbound) {
        this.sessions = sessions;
        this.rooms = rooms;
        this.outbound = outbound;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler handler, Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servlet)) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }
        try {
            Scope scope = switch (servlet.getServletRequest().getServletPath()) {
                case ADMIN_ENDPOINT -> Scope.ADMIN;
                case ACCOUNT_ENDPOINT -> Scope.ACCOUNT;
                default -> Scope.CHAT;
            };
            attributes.put(HANDSHAKE, sessions.handshake(servlet.getServletRequest(), scope));
            attributes.put(CHAT_ENDPOINT, true);
            return true;
        } catch (ContractException failure) {
            response.setStatusCode("INVALID_SESSION".equals(failure.code()) ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN);
        } catch (DataAccessException | TransactionException failure) {
            response.setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler handler, Exception failure) {}

    boolean owns(StompHeaderAccessor headers) {
        var attributes = headers.getSessionAttributes();
        return attributes != null && Boolean.TRUE.equals(attributes.get(CHAT_ENDPOINT));
    }

    Message<?> inbound(Message<?> message, StompHeaderAccessor headers, MessageChannel outbound) {
        String sessionId = headers.getSessionId();
        if (sessionId == null) return null;
        StompCommand command = headers.getCommand();
        if (command == StompCommand.DISCONNECT) {
            connected.remove(sessionId);
            return message;
        }
        try {
            if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
                Object proof = headers.getSessionAttributes().remove(HANDSHAKE);
                if (!(proof instanceof SocketHandshake handshake)) return deny(sessionId, outbound);
                var identity = sessions.connect(handshake, singleNativeHeader(headers, "X-CSRF-Token"));
                var transportHeaders = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (transportHeaders == null || !transportHeaders.isMutable()) return deny(sessionId, outbound);
                transportHeaders.setUser(() -> identity.scope() == Scope.CHAT
                        ? accountDestination(identity.accountId()) : identity.scope().name() + ":" + identity.accountId());
                connected.put(sessionId, identity);
                return message;
            }
            SocketIdentity identity = connected.get(sessionId);
            if (identity == null) return deny(sessionId, outbound);
            if (command == null || command == StompCommand.UNSUBSCRIBE) return message;

            String destination = singleNativeHeader(headers, "destination");
            if (identity.scope() == Scope.ACCOUNT) return deny(sessionId, outbound);
            if (identity.scope() == Scope.ADMIN) {
                if (command != StompCommand.SUBSCRIBE || !ADMIN_QUEUE.equals(destination)) return deny(sessionId, outbound);
                sessions.requireSocket(identity);
                return message;
            }
            if (command == StompCommand.SUBSCRIBE && ("/user" + WORKSPACE_QUEUE).equals(destination)) {
                sessions.requireSocket(identity);
                return message;
            }
            if (command == StompCommand.SEND && WORKSPACE_COMMAND.equals(destination)) {
                return MessageBuilder.fromMessage(message).setHeader(ACTOR_HEADER, identity).build();
            }
            UUID room = switch (command) {
                case SEND -> roomId(destination, SEND_PREFIX, destination != null && destination.endsWith("/sync") ? "/sync" : "/send");
                case SUBSCRIBE -> roomId(destination, SUBSCRIBE_PREFIX, "");
                default -> null;
            };
            if (room == null) return deny(sessionId, outbound);
            var actor = rooms.requireSocketParticipant(identity, room);
            return command == StompCommand.SEND
                    ? MessageBuilder.fromMessage(message).setHeader(ACTOR_HEADER, actor).build() : message;
        } catch (ContractException | DataAccessException | TransactionException failure) {
            return deny(sessionId, outbound);
        }
    }

    public static String accountDestination(UUID accountId) {
        return "chat:" + accountId;
    }

    public boolean customerOnline(UUID accountId) {
        return connected.values().stream().anyMatch(identity -> identity.scope() != Scope.ADMIN
                && identity.accountId().equals(accountId));
    }

    public ExecutorChannelInterceptor outboundGuard(Supplier<MessageChannel> outbound) {
        return new ExecutorChannelInterceptor() {
            @Override
            public Message<?> beforeHandle(Message<?> message, MessageChannel channel, MessageHandler handler) {
                if (SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) != SimpMessageType.MESSAGE) return message;
                String destination = SimpMessageHeaderAccessor.getDestination(message.getHeaders());
                boolean chatDestination = destination != null
                        && (destination.startsWith(PHYSICAL_PREFIX) || destination.startsWith(SUBSCRIBE_PREFIX)
                            || destination.startsWith(WORKSPACE_QUEUE) || destination.equals("/user" + WORKSPACE_QUEUE));
                boolean adminDestination = ADMIN_QUEUE.equals(destination);
                String sessionId = SimpMessageHeaderAccessor.getSessionId(message.getHeaders());
                SocketIdentity identity = sessionId == null ? null : connected.get(sessionId);
                if (identity == null) return chatDestination || adminDestination ? null : message;
                if (identity.scope() == Scope.ACCOUNT) return null;
                if (identity.scope() == Scope.ADMIN || destination != null && (destination.equals("/user" + WORKSPACE_QUEUE)
                        || destination.equals(WORKSPACE_QUEUE + "-user" + sessionId))) {
                    if (identity.scope() == Scope.ADMIN && !adminDestination) return null;
                    try {
                        sessions.requireSocket(identity);
                        return message;
                    } catch (ContractException | DataAccessException | TransactionException failure) {
                        return deny(sessionId, outbound.get());
                    }
                }
                if (!chatDestination || adminDestination) return null;
                UUID room = destination.startsWith(SUBSCRIBE_PREFIX)
                        ? roomId(destination, SUBSCRIBE_PREFIX, "")
                        : roomId(destination, PHYSICAL_PREFIX, "-user" + sessionId);
                if (room == null) return deny(sessionId, outbound.get());
                try {
                    rooms.requireSocketParticipant(identity, room);
                    return message;
                } catch (ContractException | DataAccessException | TransactionException failure) {
                    return deny(sessionId, outbound.get());
                }
            }
        };
    }

    @Scheduled(fixedDelayString = "${huyenco.chat.socket-session-check-ms:5000}")
    void checkConnectedSessions() {
        connected.forEach((sessionId, identity) -> {
            try {
                sessions.requireSocket(identity);
            } catch (ContractException failure) {
                if (connected.remove(sessionId, identity)) {
                    outbound.getObject().send(SafeStompErrorHandler.sessionInvalid(sessionId,
                            "FORBIDDEN".equals(failure.code())));
                }
            } catch (DataAccessException | TransactionException failure) {
                // A database interruption does not revoke otherwise valid sessions.
            }
        });
    }

    private Message<?> deny(String sessionId, MessageChannel outbound) {
        connected.remove(sessionId);
        outbound.send(SafeStompErrorHandler.rejected(sessionId));
        return null;
    }

    private static String singleNativeHeader(StompHeaderAccessor headers, String name) {
        List<String> values = headers.getNativeHeader(name);
        return values != null && values.size() == 1 ? values.get(0) : null;
    }

    private static UUID roomId(String destination, String prefix, String suffix) {
        if (destination == null || !destination.startsWith(prefix) || !destination.endsWith(suffix)
                || destination.length() != prefix.length() + 36 + suffix.length()) return null;
        String room = destination.substring(prefix.length(), prefix.length() + 36);
        return ROOM_ID.matcher(room).matches() ? UUID.fromString(room) : null;
    }
}
