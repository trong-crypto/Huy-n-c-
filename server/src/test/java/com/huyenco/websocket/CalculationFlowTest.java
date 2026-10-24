package com.huyenco.websocket;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.*;
import com.huyenco.maihoa.MaiHoaService;
import com.huyenco.tamthe.TamTheService;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.MessageBuilder;

class CalculationFlowTest {
    static final ObjectMapper MAPPER = new ObjectMapper();
    static final String ID = "550e8400-e29b-41d4-a716-446655440002";
    static final String REQUEST = """
        {"requestId":"550e8400-e29b-41d4-a716-446655440002","type":"MAI_HOA",
         "payload":{"method":"LINES","linesBottomUp":[true,false,true,false,true,false],"movingLine":2}}
        """;

    static class Capture implements MessageChannel {
        final List<Message<?>> frames = new CopyOnWriteArrayList<>();
        final CountDownLatch timeout = new CountDownLatch(1);
        public boolean send(Message<?> message) { return send(message, -1); }
        public boolean send(Message<?> message, long wait) {
            frames.add(message);
            if (message.getPayload() instanceof ApiResponse response && response.error() != null
                    && "PROCESSING_TIMEOUT".equals(response.error().code())) timeout.countDown();
            return true;
        }
        List<ProgressEvent> progress() { return frames.stream().map(Message::getPayload)
                .filter(ProgressEvent.class::isInstance).map(ProgressEvent.class::cast).toList(); }
        List<ApiResponse> terminal() { return frames.stream().map(Message::getPayload)
                .filter(ApiResponse.class::isInstance).map(ApiResponse.class::cast).toList(); }
    }

    static MaiHoaResult result() throws Exception {
        return MAPPER.treeToValue(MAPPER.readTree(Path.of("../docs/examples/mai-hoa-lines.response.json").toFile()).get("data"), MaiHoaResult.class);
    }

    static MaiHoaService service(BiFunction<JsonNode, CalculationProgress, MaiHoaResult> action) {
        return new MaiHoaService(null, List::of) {
            @Override public MaiHoaResult calculate(JsonNode payload, CalculationProgress progress) {
                return action.apply(payload, progress);
            }
        };
    }

    static Message<byte[]> request(String json) {
        return MessageBuilder.withPayload(json.getBytes(StandardCharsets.UTF_8)).build();
    }

