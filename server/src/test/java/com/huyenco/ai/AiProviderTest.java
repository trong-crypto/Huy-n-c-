package com.huyenco.ai;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.exception.ContractException;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class AiProviderTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AiConsultationService.Prompt prompt = new AiConsultationService.Prompt("Hào động là gì?", List.of(), null);

    @Test
    void usesVietnameseDemoWithoutProviderConfiguration() {
        var provider = new AiProvider(mapper, "demo", "", "", "", "max_completion_tokens", 12, 1000);
        assertEquals("demo", provider.mode());
        assertTrue(provider.answer(prompt).contains("DEMO"));
        var incomplete = new AiProvider(mapper, "openai-compatible", "https://provider.invalid/chat", "model", "",
                "max_completion_tokens", 12, 1000);
        assertEquals("off", incomplete.mode());
        assertEquals("AI_UNAVAILABLE", assertThrows(ContractException.class, () -> incomplete.answer(prompt)).code());
    }

    @Test
    void sendsCompatibleJsonToLoopbackStubAndReturnsOnlyAssistantText() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var body = new AtomicReference<String>();
        var auth = new AtomicReference<String>();
        var cookie = new AtomicReference<String>();
        server.createContext("/chat/completions", request -> {
            try (request) {
                auth.set(request.getRequestHeaders().getFirst("Authorization"));
                cookie.set(request.getRequestHeaders().getFirst("Cookie"));
                body.set(new String(request.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                byte[] response = """
                        {"choices":[{"message":{"content":"Đây là câu trả lời từ stub."}}],
                         "sources":[{"title":"Không được sử dụng nguồn do stub tự khai."}]}
                        """.getBytes(StandardCharsets.UTF_8);
                request.sendResponseHeaders(200, response.length);
                request.getResponseBody().write(response);
            }
        });
        server.start();
        try {
            var provider = new AiProvider(mapper, "openai-compatible",
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/chat/completions", "fixture-model", "fixture-key",
                    "max_tokens", 40, 280);
            assertEquals("live", provider.mode());
            assertEquals("Đây là câu trả lời từ stub.", provider.answer(prompt));
            assertEquals("Bearer fixture-key", auth.get());
            assertNull(cookie.get());
            var json = mapper.readTree(body.get());
            assertEquals("fixture-model", json.path("model").asText());
            assertEquals(280, json.path("max_tokens").asInt());
            assertFalse(json.has("max_completion_tokens"));
            assertEquals("system", json.path("messages").path(0).path("role").asText());
            assertTrue(json.path("messages").path(0).path("content").asText().contains("Không bịa"));
            assertEquals("user", json.path("messages").path(1).path("role").asText());
            assertEquals("Hào động là gì?", json.path("messages").path(1).path("content").asText());
            assertFalse(body.get().contains("fixture-key"));

            var can = new AiConsultationService.Hexagram("H_CAN_CAN", "Càn", "VERIFIED");
            var other = new AiConsultationService.Hexagram("H_CAN_TON", "Cấu", "VERIFIED");
            var facts = new AiConsultationService.ReadingFacts("LINES", can, can, other, 1, "VERIFIED", "");
            var reading = new AiConsultationService.Reading(facts, "", List.of("PRIVATE_CALCULATION_PASSAGE"), List.of(),
                    List.of(new AiConsultationService.Source("Chu Dịch", "乾", "", null, "https://example.org/can")),
                    List.of(new AiConsultationService.LibraryExcerpt("Quẻ chủ", "H_CAN_CAN", "Tổng quan đã duyệt", "Rồng còn ẩn")));
            provider.answer(new AiConsultationService.Prompt("Nguồn nào?", List.of(), reading));
            var grounded = mapper.readTree(body.get()).path("messages");
            assertEquals("Nguồn nào?", grounded.path(1).path("content").asText());
            var context = grounded.path(0).path("content").asText();
            assertTrue(context.contains("Quẻ chủ: Càn"));
            assertTrue(context.contains("NGUỒN ĐỐI CHIẾU DO SERVER HIỂN THỊ\nChu Dịch"));
            assertTrue(context.contains("Đoạn giải hào động 1 của quẻ chủ: Rồng còn ẩn"));
            assertFalse(context.contains("PRIVATE_CALCULATION_PASSAGE") || context.contains("https://example.org/can"));
        } finally {
            server.stop(0);
        }
    }
}
