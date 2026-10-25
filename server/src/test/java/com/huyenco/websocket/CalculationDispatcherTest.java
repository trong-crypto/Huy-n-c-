package com.huyenco.websocket;

import static org.junit.jupiter.api.Assertions.*;

import com.huyenco.common.dto.ApiResponse;
import com.huyenco.common.dto.MaiHoaResult;
import java.util.HashSet;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class CalculationDispatcherTest {
    static final String ID = CalculationFlowTest.ID;
    static final String REQUEST = CalculationFlowTest.REQUEST;

    private static void await(BooleanSupplier condition) throws InterruptedException {
        long limit = System.nanoTime() + TimeUnit.SECONDS.toNanos(4);
        while (!condition.getAsBoolean() && System.nanoTime() < limit) Thread.sleep(10);
        assertTrue(condition.getAsBoolean(), "Condition not reached");
    }

    private static CalculationController controller(CalculationSessions sessions,
            CalculationDispatcher dispatcher, java.util.function.BiFunction<com.fasterxml.jackson.databind.JsonNode,
            com.huyenco.common.dto.CalculationProgress, MaiHoaResult> action) {
        return new CalculationController(sessions, CalculationFlowTest.MAPPER,
                CalculationFlowTest.service(action), CalculationFlowTest.unusedTamThe(), dispatcher);
    }

    @Test
    void duplicateInFlightSharesOneJobAndTerminalReplaysWithinTtlButConflictFails() throws Exception {
        var capture = new CalculationFlowTest.Capture();
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var calculations = new AtomicInteger();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 10000, 10, 10, 5);
             var dispatcher = new CalculationDispatcher(sessions, "bounded", 1, 2, 1, 10)) {
            sessions.connect("A");
            var app = controller(sessions, dispatcher, (payload, progress) -> {
                calculations.incrementAndGet(); entered.countDown();
                try { assertTrue(release.await(3, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                try { return CalculationFlowTest.result(); }
                catch (Exception e) { throw new RuntimeException(e); }
            });
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "A");
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            // Same JSON object with a different property order must match the in-flight ID.
            String reordered = "{\"type\":\"MAI_HOA\",\"payload\":{\"movingLine\":2,\"linesBottomUp\":[true,false,true,false,true,false],\"method\":\"LINES\"},\"requestId\":\""+ID+"\"}";
            app.calculateMaiHoa(CalculationFlowTest.request(reordered), "A");
            assertEquals(1, calculations.get());
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST.replace("\"movingLine\":2", "\"movingLine\":3")), "A");
            assertEquals("INVALID_INPUT", capture.terminal().get(0).error().code());
            release.countDown();
            await(() -> capture.terminal().size() == 2);
            assertEquals("COMPLETED", capture.terminal().get(1).status());
            app.calculateMaiHoa(CalculationFlowTest.request(reordered), "A");
            await(() -> capture.terminal().size() == 3);
            assertEquals("COMPLETED", capture.terminal().get(2).status());
            assertEquals(1, calculations.get());
            assertEquals(1, dispatcher.registrySize());
            Thread.sleep(1100);
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "A");
            await(() -> calculations.get() == 2 && capture.terminal().size() == 4);
            assertEquals(0, sessions.activeCount());
        } finally { release.countDown(); }
    }

    @Test
    void finiteQueueRejectsOverloadAndDisconnectDropsWaitingJob() throws Exception {
        var capture = new CalculationFlowTest.Capture();
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 10000, 10, 10, 3);
             var dispatcher = new CalculationDispatcher(sessions, "bounded", 1, 1, 60, 10)) {
            for (String id : new String[]{"A", "B", "C", "D"}) sessions.connect(id);
            var app = controller(sessions, dispatcher, (p, g) -> {
                if (calls.incrementAndGet() == 1) {
                    entered.countDown();
                    try { release.await(3, TimeUnit.SECONDS); }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                }
                try { return CalculationFlowTest.result(); }
                catch (Exception e) { throw new RuntimeException(e); }
            });
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "A");
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "B");
            assertEquals(1, dispatcher.queueSize());
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "C");
            await(() -> !capture.terminal().isEmpty());
            assertEquals("SERVER_BUSY", capture.terminal().get(0).error().code());
            assertEquals(2, dispatcher.registrySize()); // Rejected admission is never cached.
            sessions.disconnect("B");
            await(() -> dispatcher.queueSize() == 0);
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "D");
            assertEquals(1, dispatcher.queueSize());
            release.countDown();
            await(() -> capture.terminal().size() == 3);
            assertEquals(2, calls.get()); // B did not run, C was rejected, A/D ran.
            assertTrue(capture.terminal().stream().filter(r -> "COMPLETED".equals(r.status())).count() == 2);
            assertEquals(0, sessions.activeCount());
        } finally { release.countDown(); }
    }

    @Test
    void registryPressureDoesNotEvictRunningOrCompletedIdsWithinTtl() throws Exception {
        var capture = new CalculationFlowTest.Capture();
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 10000, 10, 10, 3);
             var dispatcher = new CalculationDispatcher(sessions, "bounded", 1, 2, 60, 1)) {
            sessions.connect("A");
            var app = controller(sessions, dispatcher, (p, g) -> {
                calls.incrementAndGet(); entered.countDown();
                try { release.await(3, TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                try { return CalculationFlowTest.result(); }
                catch (Exception e) { throw new RuntimeException(e); }
            });
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "A");
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            String other = REQUEST.replace(ID, UUID.randomUUID().toString());
            app.calculateMaiHoa(CalculationFlowTest.request(other), "A");
            await(() -> capture.terminal().size() == 1);
            assertEquals("SERVER_BUSY", capture.terminal().get(0).error().code());
            release.countDown();
            await(() -> capture.terminal().size() == 2);
            app.calculateMaiHoa(CalculationFlowTest.request(other), "A");
            await(() -> capture.terminal().size() == 3);
            assertEquals("SERVER_BUSY", capture.terminal().get(2).error().code());
            assertEquals(1, calls.get());
        } finally { release.countDown(); }
    }

    @Test
    void deadlineIncludesQueueWaitAndCancelledQueueItemNeverExecutes() throws Exception {
        var capture = new CalculationFlowTest.Capture();
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 200, 10, 10, 2);
             var dispatcher = new CalculationDispatcher(sessions, "bounded", 1, 1, 60, 10)) {
            sessions.connect("A"); sessions.connect("B");
            var app = controller(sessions, dispatcher, (p, g) -> {
                calls.incrementAndGet(); entered.countDown();
                // Emulate a slow dependency which does not immediately honor interruption.
                boolean released = false;
                while (!released) {
                    try { released = release.await(100, TimeUnit.MILLISECONDS); }
                    catch (InterruptedException ignored) { }
                }
                return null;
            });
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "A");
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), "B");
            assertEquals(1, dispatcher.queueSize());
            await(() -> capture.terminal().size() == 2);
            assertEquals(2, capture.terminal().stream()
                    .filter(r -> r.error() != null && "PROCESSING_TIMEOUT".equals(r.error().code())).count());
            assertEquals(0, dispatcher.queueSize());
            assertEquals(1, calls.get());
            release.countDown();
            await(() -> sessions.activeCount() == 0);
            assertEquals(2, dispatcher.registrySize()); // Timeout replies remain replayable during TTL.
        } finally { release.countDown(); }
    }

    @Test
    void twentyConcurrentSessionsWithSameIdHaveIndependentResultsAndNoCrossSessionEvents() throws Exception {
        var capture = new CalculationFlowTest.Capture();
        var calls = new AtomicInteger();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 10000, 30, 30, 3);
             var dispatcher = new CalculationDispatcher(sessions, "bounded", 4, 100, 60, 100)) {
            var app = controller(sessions, dispatcher, (p, g) -> {
                calls.incrementAndGet();
                try { return CalculationFlowTest.result(); }
                catch (Exception e) { throw new RuntimeException(e); }
            });
            for (int i = 0; i < 20; i++) {
                String sessionId = "S" + i;
                assertTrue(sessions.connect(sessionId));
                app.calculateMaiHoa(CalculationFlowTest.request(REQUEST), sessionId);
            }
            await(() -> capture.terminal().size() == 20);
            assertEquals(20, calls.get());
            assertEquals(20, new HashSet<>(capture.frames.stream()
                    .filter(m -> m.getPayload() instanceof ApiResponse)
                    .map(m -> (String) m.getHeaders().get("simpSessionId")).toList()).size());
            assertEquals(20, capture.terminal().stream().filter(r -> "COMPLETED".equals(r.status())).count());
            assertEquals(0, sessions.activeCount());
        }
    }
}
