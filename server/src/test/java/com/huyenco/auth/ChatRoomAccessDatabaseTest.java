package com.huyenco.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.chat.ChatConversations;
import com.huyenco.chat.ChatConversationLifecycle;
import com.huyenco.chat.ChatConversationLifecycle.Action;
import com.huyenco.chat.ChatConversationLifecycle.EndReason;
import com.huyenco.chat.ChatConversationLifecycle.Status;
import com.huyenco.chat.ChatMessages;
import com.huyenco.chat.ChatMessageRetention;
import com.huyenco.chat.ChatRoomAccess;
import com.huyenco.common.exception.ContractException;
import com.huyenco.websocket.ChatSocketSecurity;
import com.huyenco.websocket.AdminReviewNotifications;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1",
        "spring.datasource.url=${HUYENCO_CHAT_ROOM_TEST_DB_URL}",
        "spring.datasource.username=${HUYENCO_CHAT_ROOM_TEST_DB_USERNAME}",
        "spring.datasource.password=${HUYENCO_CHAT_ROOM_TEST_DB_PASSWORD}",
        "huyenco.auth.enabled=true",
        "huyenco.auth.csrf-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "huyenco.allowed-origins=http://127.0.0.1:3173"
})
@AutoConfigureMockMvc
@ActiveProfiles("db")
@EnabledIfEnvironmentVariable(named = "HUYENCO_CHAT_ROOM_TEST_DB_URL",
        matches = "jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/huyenco_chat_room_test(?:_[a-z0-9]+)?")
@Transactional(isolation = Isolation.REPEATABLE_READ)
class ChatRoomAccessDatabaseTest {
    private static final String CONVERSATIONS = "/api/v1/chat/conversations";
    @Autowired JdbcTemplate db;
    @Autowired AccountAuthService accounts;
    @Autowired ChatRoomAccess access;
    @Autowired ChatConversations conversations;
    @Autowired ChatConversationLifecycle lifecycle;
    @Autowired ChatSessionAccess chatSessions;
    @Autowired ChatMessages messages;
    @Autowired ChatMessageRetention messageRetention;
    @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired @Qualifier("clientInboundChannel") SubscribableChannel inbound;
    @Autowired SimpMessagingTemplate broker;
    @Autowired SimpUserRegistry socketUsers;
    @Autowired AdminReviewNotifications reviewNotices;
    @LocalServerPort int port;
    private final String password = UUID.randomUUID().toString();

