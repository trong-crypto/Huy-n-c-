package com.huyenco.websocket;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;

class SessionDestinationInterceptorTest {
    @Test
    void onlyOwnLogicalSubscriptionsAndApplicationRequestsAreAllowed() {
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(new CalculationFlowTest.Capture()), 60000, 2, 2, 2)) {
            var factory = new DefaultListableBeanFactory(); factory.registerSingleton("sessions", sessions);
            var outbound = new CalculationFlowTest.Capture(); factory.registerSingleton("outbound", outbound);
            var interceptor = new SessionDestinationInterceptor(factory.getBeanProvider(CalculationSessions.class),
                    factory.getBeanProvider(MessageChannel.class));
            for (String destination : List.of("/user/queue/progress", "/user/queue/errors", "/user/queue/results"))
                assertDoesNotThrow(() -> interceptor.preSend(message(StompCommand.SUBSCRIBE, destination), null));
            for (String destination : List.of("/queue/progress-userVictim", "/user/Victim/queue/results", "/topic/all", "/queue/results")) {
                assertNull(interceptor.preSend(message(StompCommand.SUBSCRIBE, destination), null));
                assertNull(interceptor.preSend(message(StompCommand.SEND, destination), null));
            }
            assertDoesNotThrow(() -> interceptor.preSend(message(StompCommand.SEND, "/app/mai-hoa/calculate"), null));
            assertNull(interceptor.preSend(message(StompCommand.SUBSCRIBE, null), null));
            assertEquals(9, outbound.frames.size());
            assertTrue(outbound.frames.stream().allMatch(m -> "STOMP_FRAME_REJECTED".equals(
                    StompHeaderAccessor.wrap(m).getMessage())));
            interceptor.preSend(message(StompCommand.CONNECT, null), null);
            assertEquals(1, sessions.sessionCount());
            interceptor.preSend(message(StompCommand.DISCONNECT, null), null);
            assertEquals(0, sessions.sessionCount());
        }
    }

    private static org.springframework.messaging.Message<byte[]> message(StompCommand command, String destination) {
        var headers = StompHeaderAccessor.create(command); headers.setSessionId("A");
        if (destination != null) headers.setDestination(destination);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }
}
