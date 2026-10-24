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
        var headers = StompHeaderAccessor.create(StompCommand.ERROR);
        headers.setMessage("STOMP_FRAME_REJECTED");
        if (sessionId != null) headers.setSessionId(sessionId);
        return MessageBuilder.createMessage("Thông điệp STOMP không hợp lệ hoặc không được phép.".getBytes(StandardCharsets.UTF_8),
                headers.getMessageHeaders());
    }
}
