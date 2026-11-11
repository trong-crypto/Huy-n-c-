package com.huyenco.websocket;

import java.nio.charset.StandardCharsets;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

/** Protocol failures do not have a reliable request ID. Do not expose internal exception messages. */
public final class SafeStompErrorHandler extends StompSubProtocolErrorHandler {
    @Override
    public Message<byte[]> handleClientMessageProcessingError(Message<byte[]> clientMessage, Throwable failure) {
        return rejected(null);
    }

    public static Message<byte[]> rejected(String sessionId) {
        return error(sessionId, "STOMP_FRAME_REJECTED", "Thông điệp STOMP không hợp lệ hoặc không được phép.");
    }

    static Message<byte[]> sessionInvalid(String sessionId, boolean forbidden) {
        return error(sessionId, forbidden ? "FORBIDDEN" : "INVALID_SESSION", "Phiên WebSocket không còn quyền truy cập.");
    }

    private static Message<byte[]> error(String sessionId, String code, String message) {
        var headers = StompHeaderAccessor.create(StompCommand.ERROR);
        headers.setMessage(code);
        if (sessionId != null) headers.setSessionId(sessionId);
        return MessageBuilder.createMessage(message.getBytes(StandardCharsets.UTF_8),
                headers.getMessageHeaders());
    }
}