    @Test
    void historyRestPaginatesRetainedMessagesAndPreservesBigintPrecision() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        String path = CONVERSATIONS + "/" + room + "/messages";
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        mvc.perform(get(path).cookie(userRequest.getCookies()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.nextAfterSequence").value("0"));
        lifecycle.transition(consultantRequest, room, Action.ACCEPT);
        var sender = chatSessions.requireWrite(userRequest);
        var first = messages.append(sender, room, UUID.randomUUID(), "Tin hết hạn").message();
        db.update("UPDATE chat_messages SET created_at = clock_timestamp() - INTERVAL '721 hours' WHERE id = ?", first.messageId());
        var recent = messages.append(sender, room, UUID.randomUUID(), "Tin còn hạn").message();
        db.update("UPDATE chat_conversations SET last_message_sequence = ? WHERE id = ?", 9_007_199_254_740_992L, room);
        var large = messages.append(sender, room, UUID.randomUUID(), "Tin có cursor BIGINT").message();
        lifecycle.transition(userRequest, room, Action.END);

        mvc.perform(get(path).cookie(consultantRequest.getCookies()).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].messageId").value(recent.messageId().toString()))
                .andExpect(jsonPath("$.data.items[0].conversationId").value(room.toString()))
                .andExpect(jsonPath("$.data.items[0].senderAccountId").value(user.id().toString()))
                .andExpect(jsonPath("$.data.items[0].sequence").isString())
                .andExpect(jsonPath("$.data.items[0].sequence").value("2"))
                .andExpect(jsonPath("$.data.items[0].text").value("Tin còn hạn"))
                .andExpect(jsonPath("$.data.items[0].createdAt").value(recent.createdAt().toInstant().toString()))
                .andExpect(jsonPath("$.data.items[0].clientMessageId").doesNotExist())
                .andExpect(jsonPath("$.data.nextAfterSequence").value("2"))
                .andExpect(jsonPath("$.data.hasMore").value(true));
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("afterSequence", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].messageId").value(large.messageId().toString()))
                .andExpect(jsonPath("$.data.items[0].sequence").isString())
                .andExpect(jsonPath("$.data.items[0].sequence").value("9007199254740993"))
                .andExpect(jsonPath("$.data.nextAfterSequence").isString())
                .andExpect(jsonPath("$.data.nextAfterSequence").value("9007199254740993"))
                .andExpect(jsonPath("$.data.hasMore").value(false));
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("afterSequence", "9007199254740993"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.nextAfterSequence").value("9007199254740993"))
                .andExpect(jsonPath("$.data.hasMore").value(false));
    }

    @Test
    void historyRestRejectsInvalidCursorsAndHidesRoomsFromOutsiders() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        String path = CONVERSATIONS + "/" + room + "/messages";
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var outsiderRequest = request(outsider, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        mvc.perform(get(path)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_SESSION"));
        var outside = mvc.perform(get(path).cookie(outsiderRequest.getCookies())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND")).andReturn();
        var absent = mvc.perform(get(CONVERSATIONS + "/" + UUID.randomUUID() + "/messages").cookie(outsiderRequest.getCookies()))
                .andExpect(status().isNotFound()).andReturn();
        assertEquals(json.readTree(outside.getResponse().getContentAsString()).path("error"),
                json.readTree(absent.getResponse().getContentAsString()).path("error"));
        mvc.perform(get(path).cookie(userRequest.getCookies()).header("Origin", "https://invalid.example"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        for (String cursor : List.of("", "00", "-1", "1.0", "9223372036854775808")) {
            mvc.perform(get(path).cookie(userRequest.getCookies()).param("afterSequence", cursor))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        }
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("afterSequence", "0", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("size", "101"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("page", "0"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path).cookie(userRequest.getCookies()).param("afterSequence", Long.toString(Long.MAX_VALUE)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.nextAfterSequence").value(Long.toString(Long.MAX_VALUE)));
        db.update("""
                UPDATE consultant_profiles SET review_status = 'REJECTED', rejection_reason = 'Test'
                WHERE account_id = ?
                """, consultant.id());
        mvc.perform(get(path).cookie(consultantRequest.getCookies())).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        db.update("UPDATE account_sessions SET revoked_at = clock_timestamp() WHERE account_id = ?", user.id());
        mvc.perform(get(path).cookie(userRequest.getCookies())).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_SESSION"));
    }

    @Test
    void retentionHidesExpiredMessagesBeforeCleanupAndPreventsResurrectionAfterCleanup() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        var sender = chatSessions.requireWrite(userRequest);
        var peer = chatSessions.requireWrite(consultantRequest);
        lifecycle.transition(consultantRequest, room, Action.ACCEPT);
        UUID expiredKey = UUID.randomUUID();
        var stale = messages.append(sender, room, expiredKey, "Tin cần hết hạn").message();
        var recent = messages.append(peer, room, UUID.randomUUID(), "Tin vẫn còn").message();
        db.update("""
                UPDATE chat_messages SET created_at = clock_timestamp() - INTERVAL '721 hours' WHERE id = ?
                """, stale.messageId());
        assertEquals(new ChatMessages.Page(List.of(recent), 2, false), messages.readAfter(consultantRequest, room, 0, 1));
        assertChatFailure("MESSAGE_EXPIRED", () -> messages.append(sender, room, expiredKey, stale.text()));
        assertEquals(1, messageRetention.purgeExpired());
        assertEquals(0, messageRetention.purgeExpired());
        assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE id = ?", Integer.class, stale.messageId()));
        assertEquals(1, db.queryForObject("""
                SELECT COUNT(*) FROM chat_expired_message_keys
                WHERE conversation_id = ? AND sender_account_id = ? AND client_message_id = ?
                """, Integer.class, room, user.id(), expiredKey));
        assertChatFailure("MESSAGE_EXPIRED", () -> messages.append(sender, room, expiredKey, "Nội dung khác"));
        assertEquals(3, messages.append(peer, room, expiredKey, "Mã này thuộc bên gửi khác").message().sequence());
        lifecycle.transition(userRequest, room, Action.END);
        assertEquals(List.of(2L, 3L), messages.readAfter(userRequest, room, 0, 10).items().stream()
                .map(ChatMessages.Message::sequence).toList());
    }

    @Test
    void retentionCleansBacklogInBoundedBatches() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        db.update("""
                INSERT INTO chat_messages (id, conversation_id, sender_account_id, client_message_id, sequence, body, created_at)
                SELECT gen_random_uuid(), ?, ?, gen_random_uuid(), n, 'TEST', clock_timestamp() - INTERVAL '721 hours'
                FROM generate_series(1, 1001) AS n
                """, room, user.id());
        assertEquals(1000, messageRetention.purgeExpired());
        assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE conversation_id = ?", Integer.class, room));
        assertEquals(1, messageRetention.purgeExpired());
        assertEquals(0, messageRetention.purgeExpired());
        assertEquals(1001, db.queryForObject("SELECT COUNT(*) FROM chat_expired_message_keys WHERE conversation_id = ?",
                Integer.class, room));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void realChatSocketsEnforceHandshakeRoomAndRevocationBeforeDelivery() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var outsiderRequest = request(outsider, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        BlockingQueue<Message<?>> accepted = new LinkedBlockingQueue<>();
        MessageHandler observeSend = message -> {
            if (message.getHeaders().containsKey(ChatSocketSecurity.ACTOR_HEADER)) accepted.add(message);
        };
        inbound.subscribe(observeSend);
        try {
            assertThrows(CompletionException.class, () -> newSocket(null, "http://127.0.0.1:3173"));
            assertThrows(CompletionException.class, () -> newSocket(userRequest, "https://invalid.example"));
            try (var rejected = newSocket(userRequest, "http://127.0.0.1:3173")) {
                rejected.connect("invalid");
                assertTrue(rejected.next().startsWith("ERROR"));
            }
            try (var rejected = connected(outsiderRequest)) {
                rejected.send("SUBSCRIBE\nid:outside\ndestination:/user/queue/chat/rooms/" + room + "\n\n");
                assertTrue(rejected.next().startsWith("ERROR"));
            }
            try (var rejected = connected(outsiderRequest)) {
                rejected.send("SEND\ndestination:/app/chat/rooms/" + room + "/send\n\n{}");
                assertTrue(rejected.next().startsWith("ERROR"));
                assertTrue(accepted.isEmpty());
            }
            try (var rejected = connected(userRequest)) {
                rejected.send("SUBSCRIBE\nid:physical\ndestination:/queue/chat/rooms/" + room + "\n\n");
                assertTrue(rejected.next().startsWith("ERROR"));
            }
            try (var reader = connected(userRequest); var peer = connected(consultantRequest)) {
                reader.send("SUBSCRIBE\nid:mine\ndestination:/user/queue/chat/rooms/" + room + "\n\n");
                reader.send("SEND\ndestination:/app/chat/rooms/" + room + "/send\n\n{}");
                var authorized = java.util.Objects.requireNonNull(accepted.poll(5, TimeUnit.SECONDS));
                var actor = (ChatSessionAccess.Actor) authorized.getHeaders().get(ChatSocketSecurity.ACTOR_HEADER);
                assertEquals(user.id(), actor.accountId());
                assertEquals("INVALID_INPUT", readChat(reader, "ERROR").path("code").asText());
                String socketId = SimpMessageHeaderAccessor.getSessionId(authorized.getHeaders());
                assertTrue(socketId != null && !socketId.isBlank());
                peer.send("SEND\ndestination:/app/chat/rooms/" + room + "/send\n\n{}");
                var authorizedPeer = java.util.Objects.requireNonNull(accepted.poll(5, TimeUnit.SECONDS));
                assertEquals(consultant.id(), ((ChatSessionAccess.Actor)
                        authorizedPeer.getHeaders().get(ChatSocketSecurity.ACTOR_HEADER)).accountId());
                String delivered = null;
                for (int attempt = 0; attempt < 12 && delivered == null; attempt++) {
                    sendProbe(socketId, room, "authorized-probe");
                    String candidate = reader.frames.poll(250, TimeUnit.MILLISECONDS);
                    if (candidate != null && candidate.contains("authorized-probe")) delivered = candidate;
                }
                assertTrue(delivered != null && delivered.startsWith("MESSAGE") && delivered.contains("authorized-probe"));
                db.update("UPDATE account_sessions SET revoked_at = clock_timestamp() WHERE account_id = ?", user.id());
                sendProbe(socketId, room, "must-not-leak");
                String denied;
                do {
                    denied = reader.next();
                } while (denied.endsWith("authorized-probe"));
                assertTrue(denied.startsWith("ERROR") && !denied.contains("must-not-leak"));
                assertThrows(CompletionException.class, () -> newSocket(userRequest, "http://127.0.0.1:3173"));
                db.update("UPDATE accounts SET status = 'LOCKED' WHERE id = ?", consultant.id());
                peer.send("SEND\ndestination:/app/chat/rooms/" + room + "/send\n\n{}");
                assertTrue(peer.next().startsWith("ERROR"));
                assertTrue(accepted.isEmpty());
            }
        } finally {
            inbound.unsubscribe(observeSend);
            db.update("DELETE FROM chat_conversations WHERE id = ?", room);
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?, ?)", user.id(), outsider.id(), consultant.id(), admin.id());
        }
    }

    private void sendProbe(String socketId, UUID room, String text) {
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(socketId);
        headers.setLeaveMutable(true);
        broker.convertAndSendToUser(socketId, "/queue/chat/rooms/" + room, text, headers.getMessageHeaders());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void realChatPersistsAndAcknowledgesBothDirectionsWithoutRebroadcastingRetries() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        try (var customer = connected(userRequest); var advisor = connected(consultantRequest);
             var anotherCustomerTab = connected(userRequest); var customerWorkspace = connected(userRequest);
             var advisorWorkspace = connected(consultantRequest)) {
            subscribeToMessages(customer, user.id(), room);
            subscribeToMessages(advisor, consultant.id(), room);
            subscribeToMessages(anotherCustomerTab, user.id(), room);
            subscribeWorkspace(customerWorkspace, user.id());
            subscribeWorkspace(advisorWorkspace, consultant.id());
            customer.send("SEND\ndestination:/app/chat/rooms/" + room + "/sync\n\n");
            assertEquals(room.toString(), readChat(customer, "READY").path("conversationId").asText());
            UUID firstId = UUID.randomUUID();
            String first = json.writeValueAsString(java.util.Map.of("clientMessageId", firstId, "text", "Xin chào"));
            sendChat(customer, room, first);
            assertEquals("ROOM_NOT_ACTIVE", readChat(customer, "ERROR").path("code").asText());
            lifecycle.transition(consultantRequest, room, Action.ACCEPT);
            readChat(customerWorkspace, "ROOM_CHANGED");
            readChat(advisorWorkspace, "ROOM_CHANGED");

            sendChat(customer, room, first);
            JsonNode ack = readChat(customer, "ACK");
            assertEquals(firstId.toString(), ack.path("clientMessageId").asText());
            assertEquals("1", ack.path("sequence").textValue());
            assertEquals("Xin chào", db.queryForObject("SELECT body FROM chat_messages WHERE id = ?", String.class,
                    UUID.fromString(ack.path("messageId").asText())));
            JsonNode incoming = readChat(advisor, "MESSAGE");
            assertEquals(ack.path("messageId"), incoming.path("messageId"));
            assertEquals(ack.path("sequence"), incoming.path("sequence"));
            assertEquals(ack.path("createdAt"), incoming.path("createdAt"));
            assertEquals(user.id().toString(), incoming.path("senderAccountId").asText());
            assertEquals("Xin chào", incoming.path("text").asText());
            assertEquals(incoming, readChat(anotherCustomerTab, "MESSAGE"));
            var advisorNotice = readChat(advisorWorkspace, "MESSAGE_RECEIVED");
            assertEquals(room.toString(), advisorNotice.path("conversationId").asText());
            assertEquals(2, advisorNotice.size());
            assertNull(customerWorkspace.frames.poll(300, TimeUnit.MILLISECONDS));

            sendChat(customer, room, first);
            assertEquals(ack, readChat(customer, "ACK"));
            assertNull(advisor.frames.poll(300, TimeUnit.MILLISECONDS));
            assertNull(advisorWorkspace.frames.poll(300, TimeUnit.MILLISECONDS));
            sendChat(customer, room, first.replace("Xin chào", "Sửa nội dung"));
            var conflict = readChat(customer, "ERROR");
            assertEquals(firstId.toString(), conflict.path("clientMessageId").asText());
            assertEquals("MESSAGE_ID_CONFLICT", conflict.path("code").asText());
            sendChat(customer, room, first + " {}");
            assertEquals("INVALID_INPUT", readChat(customer, "ERROR").path("code").asText());

            String reply = json.writeValueAsString(java.util.Map.of("clientMessageId", UUID.randomUUID(), "text", "Chào bạn"));
            sendChat(advisor, room, reply);
            var replyAck = readChat(advisor, "ACK");
            var replyEvent = readChat(customer, "MESSAGE");
            assertEquals(replyAck.path("messageId"), replyEvent.path("messageId"));
            assertEquals("2", replyEvent.path("sequence").textValue());
            assertEquals(consultant.id().toString(), replyEvent.path("senderAccountId").asText());
            assertEquals(room.toString(), readChat(customerWorkspace, "MESSAGE_RECEIVED").path("conversationId").asText());
            assertNull(advisorWorkspace.frames.poll(300, TimeUnit.MILLISECONDS));
            lifecycle.transition(userRequest, room, Action.END);
            sendChat(customer, room, first);
            assertEquals(ack, readChat(customer, "ACK"));
            assertEquals(2, db.queryForObject("SELECT count(*) FROM chat_messages WHERE conversation_id = ?", Integer.class, room));
            Cookie cookie = userRequest.getCookies()[0];
            var historyRequest = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                            + CONVERSATIONS + "/" + room + "/messages?afterSequence=1"))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .header("Cookie", cookie.getName() + "=" + cookie.getValue())
                    .build();
            var history = HttpClient.newHttpClient().send(historyRequest, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, history.statusCode());
            var stored = json.readTree(history.body()).path("data").path("items");
            assertEquals(1, stored.size());
            var expected = (com.fasterxml.jackson.databind.node.ObjectNode) replyEvent.deepCopy();
            expected.remove("type");
            assertEquals(expected, stored.get(0));
        } finally {
            db.update("DELETE FROM chat_messages WHERE conversation_id = ?", room);
            db.update("DELETE FROM chat_conversations WHERE id = ?", room);
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?)", user.id(), consultant.id(), admin.id());
        }
    }

    private void subscribeToMessages(TestSocket socket, UUID accountId, UUID room) throws InterruptedException {
        subscribePrivate(socket, accountId, "/queue/chat/rooms/" + room);
    }

    private void subscribeWorkspace(TestSocket socket, UUID accountId) throws InterruptedException {
        subscribePrivate(socket, accountId, ChatSocketSecurity.WORKSPACE_QUEUE);
    }

    private void subscribePrivate(TestSocket socket, UUID accountId, String destination) throws InterruptedException {
        String subscription = UUID.randomUUID().toString();
        socket.send("SUBSCRIBE\nid:" + subscription + "\ndestination:/user" + destination + "\n\n");
        awaitSubscription(socket, () -> {
            var account = socketUsers.getUser(ChatSocketSecurity.accountDestination(accountId));
            if (account == null) return;
            account.getSessions().stream()
                    .filter(session -> session.getSubscriptions().stream().anyMatch(item -> subscription.equals(item.getId())))
                    .findFirst().ifPresent(session -> {
                        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
                        headers.setSessionId(session.getId());
                        headers.setLeaveMutable(true);
                        broker.convertAndSendToUser(session.getId(), destination, "ready-probe", headers.getMessageHeaders());
                    });
        });
    }

    private void awaitSubscription(TestSocket socket, Runnable probe) throws InterruptedException {
        for (int attempt = 0; attempt < 12; attempt++) {
            probe.run();
            String frame = socket.frames.poll(250, TimeUnit.MILLISECONDS);
            if (frame != null && frame.startsWith("MESSAGE") && frame.contains("ready-probe")) return;
        }
        throw new AssertionError("Subscription did not receive the probe");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void workspaceCommandsNotifyBothParticipantsAndKeepOutsidersIsolated() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        var realm = AccountAuthService.Realm.CUSTOMER;
        try (var customer = connected(request(user, realm)); var advisor = connected(request(consultant, realm));
             var other = connected(request(outsider, realm))) {
            subscribeWorkspace(customer, user.id());
            subscribeWorkspace(advisor, consultant.id());
            subscribeWorkspace(other, outsider.id());
            customer.send("SEND\ndestination:" + ChatSocketSecurity.WORKSPACE_COMMAND + "\n\n{\"action\":\"SYNC\"}");
            readChat(customer, "READY");
            for (String firstAction : java.util.List.of("ACCEPT", "DECLINE", "CANCEL")) {
                UUID createId = UUID.randomUUID();
                sendWorkspace(customer, "CREATE", "consultantId", consultant.id(), createId);
                var created = readChat(customer, "ROOM_CREATED");
                var room = UUID.fromString(created.path("conversationId").asText());
                assertEquals(created, readChat(advisor, "ROOM_CREATED"));
                var ack = readChat(customer, "ACK");
                assertEquals(createId.toString(), ack.path("requestId").asText());
                assertEquals(room.toString(), ack.path("conversation").path("conversationId").asText());
                sendWorkspace(customer, "CREATE", "consultantId", consultant.id(), createId);
                assertEquals(ack, readChat(customer, "ACK"));
                sendWorkspace(other, "END", "conversationId", room, UUID.randomUUID());
                assertEquals("NOT_FOUND", readChat(other, "ERROR").path("code").asText());

                var actor = "CANCEL".equals(firstAction) ? customer : advisor;
                sendWorkspace(actor, firstAction, "conversationId", room, UUID.randomUUID());
                var changed = readChat(customer, "ROOM_CHANGED");
                assertEquals(changed, readChat(advisor, "ROOM_CHANGED"));
                assertEquals(room.toString(), changed.path("conversationId").asText());
                assertEquals("ACCEPT".equals(firstAction) ? "ACTIVE" : "ENDED", changed.path("status").asText());
                readChat(actor, "ACK");

                if ("ACCEPT".equals(firstAction)) {
                    sendWorkspace(customer, "TYPING", "conversationId", room, null);
                    assertEquals(room.toString(), readChat(advisor, "TYPING").path("conversationId").asText());
                    sendWorkspace(advisor, "PRESENCE", "conversationId", room, null);
                    assertEquals(room.toString(), readChat(customer, "PRESENCE").path("conversationId").asText());
                    assertTrue(readChat(advisor, "PEER_ONLINE").path("online").asBoolean());
                    sendWorkspace(customer, "END", "conversationId", room, UUID.randomUUID());
                    var ended = readChat(customer, "ROOM_CHANGED");
                    assertEquals("COMPLETED", ended.path("endReason").asText());
                    assertEquals(ended, readChat(advisor, "ROOM_CHANGED"));
                    readChat(customer, "ACK");
                }
                assertNull(other.frames.poll(100, TimeUnit.MILLISECONDS));
            }
        } finally {
            db.update("DELETE FROM chat_conversations WHERE user_account_id = ?", user.id());
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?, ?)", user.id(), consultant.id(), admin.id(), outsider.id());
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void reviewQueueRequiresAdminAndAccountSocketPushesRevocation() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        try (var adminSocket = connected(request(admin, AccountAuthService.Realm.ADMIN), ChatSocketSecurity.ADMIN_ENDPOINT);
             var accountSocket = connected(userRequest, ChatSocketSecurity.ACCOUNT_ENDPOINT);
             var wrongRealm = connected(userRequest)) {
            adminSocket.send("SUBSCRIBE\nid:reviews\ndestination:" + ChatSocketSecurity.ADMIN_QUEUE + "\n\n");
            awaitSubscription(adminSocket, () -> broker.convertAndSend(ChatSocketSecurity.ADMIN_QUEUE, "ready-probe"));
            wrongRealm.send("SUBSCRIBE\nid:reviews\ndestination:" + ChatSocketSecurity.ADMIN_QUEUE + "\n\n");
            assertTrue(wrongRealm.next().startsWith("ERROR"));
            reviewNotices.submitted(AdminReviewNotifications.Area.METHOD_GUIDE);
            assertEquals("METHOD_GUIDE", readChat(adminSocket, "REVIEW_PENDING").path("area").asText());
            accounts.logout(AccountAuthService.Realm.CUSTOMER, userRequest.getCookies()[0].getValue(),
                    userRequest.getHeader("X-CSRF-Token"));
            var revoked = accountSocket.frames.poll(10, TimeUnit.SECONDS);
            assertTrue(revoked != null && revoked.startsWith("ERROR") && revoked.contains("message:INVALID_SESSION"), revoked);
        } finally {
            db.update("DELETE FROM accounts WHERE id IN (?, ?)", admin.id(), user.id());
        }
    }

    private void sendWorkspace(TestSocket socket, String action, String field, UUID id, UUID requestId) throws Exception {
        var payload = json.createObjectNode().put("action", action).put(field, id.toString());
        if (requestId != null) payload.put("requestId", requestId.toString());
        socket.send("SEND\ndestination:" + ChatSocketSecurity.WORKSPACE_COMMAND + "\ncontent-type:application/json\n\n" + payload);
    }

    private static void sendChat(TestSocket socket, UUID room, String payload) {
        socket.send("SEND\ndestination:/app/chat/rooms/" + room + "/send\ncontent-type:application/json\n\n" + payload);
    }

    private JsonNode readChat(TestSocket socket, String type) throws Exception {
        String frame;
        do {
            frame = socket.next();
        } while (frame.endsWith("ready-probe"));
        assertTrue(frame.startsWith("MESSAGE"), frame);
        int body = frame.indexOf("\n\n");
        assertTrue(body >= 0, frame);
        JsonNode payload = json.readTree(frame.substring(body + 2));
        assertEquals(type, payload.path("type").asText(), payload.toString());
        return payload;
    }

    private TestSocket connected(MockHttpServletRequest request) throws Exception {
        return connected(request, ChatSocketSecurity.ENDPOINT);
    }

    private TestSocket connected(MockHttpServletRequest request, String endpoint) throws Exception {
        var socket = newSocket(request, "http://127.0.0.1:3173", endpoint);
        socket.connect(request.getHeader("X-CSRF-Token"));
        if (socket.next().startsWith("CONNECTED")) return socket;
        socket.close();
        throw new AssertionError("STOMP CONNECT failed");
    }

    private TestSocket newSocket(MockHttpServletRequest request, String origin) {
        return newSocket(request, origin, ChatSocketSecurity.ENDPOINT);
    }

    private TestSocket newSocket(MockHttpServletRequest request, String origin, String endpoint) {
        var listener = new TestSocket();
        var builder = HttpClient.newHttpClient().newWebSocketBuilder().header("Origin", origin).subprotocols("v12.stomp");
        if (request != null) {
            var cookie = request.getCookies()[0];
            builder.header("Cookie", cookie.getName() + "=" + cookie.getValue());
        }
        listener.socket = builder.buildAsync(URI.create("ws://127.0.0.1:" + port + endpoint), listener)
                .orTimeout(5, TimeUnit.SECONDS).join();
        return listener;
    }

    private static final class TestSocket implements WebSocket.Listener, AutoCloseable {
        private final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        private final StringBuilder buffer = new StringBuilder();
        private WebSocket socket;

        @Override
        public java.util.concurrent.CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            buffer.append(data);
            int end;
            while ((end = buffer.indexOf("\0")) >= 0) {
                frames.add(buffer.substring(0, end));
                buffer.delete(0, end + 1);
            }
            socket.request(1);
            return null;
        }

        void connect(String csrf) {
            send("CONNECT\naccept-version:1.2\nhost:127.0.0.1\nX-CSRF-Token:" + csrf + "\n\n");
        }

        void send(String frame) {
            socket.sendText(frame + "\0", true).orTimeout(5, TimeUnit.SECONDS).join();
        }

        String next() throws InterruptedException {
            String frame = frames.poll(5, TimeUnit.SECONDS);
            if (frame == null) throw new AssertionError("No STOMP frame received");
            return frame;
        }

        @Override
        public void close() {
            socket.abort();
        }
    }

    @Test
    void messagesPreserveOrderAndReplayOnlyTheSameSenderRoomAndText() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        UUID otherRoom = room(user.id(), consultant.id());
        var userRequest = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
        var outsiderRequest = request(outsider, AccountAuthService.Realm.CUSTOMER);
        var sender = chatSessions.requireWrite(userRequest);
        var recipient = chatSessions.requireWrite(consultantRequest);
        var stranger = chatSessions.requireWrite(outsiderRequest);
        UUID clientId = UUID.randomUUID();

        assertChatFailure("NOT_FOUND", () -> messages.append(stranger, room, clientId, "Xin chào"));
        assertChatFailure("NOT_FOUND", () -> messages.readAfter(outsiderRequest, room, 0, 1));
        assertChatFailure("ROOM_NOT_ACTIVE", () -> messages.append(sender, room, clientId, "Xin chào"));
        assertChatFailure("INVALID_INPUT", () -> messages.append(sender, room, clientId, "\u00A0\n"));
        assertChatFailure("INVALID_INPUT", () -> messages.append(sender, room, clientId, "😀".repeat(1001)));
        assertChatFailure("INVALID_INPUT", () -> messages.readAfter(userRequest, room, -1, 1));
        lifecycle.transition(consultantRequest, room, Action.ACCEPT);
        lifecycle.transition(consultantRequest, otherRoom, Action.ACCEPT);

        var first = messages.append(sender, room, clientId, "Xin chào");
        var replay = messages.append(sender, room, clientId, "Xin chào");
        assertTrue(first.created());
        assertEquals(new ChatMessages.Append(first.message(), consultant.id(), false), replay);
        assertChatFailure("MESSAGE_ID_CONFLICT", () -> messages.append(sender, room, clientId, "Đã sửa"));
        var second = messages.append(recipient, room, clientId, "Chào bạn").message();
        var separate = messages.append(sender, otherRoom, clientId, "Phòng khác").message();
        assertEquals(1, first.message().sequence());
        assertEquals(2, second.sequence());
        assertEquals(1, separate.sequence());
        var page = messages.readAfter(consultantRequest, room, 0, 1);
        assertEquals(new ChatMessages.Page(List.of(first.message()), 1, true), page);
        assertEquals(new ChatMessages.Page(List.of(second), 2, false),
                messages.readAfter(userRequest, room, page.nextAfterSequence(), 1));
        assertEquals(new ChatMessages.Page(List.of(), 2, false), messages.readAfter(userRequest, room, 2, 1));

        lifecycle.transition(userRequest, room, Action.END);
        assertChatFailure("ROOM_NOT_ACTIVE", () -> messages.append(sender, room, UUID.randomUUID(), "Tin mới"));
        assertEquals(replay, messages.append(sender, room, clientId, "Xin chào"));
        assertEquals(List.of(first.message(), second), messages.readAfter(consultantRequest, room, 0, 10).items());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentDuplicateMessagesCommitOneRowAndOneSequence() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var workers = Executors.newFixedThreadPool(2);
        try {
            var sender = chatSessions.requireWrite(request(user, AccountAuthService.Realm.CUSTOMER));
            var consultantRequest = request(consultant, AccountAuthService.Realm.CUSTOMER);
            lifecycle.transition(consultantRequest, room, Action.ACCEPT);
            var start = new CyclicBarrier(2);
            UUID clientId = UUID.randomUUID();
            java.util.concurrent.Callable<ChatMessages.Append> send = () -> {
                start.await(5, TimeUnit.SECONDS);
                return messages.append(sender, room, clientId, "Gửi đồng thời");
            };
            var first = workers.submit(send);
            var second = workers.submit(send);
            var left = first.get(10, TimeUnit.SECONDS);
            var right = second.get(10, TimeUnit.SECONDS);
            assertTrue(left.created() ^ right.created());
            assertEquals(left.message(), right.message());
            assertEquals(1, left.message().sequence());
            assertEquals(List.of(left.message()), messages.readAfter(consultantRequest, room, 0, 10).items());
        } finally {
            workers.shutdownNow();
            workers.awaitTermination(10, TimeUnit.SECONDS);
            db.update("DELETE FROM chat_messages WHERE conversation_id = ?", room);
            db.update("DELETE FROM chat_conversations WHERE id = ?", room);
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?)", user.id(), consultant.id(), admin.id());
        }
    }

    @Test
    void lifecycleRestValidatesRoleAndReturnsPersistedStateForAllActions() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        var outsiderSession = request(outsider, AccountAuthService.Realm.CUSTOMER);
        UUID id = room(user.id(), consultant.id());
        transitionRoom(outsiderSession, id, "{\"action\":\"END\"}").andExpect(status().isNotFound());
        transitionRoom(userSession, id, "{\"action\":\"ACCEPT\"}").andExpect(status().isForbidden());
        transitionRoom(consultantSession, id, "{\"action\":\"ACCEPT\",\"reason\":\"extra\"}").andExpect(status().isBadRequest());
        transitionRoom(consultantSession, id, "{\"action\":\"accept\"}").andExpect(status().isBadRequest());
        mvc.perform(post(CONVERSATIONS + "/" + id + "/transition").contentType("application/json")
                        .content("{\"action\":\"ACCEPT\"}").cookie(consultantSession.getCookies())
                        .header("Origin", consultantSession.getHeader("Origin")).header("X-HuyenCo-Request", "1"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));

        var active = transitionRoom(consultantSession, id, "{\"action\":\"ACCEPT\"}")
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.conversationId").value(id.toString()))
                .andExpect(jsonPath("$.data.status").value("ACTIVE")).andReturn().getResponse();
        var startedAt = json.readTree(active.getContentAsByteArray()).path("data").path("startedAt").textValue();
        transitionRoom(consultantSession, id, "{\"action\":\"ACCEPT\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.startedAt").value(startedAt));
        transitionRoom(userSession, id, "{\"action\":\"CANCEL\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INVALID_TRANSITION"));
        transitionRoom(userSession, id, "{\"action\":\"END\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ENDED"))
                .andExpect(jsonPath("$.data.endReason").value("COMPLETED"))
                .andExpect(jsonPath("$.data.endedByAccountId").value(user.id().toString()));
        transitionRoom(consultantSession, id, "{\"action\":\"END\"}").andExpect(status().isConflict());
        mvc.perform(get(CONVERSATIONS + "/" + id).cookie(consultantSession.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("ENDED"));

        transitionRoom(consultantSession, room(user.id(), consultant.id()), "{\"action\":\"DECLINE\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.endReason").value("DECLINED"));
        transitionRoom(userSession, room(user.id(), consultant.id()), "{\"action\":\"CANCEL\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.endReason").value("CANCELLED"));
    }

    private ResultActions transitionRoom(MockHttpServletRequest session, UUID id, String body) throws Exception {
        return mvc.perform(post(CONVERSATIONS + "/" + id + "/transition").contentType("application/json").content(body)
                .cookie(session.getCookies()).header("Origin", session.getHeader("Origin"))
                .header("X-HuyenCo-Request", "1").header("X-CSRF-Token", session.getHeader("X-CSRF-Token")));
    }

    @Test
    void conversationRestKeepsScopeAndReplaysCurrentRoomState() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account other = account("USER");
        Account consultant = approvedConsultant(admin);
        Account otherConsultant = approvedConsultant(admin);
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var otherSession = request(other, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        UUID requestId = UUID.randomUUID();

        var created = createRoom(userSession, requestId, consultant.id())
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.length()").value(9))
                .andExpect(jsonPath("$.data.userId").value(user.id().toString()))
                .andExpect(jsonPath("$.data.consultantId").value(consultant.id().toString()))
                .andExpect(jsonPath("$.data.status").value("PENDING")).andReturn().getResponse();
        var data = json.readTree(created.getContentAsByteArray()).path("data");
        assertTrue(data.has("startedAt") && data.get("startedAt").isNull());
        assertTrue(data.path("createdAt").textValue().endsWith("Z"));
        String id = data.path("conversationId").textValue();
        assertEquals(CONVERSATIONS + "/" + id, created.getHeader("Location"));

        lifecycle.transition(consultantSession, UUID.fromString(id), Action.ACCEPT);
        createRoom(userSession, requestId, consultant.id()).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conversationId").value(id))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
        createRoom(userSession, requestId, otherConsultant.id()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("REQUEST_ID_CONFLICT"));
        createRoom(otherSession, requestId, consultant.id()).andExpect(status().isCreated());

        mvc.perform(get(CONVERSATIONS + "/" + id).cookie(consultantSession.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("ACTIVE"));
        var outside = mvc.perform(get(CONVERSATIONS + "/" + id).cookie(otherSession.getCookies()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("NOT_FOUND")).andReturn();
        var missing = mvc.perform(get(CONVERSATIONS + "/" + UUID.randomUUID()).cookie(otherSession.getCookies()))
                .andExpect(status().isNotFound()).andReturn();
        assertEquals(json.readTree(missing.getResponse().getContentAsByteArray()).path("error"),
                json.readTree(outside.getResponse().getContentAsByteArray()).path("error"));
        mvc.perform(get(CONVERSATIONS).cookie(userSession.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].conversationId").value(id))
                .andExpect(jsonPath("$.data.totalElements").value(1)).andExpect(jsonPath("$.data.size").value(20));
        mvc.perform(get(CONVERSATIONS).cookie(consultantSession.getCookies()).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2)).andExpect(jsonPath("$.data.items.length()").value(1));

        db.update("UPDATE consultant_profiles SET review_status = 'REJECTED', rejection_reason = 'Test' WHERE account_id = ?",
                consultant.id());
        createRoom(userSession, requestId, consultant.id()).andExpect(status().isOk());
        createRoom(userSession, UUID.randomUUID(), consultant.id()).andExpect(status().isNotFound());
        mvc.perform(get(CONVERSATIONS).cookie(consultantSession.getCookies())).andExpect(status().isForbidden());
    }

    @Test
    void conversationRestRejectsMalformedInputAndUnauthorizedWrites() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        var session = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        String body = createBody(UUID.randomUUID(), consultant.id());
        mvc.perform(get(CONVERSATIONS)).andExpect(status().isUnauthorized());
        mvc.perform(get(CONVERSATIONS).cookie(session.getCookies()).param("size", "20", "21"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(CONVERSATIONS + "/1-1-1-1-1").cookie(session.getCookies())).andExpect(status().isBadRequest());
        mvc.perform(get(CONVERSATIONS).cookie(session.getCookies()).header("Origin", "https://invalid.example"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        createRoom(consultantSession, UUID.randomUUID(), consultant.id()).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        mvc.perform(post(CONVERSATIONS).contentType("application/json").content(body).cookie(session.getCookies())
                        .header("Origin", session.getHeader("Origin")).header("X-HuyenCo-Request", "1"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        for (String invalid : List.of("null", body + "{}", body + " ".repeat(1024),
                body.replace("{", "{\"role\":\"USER\","), body.replace("{", "{\"requestId\":null,"))) {
            mvc.perform(post(CONVERSATIONS).contentType("application/json").content(invalid).cookie(session.getCookies()))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        }
        assertEquals(0, db.queryForObject("SELECT count(*) FROM chat_conversations WHERE user_account_id = ?",
                Integer.class, user.id()));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentCreatesWithSameRequestIdCommitOneRoom() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        var workers = Executors.newFixedThreadPool(2);
        try {
            var session = request(user, AccountAuthService.Realm.CUSTOMER);
            UUID requestId = UUID.randomUUID();
            var start = new CyclicBarrier(2);
            var first = workers.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return createRoom(session, requestId, consultant.id()).andReturn().getResponse();
            });
            var second = workers.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return createRoom(session, requestId, consultant.id()).andReturn().getResponse();
            });
            var a = first.get(10, TimeUnit.SECONDS);
            var b = second.get(10, TimeUnit.SECONDS);
            assertEquals(List.of(200, 201), List.of(a.getStatus(), b.getStatus()).stream().sorted().toList());
            assertEquals(json.readTree(a.getContentAsByteArray()).path("data"), json.readTree(b.getContentAsByteArray()).path("data"));
            assertEquals(1, db.queryForObject("SELECT count(*) FROM chat_conversations WHERE user_account_id = ?",
                    Integer.class, user.id()));
        } finally {
            workers.shutdownNow();
            workers.awaitTermination(10, TimeUnit.SECONDS);
            db.update("DELETE FROM chat_conversations WHERE user_account_id = ?", user.id());
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?)", user.id(), consultant.id(), admin.id());
        }
    }

    private ResultActions createRoom(MockHttpServletRequest session, UUID requestId, UUID consultantId) throws Exception {
        return mvc.perform(post(CONVERSATIONS).contentType("application/json").content(createBody(requestId, consultantId))
                .cookie(session.getCookies()).header("Origin", session.getHeader("Origin"))
                .header("X-HuyenCo-Request", "1").header("X-CSRF-Token", session.getHeader("X-CSRF-Token")));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void adminCanApproveProfileAndGrantConsultantInOneAccountAction() throws Exception {
        var admin = account("ADMIN");
        var user = account("USER");
        var session = request(admin, AccountAuthService.Realm.ADMIN);
        var previous = request(user, AccountAuthService.Realm.CUSTOMER);
        String path = "/api/v1/admin/accounts/" + user.id() + "/role";
        try {
            changeRole(path, session, "{\"expectedVersion\":1,\"role\":\"CONSULTANT\"}")
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("CONSULTANT_APPROVAL_REQUIRED"));
            changeRole(path, session, "{\"expectedVersion\":1,\"role\":\"CONSULTANT\",\"approveProfile\":true}")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.account.role").value("CONSULTANT"))
                    .andExpect(jsonPath("$.data.lastRoleChange.revokedSessions").value(1));
            assertEquals("APPROVED", db.queryForObject("SELECT review_status FROM consultant_profiles WHERE account_id=?", String.class, user.id()));
            assertEquals("INVALID_SESSION", assertThrows(ContractException.class, () -> chatSessions.requireRead(previous)).code());
            assertEquals(ChatSessionAccess.Role.CONSULTANT,
                    chatSessions.requireRead(request(user, AccountAuthService.Realm.CUSTOMER)).role());
            changeRole(path, session, "{\"expectedVersion\":2,\"role\":\"USER\"}")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.account.role").value("USER"));
        } finally {
            db.update("DELETE FROM admin_account_role_events WHERE account_id=?", user.id());
            db.update("DELETE FROM consultant_profiles WHERE account_id=?", user.id());
            db.update("DELETE FROM accounts WHERE id IN (?,?)", user.id(), admin.id());
        }
    }

    @Test
    void optionalPhoneIsStoredAndVisibleInAdminDetailOnly() throws Exception {
        var admin = account("ADMIN");
        var session = request(admin, AccountAuthService.Realm.ADMIN);
        var user = account("USER");
        String detailPath = "/api/v1/admin/accounts/" + user.id();
        mvc.perform(get(detailPath).cookie(session.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.phoneNumber").doesNotExist());

        String identifier = "phone-" + UUID.randomUUID() + "@example.test";
        var registration = mvc.perform(post("/api/v1/auth/register").header("Origin", session.getHeader("Origin"))
                        .header("X-HuyenCo-Request", "1").contentType("application/json")
                        .content(json.writeValueAsString(java.util.Map.of("identifier", identifier, "displayName", "Phone TEST",
                                "password", password, "phoneNumber", "090-000-0000"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.account.phoneNumber").doesNotExist())
                .andReturn();
        String registeredId = json.readTree(registration.getResponse().getContentAsString()).path("data").path("account").path("id").asText();
        assertEquals("0900000000", db.queryForObject("SELECT phone_number FROM accounts WHERE id=?", String.class,
                UUID.fromString(registeredId)));
        mvc.perform(get("/api/v1/admin/accounts/" + registeredId).cookie(session.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.phoneNumber").value("0900000000"));
        mvc.perform(get("/api/v1/admin/accounts").cookie(session.getCookies()).param("q", identifier))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].id").value(registeredId))
                .andExpect(jsonPath("$.data.items[0].phoneNumber").doesNotExist());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"APPROVE", "REJECT", "DIRECT"})
    void passwordRequestsApplyOnlyTheCurrentDecision(String decision) throws Exception {
        var user = account("USER");
        var admin = account("ADMIN");
        var realm = AccountAuthService.Realm.CUSTOMER;
        var userSession = request(user, realm);
        var adminSession = request(admin, AccountAuthService.Realm.ADMIN);
        String replacement = "moi-" + UUID.randomUUID();
        var credentials = java.util.Map.of("currentPassword", password, "newPassword", replacement);
        passwordPost("/password/requests", userSession, credentials).andExpect(status().isAccepted());
        UUID pending = db.queryForObject("SELECT id FROM password_change_requests WHERE account_id=? AND status='PENDING'", UUID.class, user.id());
        assertThrows(AuthFailure.class, () -> accounts.login(realm, user.identifier(), replacement, null));
        passwordPost("/password/requests", userSession, credentials)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("PASSWORD_REQUEST_PENDING"));
        mvc.perform(get("/api/v1/admin/accounts").cookie(adminSession.getCookies()).param("passwordRequest", "pending")
                        .param("q", user.identifier()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].id").value(user.id().toString()));
        mvc.perform(get("/api/v1/admin/accounts/" + user.id()).cookie(adminSession.getCookies()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.passwordRequest.id").value(pending.toString()))
                .andExpect(jsonPath("$.data.passwordRequest.replacementHash").doesNotExist());

        var review = java.util.Map.of("accountId", user.id().toString(), "requestId", pending.toString(),
                "decision", "DIRECT".equals(decision) ? "APPROVE" : decision);
        passwordPost("/admin/password/requests", userSession, review).andExpect(status().isUnauthorized());
        if ("DIRECT".equals(decision)) {
            passwordPost("/password/change", userSession, credentials).andExpect(status().isNoContent());
        } else {
            passwordPost("/admin/password/requests", adminSession, review).andExpect(status().isNoContent());
        }
        passwordPost("/admin/password/requests", adminSession, review).andExpect(status().isConflict());
        String expected = "DIRECT".equals(decision) ? "CANCELLED" : "APPROVE".equals(decision) ? "APPROVED" : "REJECTED";
        assertEquals(expected, db.queryForObject("SELECT status FROM password_change_requests WHERE id=?", String.class, pending));
        assertNull(db.queryForObject("SELECT replacement_hash FROM password_change_requests WHERE id=?", String.class, pending));
        String oldToken = userSession.getCookies()[0].getValue();
        if ("REJECT".equals(decision)) {
            accounts.requireSession(realm, oldToken);
            accounts.login(realm, user.identifier(), password, null);
        } else {
            assertThrows(AuthFailure.class, () -> accounts.requireSession(realm, oldToken));
            accounts.login(realm, user.identifier(), replacement, null);
        }
    }

    private ResultActions passwordPost(String path, MockHttpServletRequest session, java.util.Map<String, String> body) throws Exception {
        return mvc.perform(post("/api/v1/auth" + path).cookie(session.getCookies()).header("Origin", session.getHeader("Origin"))
                .header("X-HuyenCo-Request", "1").header("X-CSRF-Token", session.getHeader("X-CSRF-Token"))
                .contentType("application/json").content(json.writeValueAsBytes(body)));
    }

    private ResultActions changeRole(String path, MockHttpServletRequest session, String body) throws Exception {
        return mvc.perform(put(path).cookie(session.getCookies()).header("Origin", session.getHeader("Origin"))
                .header("X-HuyenCo-Request", "1").header("X-CSRF-Token", session.getHeader("X-CSRF-Token"))
                .contentType("application/json").content(body));
    }

    private static String createBody(UUID requestId, UUID consultantId) {
        return "{\"requestId\":\"%s\",\"consultantId\":\"%s\"}".formatted(requestId, consultantId);
    }

    @Test
    void createdRoomReadsBackForBothParticipantsThroughLifecycle() {
        Account user = account("USER");
        Account outsider = account("USER");
        Account admin = account("ADMIN");
        Account consultant = approvedConsultant(admin);
        Account otherConsultant = approvedConsultant(admin);
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        var outsiderSession = request(outsider, AccountAuthService.Realm.CUSTOMER);

        var created = conversations.create(userSession, consultant.id());
        UUID id = created.conversationId();
        assertEquals(user.id(), created.userId());
        assertEquals(consultant.id(), created.consultantId());
        assertEquals(new ChatConversationLifecycle.State(Status.PENDING, null, null, null, null), created.state());
        assertEquals(created, conversations.detail(userSession, id));
        assertEquals(created, conversations.detail(consultantSession, id));

        var active = lifecycle.transition(consultantSession, id, Action.ACCEPT);
        assertEquals(active, conversations.detail(userSession, id).state());
        var ended = lifecycle.transition(userSession, id, Action.END);
        var saved = conversations.detail(consultantSession, id);
        assertEquals(ended, saved.state());
        assertEquals(created.createdAt(), saved.createdAt());

        var second = conversations.create(userSession, otherConsultant.id());
        conversations.create(outsiderSession, consultant.id());
        // CURRENT_TIMESTAMP is fixed within this transaction, so the UUID must break the tie.
        assertEquals(created.createdAt(), second.createdAt());
        var expected = db.queryForList("""
                SELECT id FROM chat_conversations WHERE user_account_id = ? ORDER BY id DESC
                """, UUID.class, user.id());
        var firstPage = conversations.list(userSession, 0, 1);
        assertEquals(2, firstPage.totalElements());
        assertEquals(2, firstPage.totalPages());
        assertEquals(expected.get(0), firstPage.items().get(0).conversationId());
        assertEquals(expected.get(1), conversations.list(userSession, 1, 1).items().get(0).conversationId());
        assertEquals(List.of(), conversations.list(userSession, Integer.MAX_VALUE, 50).items());
        var assigned = conversations.list(consultantSession, 0, 20);
        assertEquals(2, assigned.totalElements());
        assertTrue(assigned.items().contains(saved));
        assertTrue(assigned.items().stream().allMatch(room -> room.consultantId().equals(consultant.id())));
        var denied = assertThrows(ContractException.class, () -> conversations.detail(outsiderSession, id));
        var missing = assertThrows(ContractException.class, () -> conversations.detail(outsiderSession, UUID.randomUUID()));
        assertEquals("NOT_FOUND", denied.code());
        assertEquals(missing.code(), denied.code());
        assertEquals(missing.getMessage(), denied.getMessage());
    }

    @Test
    void rejectedCreatesLeaveNoRoomAndReadsCheckCurrentEligibility() {
        Account user = account("USER");
        Account admin = account("ADMIN");
        Account consultant = approvedConsultant(admin);
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        assertChatFailure("FORBIDDEN", () -> conversations.create(consultantSession, consultant.id()));
        assertChatFailure("NOT_FOUND", () -> conversations.create(userSession, UUID.randomUUID()));
        var noCsrf = request(user, AccountAuthService.Realm.CUSTOMER);
        noCsrf.removeHeader("X-CSRF-Token");
        assertChatFailure("CSRF_REJECTED", () -> conversations.create(noCsrf, consultant.id()));
        assertChatFailure("INVALID_SESSION", () -> conversations.list(new MockHttpServletRequest(), 0, 20));
        assertChatFailure("INVALID_INPUT", () -> conversations.list(userSession, 0, 51));

        var room = conversations.create(userSession, consultant.id());
        db.update("UPDATE consultant_profiles SET review_status = 'REJECTED', rejection_reason = 'Test' WHERE account_id = ?",
                consultant.id());
        assertChatFailure("NOT_FOUND", () -> conversations.create(userSession, consultant.id()));
        assertChatFailure("FORBIDDEN", () -> conversations.list(consultantSession, 0, 20));
        assertChatFailure("FORBIDDEN", () -> conversations.detail(consultantSession, room.conversationId()));
        assertEquals(room, conversations.detail(userSession, room.conversationId()));
        assertEquals(List.of(room), conversations.list(userSession, 0, 20).items());
    }

    @Test
    void onlyTheTwoAssignedParticipantsSeeTheRoom() {
        Account user = account("USER");
        Account otherUser = account("USER");
        Account admin = account("ADMIN");
        Account consultant = approvedConsultant(admin);
        Account otherConsultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        UUID otherRoom = room(otherUser.id(), otherConsultant.id());

        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        assertEquals(user.id(), access.requireParticipant(userSession, room).accountId());
        assertEquals(consultant.id(), access.requireParticipant(consultantSession, room).accountId());
        assertEquals(otherUser.id(),
                access.requireParticipant(request(otherUser, AccountAuthService.Realm.CUSTOMER), otherRoom).accountId());

        String unknown = deny("NOT_FOUND", userSession, UUID.randomUUID()).getMessage();
        assertEquals(unknown, deny("NOT_FOUND", userSession, otherRoom).getMessage());
        assertEquals(unknown, deny("NOT_FOUND", consultantSession, otherRoom).getMessage());
        deny("INVALID_SESSION", request(admin, AccountAuthService.Realm.ADMIN), room);
        var guest = new MockHttpServletRequest();
        guest.setCookies(new Cookie("huyenco_session", "a".repeat(43)));
        deny("INVALID_SESSION", guest, room);
        userSession.removeHeader("Origin");
        userSession.addHeader("Origin", "https://invalid.example");
        deny("CSRF_REJECTED", userSession, room);
    }

    @Test
    void checksCurrentAccountRoleEligibilityAndRevocationForExistingRooms() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);

        db.update("""
                UPDATE consultant_profiles SET review_status = 'REJECTED', rejection_reason = 'Test'
                WHERE account_id = ?
                """, consultant.id());
        deny("FORBIDDEN", consultantSession, room);
        assertEquals(user.id(), access.requireParticipant(userSession, room).accountId());
        db.update("UPDATE accounts SET role = 'USER' WHERE id = ?", consultant.id());
        deny("NOT_FOUND", consultantSession, room);
        db.update("UPDATE accounts SET status = 'LOCKED' WHERE id = ?", user.id());
        deny("INVALID_SESSION", userSession, room);
        db.update("UPDATE accounts SET status = 'ACTIVE' WHERE id = ?", user.id());
        db.update("UPDATE account_sessions SET revoked_at = clock_timestamp() WHERE account_id = ?", user.id());
        deny("INVALID_SESSION", userSession, room);
        assertEquals(1, db.queryForObject("SELECT count(*) FROM chat_conversations WHERE id = ?", Integer.class, room));
    }

    @Test
    void schemaRejectsMissingReferencesSelfAssignmentAndDeletionOfParticipants() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        Account noProfile = account("CONSULTANT");
        room(user.id(), consultant.id());

        rejectsWrite(() -> room(UUID.randomUUID(), consultant.id()));
        rejectsWrite(() -> room(user.id(), noProfile.id()));
        rejectsWrite(() -> room(consultant.id(), consultant.id()));
        rejectsWrite(() -> db.update("DELETE FROM accounts WHERE id = ?", user.id()));
        rejectsWrite(() -> db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id()));
    }

    @Test
    void lifecycleEnforcesRoleStateAndWriteGuards() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account outsider = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        rejectTransition("FORBIDDEN", userSession, room, Action.ACCEPT);
        rejectTransition("FORBIDDEN", consultantSession, room, Action.CANCEL);
        rejectTransition("INVALID_TRANSITION", userSession, room, Action.END);
        rejectTransition("NOT_FOUND", request(outsider, AccountAuthService.Realm.CUSTOMER), room, Action.END);
        var badCsrf = request(consultant, AccountAuthService.Realm.CUSTOMER);
        badCsrf.removeHeader("X-CSRF-Token");
        rejectTransition("CSRF_REJECTED", badCsrf, room, Action.ACCEPT);
        var badMarker = request(consultant, AccountAuthService.Realm.CUSTOMER);
        badMarker.removeHeader("X-HuyenCo-Request");
        rejectTransition("CSRF_REJECTED", badMarker, room, Action.ACCEPT);

        var active = lifecycle.transition(consultantSession, room, Action.ACCEPT);
        assertEquals(Status.ACTIVE, active.status());
        assertEquals(active, lifecycle.transition(consultantSession, room, Action.ACCEPT));
        rejectTransition("INVALID_TRANSITION", consultantSession, room, Action.DECLINE);
        var ended = lifecycle.transition(userSession, room, Action.END);
        assertEquals(Status.ENDED, ended.status());
        assertEquals(EndReason.COMPLETED, ended.endReason());
        assertEquals(user.id(), ended.endedByAccountId());
        assertEquals(active.startedAt(), ended.startedAt());
        assertTrue(!ended.endedAt().isBefore(ended.startedAt()));
        assertEquals(ended, lifecycle.transition(userSession, room, Action.END));
        rejectTransition("INVALID_TRANSITION", consultantSession, room, Action.END);
        rejectTransition("INVALID_TRANSITION", consultantSession, room, Action.ACCEPT);
        assertEquals(user.id(), access.requireParticipant(userSession, room).accountId());
    }

    @Test
    void pendingRoomCanBeDeclinedOrCancelledAndDatabaseRejectsInvalidMetadata() {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
        var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
        UUID declinedRoom = room(user.id(), consultant.id());
        UUID cancelledRoom = room(user.id(), consultant.id());
        assertEquals("PENDING", db.queryForObject("SELECT status FROM chat_conversations WHERE id = ?",
                String.class, declinedRoom));
        rejectsWrite(() -> db.update("UPDATE chat_conversations SET status = 'ACTIVE' WHERE id = ?", declinedRoom));
        rejectsWrite(() -> db.update("""
                UPDATE chat_conversations SET status = 'ENDED', ended_at = clock_timestamp(),
                    end_reason = 'DECLINED', ended_by_account_id = ? WHERE id = ?
                """, user.id(), declinedRoom));
        rejectsWrite(() -> db.update("""
                UPDATE chat_conversations SET status = 'ENDED', ended_at = clock_timestamp(),
                    ended_by_account_id = ? WHERE id = ?
                """, consultant.id(), declinedRoom));
        var declined = lifecycle.transition(consultantSession, declinedRoom, Action.DECLINE);
        assertEquals(EndReason.DECLINED, declined.endReason());
        assertNull(declined.startedAt());
        assertEquals(declined, lifecycle.transition(consultantSession, declinedRoom, Action.DECLINE));
        rejectTransition("INVALID_TRANSITION", userSession, declinedRoom, Action.CANCEL);

        var cancelled = lifecycle.transition(userSession, cancelledRoom, Action.CANCEL);
        assertEquals(EndReason.CANCELLED, cancelled.endReason());
        assertEquals(user.id(), cancelled.endedByAccountId());
        assertEquals(cancelled, lifecycle.transition(userSession, cancelledRoom, Action.CANCEL));
        rejectTransition("INVALID_TRANSITION", consultantSession, cancelledRoom, Action.ACCEPT);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentAcceptAndCancelCommitExactlyOneTransition() throws Exception {
        Account admin = account("ADMIN");
        Account user = account("USER");
        Account consultant = approvedConsultant(admin);
        UUID room = room(user.id(), consultant.id());
        var workers = Executors.newFixedThreadPool(2);
        try {
            var userSession = request(user, AccountAuthService.Realm.CUSTOMER);
            var consultantSession = request(consultant, AccountAuthService.Realm.CUSTOMER);
            var start = new CyclicBarrier(2);
            var accept = workers.submit(() -> race(start, consultantSession, room, Action.ACCEPT));
            var cancel = workers.submit(() -> race(start, userSession, room, Action.CANCEL));
            String accepted = accept.get(10, TimeUnit.SECONDS);
            String cancelled = cancel.get(10, TimeUnit.SECONDS);
            assertTrue(accepted.equals("ACTIVE") && cancelled.equals("INVALID_TRANSITION")
                    || accepted.equals("INVALID_TRANSITION") && cancelled.equals("ENDED"));
            assertEquals(accepted.equals("ACTIVE") ? "ACTIVE" : "ENDED",
                    db.queryForObject("SELECT status FROM chat_conversations WHERE id = ?", String.class, room));
        } finally {
            workers.shutdownNow();
            workers.awaitTermination(10, TimeUnit.SECONDS);
            db.update("DELETE FROM chat_conversations WHERE id = ?", room);
            db.update("DELETE FROM consultant_profiles WHERE account_id = ?", consultant.id());
            db.update("DELETE FROM accounts WHERE id IN (?, ?, ?)", user.id(), consultant.id(), admin.id());
        }
    }

    private String race(CyclicBarrier start, MockHttpServletRequest request, UUID room, Action action) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        try {
            return lifecycle.transition(request, room, action).status().name();
        } catch (ContractException failure) {
            return failure.code();
        }
    }

    private void rejectTransition(String code, MockHttpServletRequest request, UUID room, Action action) {
        assertEquals(code, assertThrows(ContractException.class, () -> lifecycle.transition(request, room, action)).code());
    }

    private void assertChatFailure(String code, Runnable action) {
        assertEquals(code, assertThrows(ContractException.class, action::run).code());
    }

    private void rejectsWrite(Runnable write) {
        var nested = new TransactionTemplate(transactions);
        nested.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
        assertThrows(DataIntegrityViolationException.class, () -> nested.executeWithoutResult(tx -> write.run()));
    }

    private ContractException deny(String code, MockHttpServletRequest request, UUID room) {
        var failure = assertThrows(ContractException.class, () -> access.requireParticipant(request, room));
        assertEquals(code, failure.code());
        return failure;
    }

    private Account approvedConsultant(Account admin) {
        Account consultant = account("CONSULTANT");
        db.update("""
                INSERT INTO consultant_profiles(account_id, review_status, reviewed_by, reviewed_at)
                VALUES (?, 'APPROVED', ?, CURRENT_TIMESTAMP)
                """, consultant.id(), admin.id());
        return consultant;
    }

    private Account account(String role) {
        String identifier = "room-test-" + UUID.randomUUID();
        UUID id = accounts.register("Chat room TEST", identifier, password, null).account().id();
        db.update("UPDATE accounts SET role = ? WHERE id = ?", role, id);
        return new Account(id, identifier);
    }

    private MockHttpServletRequest request(Account account, AccountAuthService.Realm realm) {
        var issued = accounts.login(realm, account.identifier(), password, null);
        var request = new MockHttpServletRequest();
        request.addHeader("Origin", "http://127.0.0.1:3173");
        request.addHeader("X-HuyenCo-Request", "1");
        request.addHeader("X-CSRF-Token", issued.session().csrfToken());
        request.setCookies(new Cookie(realm.cookie, issued.token()));
        return request;
    }

    private UUID room(UUID userId, UUID consultantId) {
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO chat_conversations(id, user_account_id, consultant_account_id) VALUES (?, ?, ?)",
                id, userId, consultantId);
        return id;
    }

    private record Account(UUID id, String identifier) {}
}