    @Test
    void successfulRequestPublishesFourOrderedStagesThenOneTerminalOnOwnSession() throws Exception {
        var capture = new Capture(); var output = result();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 60000, 10, 10, 2)) {
            sessions.connect("A");
            var service = service((payload, progress) -> {
                progress.report(ProgressEvent.Step.CALCULATING, "Computing");
                progress.report(ProgressEvent.Step.LOOKUP, "Reading");
                return output;
            });
            new CalculationController(sessions, MAPPER, service, new TamTheService()).calculateMaiHoa(request(REQUEST), "A");
            assertEquals(List.of(1,2,3,4), capture.progress().stream().map(ProgressEvent::sequence).toList());
            assertEquals(List.of(ProgressEvent.Step.ACCEPTED, ProgressEvent.Step.VALIDATING,
                    ProgressEvent.Step.CALCULATING, ProgressEvent.Step.LOOKUP), capture.progress().stream().map(ProgressEvent::step).toList());
            assertEquals(1, capture.terminal().size());
            assertEquals("COMPLETED", capture.terminal().get(0).status());
            assertTrue(capture.frames.stream().allMatch(m -> "A".equals(m.getHeaders().get("simpSessionId"))));
            assertTrue(capture.frames.get(4).getHeaders().get("simpDestination").toString().endsWith("/queue/results"));
            assertEquals(0, sessions.activeCount());
            assertEquals(0, sessions.deadlineCount());
        }
    }

    @Test
    void malformedDuplicateTrailingAndInvalidUtf8JsonAreSafeAndNextRequestStillWorks() throws Exception {
        var capture = new Capture(); var output = result();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 60000, 10, 10, 2)) {
            sessions.connect("A");
            var controller = new CalculationController(sessions, MAPPER, service((p,g) -> output), new TamTheService());
            for (String json : List.of("{", REQUEST + " {}", "{\"requestId\":\"a\",\"requestId\":\"b\"}"))
                controller.calculateMaiHoa(request(json), "A");
            controller.calculateMaiHoa(MessageBuilder.withPayload(new byte[]{(byte)0xff}).build(), "A");
            controller.calculateMaiHoa(MessageBuilder.withPayload(REQUEST.getBytes(StandardCharsets.UTF_16)).build(), "A");
            assertEquals(5, capture.terminal().size());
            assertTrue(capture.progress().isEmpty());
            assertTrue(capture.terminal().stream().allMatch(r -> r.requestId() == null
                    && "INVALID_INPUT".equals(r.error().code()) && r.data() == null));
            controller.calculateMaiHoa(request(REQUEST), "A");
            assertEquals("COMPLETED", capture.terminal().get(5).status());
            assertEquals(0, sessions.activeCount());
        }
    }

    @Test
    void invalidPayloadOnlyReportsReceivedAndValidating() {
        var capture = new Capture();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 60000, 10, 10, 2)) {
            sessions.connect("A");
            var controller = new CalculationController(sessions, MAPPER,
                    service((p,g) -> { fail("Must not calculate invalid input"); return null; }), new TamTheService());
            controller.calculateMaiHoa(request(REQUEST.replace(":2", ":7")), "A");
            assertEquals(2, capture.progress().size());
            assertEquals("INVALID_INPUT", capture.terminal().get(0).error().code());
            assertEquals(0, sessions.deadlineCount());
        }
    }

    @Test
    void timeoutEndsSlowWorkOnceAndSuppressesItsLateResult() throws Exception {
        var capture = new Capture(); var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var executor = Executors.newSingleThreadExecutor();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 100, 10, 10, 2)) {
            sessions.connect("A");
            var controller = new CalculationController(sessions, MAPPER, service((p,g) -> {
                entered.countDown();
                try { assertTrue(release.await(3, TimeUnit.SECONDS)); }
                catch (InterruptedException error) { throw new RuntimeException(error); }
                return null; // A late success must not be sent, even if the worker ignores cancellation.
            }), new TamTheService());
            var future = executor.submit(() -> controller.calculateMaiHoa(request(REQUEST), "A"));
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            assertTrue(capture.timeout.await(2, TimeUnit.SECONDS));
            release.countDown(); future.get(2, TimeUnit.SECONDS);
            assertEquals(1, capture.terminal().size());
            assertEquals("PROCESSING_TIMEOUT", capture.terminal().get(0).error().code());
            assertEquals(0, sessions.activeCount());
            assertEquals(0, sessions.deadlineCount());
        } finally { release.countDown(); executor.shutdownNow(); }
    }

    @Test
    void disconnectDiscardsLateWorkAndDoesNotRecreateSession() throws Exception {
        var capture = new Capture(); var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var executor = Executors.newSingleThreadExecutor();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 60000, 10, 10, 2)) {
            sessions.connect("A");
            var controller = new CalculationController(sessions, MAPPER, service((p,g) -> {
                entered.countDown();
                try { assertTrue(release.await(3, TimeUnit.SECONDS)); }
                catch (InterruptedException error) { throw new RuntimeException(error); }
                g.report(ProgressEvent.Step.LOOKUP, "Late progress");
                return null;
            }), new TamTheService());
            var future = executor.submit(() -> controller.calculateMaiHoa(request(REQUEST), "A"));
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            sessions.disconnect("A"); release.countDown(); future.get(2, TimeUnit.SECONDS);
            assertTrue(capture.terminal().isEmpty());
            assertEquals(2, capture.progress().size());
            assertNull(sessions.start("A", ID, "MAI_HOA"));
            assertEquals(0, sessions.activeCount());
            assertEquals(0, sessions.sessionCount());
            assertEquals(0, sessions.deadlineCount());
        } finally { release.countDown(); executor.shutdownNow(); }
    }

    @Test
    void sessionAndActiveLimitsAreFiniteAndFinishingReleasesCapacity() {
        var capture = new Capture();
        try (var sessions = new CalculationSessions(new SimpMessagingTemplate(capture), 60000, 2, 1, 1)) {
            assertTrue(sessions.connect("A")); assertTrue(sessions.connect("B")); assertFalse(sessions.connect("C"));
            var first = sessions.start("A", ID, "MAI_HOA");
            assertThrows(CalculationSessions.Busy.class, () -> sessions.start("B", ID, "MAI_HOA"));
            first.complete("done"); first.fail("INTERNAL_ERROR", "late error");
            assertEquals(1, capture.terminal().size());
            var second = sessions.start("B", ID, "MAI_HOA"); second.cancel();
            assertEquals(0, sessions.activeCount());
        }
    }
}
