package com.huyenco.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.dto.ApiError;
import com.huyenco.websocket.SafeStompErrorHandler;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

class ChatContractExamplesTest {
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    void restExamplesMatchPublicWireRecords() throws Exception {
        var examples = examples();
        rest(examples, "c1", ChatConsultantProfiles.Page.class);
        rest(examples, "c2", ChatConsultantProfiles.PublicProfile.class);
        for (String key : List.of("c3", "c5")) rest(examples, key, ChatConversationController.ConversationView.class);
        rest(examples, "c4", ChatConversationController.PageView.class);
        for (String key : List.of("c6", "c9")) rest(examples, key, ChatConversationController.TransitionView.class);
        for (String key : List.of("c8", "c8Empty")) rest(examples, key, ChatConversationController.MessagePage.class);
        rest(examples, "c10", ChatSessionAccess.Actor.class);
        for (String key : List.of("restOutsideRoom", "restInvalidSession", "restTransitionConflict")) {
            JsonNode response = examples.required(key);
            assertEquals("FAILED", response.required("status").asText());
            assertTrue(response.required("data").isNull());
            roundTrip(response.required("error"), ApiError.class);
            roundTrip(response, ChatConversationController.Envelope.class);
        }
        assertFalse(examples.required("c3Request").required("requestId").equals(examples.required("c3").required("requestId")));
    }

    @Test
    void socketExamplesDistinguishApplicationAckFromProtocolError() throws Exception {
        var examples = examples();
        var ack = roundTrip(examples.required("c7Ack"), ChatMessageSocketController.Ack.class);
        var event = roundTrip(examples.required("c7Message"), ChatMessageSocketController.Incoming.class);
        roundTrip(examples.required("c7Error"), ChatMessageSocketController.SendError.class);
        roundTrip(examples.required("c7UncorrelatedError"), ChatMessageSocketController.SendError.class);
        var message = roundTrip(examples.required("c8").required("data").required("items").get(0),
                ChatConversationController.MessageView.class);
        assertEquals(ack.messageId(), event.messageId());
        assertEquals(event.messageId(), message.messageId());
        assertEquals(ack.sequence(), message.sequence());
        assertEquals(event.createdAt(), message.createdAt());
        assertEquals(examples.required("c7Send").required("clientMessageId").asText(), ack.clientMessageId().toString());
        assertEquals(examples.required("c7Send").required("text").asText(), event.text());
        var headers = StompHeaderAccessor.wrap(SafeStompErrorHandler.rejected("test-session"));
        assertEquals(StompCommand.ERROR, headers.getCommand());
        assertEquals("STOMP_FRAME_REJECTED", headers.getMessage());
    }

    private JsonNode examples() throws Exception {
        return json.readTree(Path.of("..", "docs", "examples", "chat-v1.json").toFile());
    }

    private void rest(JsonNode examples, String key, Class<?> type) throws Exception {
        JsonNode response = examples.required(key);
        UUID.fromString(response.required("requestId").asText());
        assertEquals("COMPLETED", response.required("status").asText());
        assertTrue(response.required("error").isNull());
        roundTrip(response.required("data"), type);
        roundTrip(response, ChatConversationController.Envelope.class);
    }

    private <T> T roundTrip(JsonNode sample, Class<T> type) throws Exception {
        T dto = json.treeToValue(sample, type);
        assertEquals(sample, json.readTree(json.writeValueAsBytes(dto)), type.getSimpleName());
        return dto;
    }
}
