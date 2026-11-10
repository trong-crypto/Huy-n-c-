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
        var provider = new AiProvider(mapper, "demo", "", "", "");
        assertEquals("demo", provider.mode());
        assertTrue(provider.answer(prompt).contains("DEMO"));
        var incomplete = new AiProvider(mapper, "openai-compatible", "https://provider.invalid/chat", "model", "");
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
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/chat/completions", "fixture-model", "fixture-key");
            assertEquals("live", provider.mode());
            assertEquals("Đây là câu trả lời từ stub.", provider.answer(prompt));
            assertEquals("Bearer fixture-key", auth.get());
            assertNull(cookie.get());
            var json = mapper.readTree(body.get());
            assertEquals("fixture-model", json.path("model").asText());
            assertEquals("system", json.path("messages").path(0).path("role").asText());
            assertTrue(json.path("messages").path(0).path("content").asText().contains("Không bịa"));
            assertEquals("user", json.path("messages").path(1).path("role").asText());
            assertEquals("Hào động là gì?", mapper.readTree(json.path("messages").path(1).path("content").asText())
                    .path("question").asText());
            assertFalse(body.get().contains("fixture-key"));
        } finally {
            server.stop(0);
        }
    }
}
