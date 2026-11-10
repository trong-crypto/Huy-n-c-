package com.huyenco.ai;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AccountHistoryIdentity;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import com.huyenco.history.HistoryController.Envelope;
import com.huyenco.history.RequestGuards;
import com.huyenco.knowledge.KnowledgeAccessException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
@RequestMapping(value = "/api/v1/ai", produces = MediaType.APPLICATION_JSON_VALUE)
final class AiConsultationController {
    private static final int MAX_BODY = 32 * 1024;
    private final AccountHistoryIdentity identity;
    private final RequestGuards guards;
    private final AiConsultationService service;
    private final ObjectReader reader;

    AiConsultationController(AccountHistoryIdentity identity, RequestGuards guards, AiConsultationService service,
                             ObjectMapper mapper) {
        this.identity = identity;
        this.guards = guards;
        this.service = service;
        this.reader = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @GetMapping("/status")
    ResponseEntity<Envelope> status() {
        return completed(new Availability(service.mode()));
    }

    @PostMapping("/ask")
    ResponseEntity<Envelope> ask(HttpServletRequest request) {
        try {
            guards.mutation(request);
            var owner = identity.require(request, true).owner();
            JsonNode body = body(request);
            UUID readingId = id(body, "readingId"), requestId = id(body, "calculationRequestId");
            if (readingId != null && requestId != null) throw invalid();
            return completed(service.ask(owner, readingId, requestId, text(body.path("question"), 1000),
                    turns(body.path("turns"))));
        } catch (ContractException error) {
            int status = switch (error.code()) {
                case "LOGIN_REQUIRED", "INVALID_SESSION" -> 401;
                case "CSRF_REJECTED", "FORBIDDEN" -> 403;
                case "NOT_FOUND" -> 404;
                case "TOO_MANY_REQUESTS" -> 429;
                case "AI_UNAVAILABLE" -> 503;
                case "AI_TIMEOUT" -> 504;
                default -> 400;
            };
            return failed(status, error.code(), error.getMessage());
        } catch (KnowledgeAccessException error) {
            return failed(503, "DATABASE_UNAVAILABLE", "Không đọc được phiên hoặc kết quả đã lưu.");
        } catch (RuntimeException error) {
            return failed(500, "INTERNAL_ERROR", "Không xử lý được yêu cầu Trợ lý AI.");
        }
    }

    private JsonNode body(HttpServletRequest request) {
        try {
            if (request.getQueryString() != null || request.getContentType() == null
                    || !MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(request.getContentType()))) throw invalid();
            byte[] bytes = request.getInputStream().readNBytes(MAX_BODY + 1);
            if (bytes.length > MAX_BODY) throw invalid();
            var data = reader.<JsonNode>readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
            fields(data, Set.of("question", "readingId", "calculationRequestId", "turns"));
            return data;
        } catch (IOException | IllegalArgumentException error) {
            throw invalid();
        }
    }

    private static void fields(JsonNode data, Set<String> allowed) {
        if (data == null || !data.isObject()) throw invalid();
        data.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid(); });
    }

    private static String text(JsonNode value, int max) {
        if (!value.isTextual()) throw invalid();
        String text = value.textValue().strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > max
                || text.codePoints().anyMatch(c -> c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE
                    || Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) throw invalid();
        return text;
    }

    private static UUID id(JsonNode body, String key) {
        if (!body.has(key)) return null;
        String value = body.path(key).asText("");
        try {
            UUID id = UUID.fromString(value);
            if (id.toString().equalsIgnoreCase(value)) return id;
        } catch (IllegalArgumentException ignored) { }
        throw invalid();
    }

    private static List<AiConsultationService.Turn> turns(JsonNode value) {
        if (value.isMissingNode()) return List.of();
        if (!value.isArray() || value.size() > 3) throw invalid();
        var turns = new ArrayList<AiConsultationService.Turn>();
        for (JsonNode turn : value) {
            fields(turn, Set.of("question", "answer"));
            turns.add(new AiConsultationService.Turn(text(turn.path("question"), 1000), text(turn.path("answer"), 1200)));
        }
        return List.copyOf(turns);
    }

    private static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Câu hỏi hoặc tham chiếu kết quả không hợp lệ.");
    }

    private static ResponseEntity<Envelope> completed(Object data) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new Envelope(UUID.randomUUID().toString(), "COMPLETED", data, null));
    }

    private static ResponseEntity<Envelope> failed(int status, String code, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new Envelope(UUID.randomUUID().toString(), "FAILED", null, new ApiError(code, message, null, null)));
    }

    record Availability(String mode) {}
}
