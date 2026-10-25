package com.huyenco.calendar;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.knowledge.KnowledgeAccessException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {
    private final CalendarService service;
    private final ObjectReader reader;

    public CalendarController(CalendarService service, ObjectMapper mapper) {
        this.service = service;
        reader = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readerFor(JsonNode.class)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @PostMapping(value="/convert", consumes="application/json", produces="application/json")
    public ResponseEntity<RestResult> convert(@RequestBody(required=false) byte[] body) { return handle(body, false); }

    @PostMapping(value="/can-chi", consumes="application/json", produces="application/json")
    public ResponseEntity<RestResult> canChi(@RequestBody(required=false) byte[] body) { return handle(body, true); }

    private ResponseEntity<RestResult> handle(byte[] body, boolean canChi) {
        String requestId = UUID.randomUUID().toString();
        try {
            if (body == null || body.length > 16_000) throw CalendarInput.invalid();
            JsonNode json;
            try { json = reader.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(body)).toString()); }
            catch (IOException | RuntimeException failure) { throw CalendarInput.invalid(); }
            Object result;
            if (canChi) {
                CalendarInput.fields(json, Set.of("date", "time"));
                CalendarInput input = CalendarInput.parse(json.get("date"));
                LocalTime time = null;
                if (json.has("time")) {
                    if (!json.get("time").isTextual() || !json.get("time").textValue().matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]"))
                        throw new ContractException("INVALID_DATE", "time phải có dạng HH:mm từ 00:00 đến 23:59.");
                    time = LocalTime.parse(json.get("time").textValue());
                }
                result = service.canChi(input, time);
            } else result = service.convert(CalendarInput.parse(json));
            return ResponseEntity.ok(new RestResult(requestId, "COMPLETED", result, null));
        } catch (ContractException failure) {
            return failed(requestId, 400, new ApiError(failure.code(), failure.getMessage(), null, null));
        } catch (RuleNotAvailableException failure) {
            return failed(requestId, 422, new ApiError("RULE_NOT_AVAILABLE", failure.getMessage(), failure.ruleCode(), failure.reason().name()));
        } catch (KnowledgeAccessException failure) {
            return failed(requestId, 503, new ApiError("DATABASE_UNAVAILABLE", "Kho dữ liệu tạm thời không truy cập được.", null, null));
        } catch (RuntimeException failure) {
            return failed(requestId, 500, new ApiError("INTERNAL_ERROR", "Không thể xử lý yêu cầu lịch.", null, null));
        }
    }

    private static ResponseEntity<RestResult> failed(String id, int status, ApiError error) {
        return ResponseEntity.status(status).body(new RestResult(id, "FAILED", null, error));
    }

    public record RestResult(String requestId, String status, Object data, ApiError error) { }
}
