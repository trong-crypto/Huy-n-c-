package com.huyenco.admin;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;

final class AdminDirectoryHttp {
    private AdminDirectoryHttp() {}

    static UUID actor(Optional<AdminRequestAccess> access, HttpServletRequest request, boolean write) {
        return access.orElseThrow(() -> new ContractException("INVALID_SESSION", "Cần phiên quản trị hợp lệ."))
                .require(request, write);
    }

    static ObjectReader reader(ObjectMapper mapper) {
        return mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    static JsonNode body(HttpServletRequest request, ObjectReader reader, int maxBody) {
        try {
            if (request.getContentType() == null) throw invalid();
            MediaType type = MediaType.parseMediaType(request.getContentType());
            if (!"application".equalsIgnoreCase(type.getType()) || !"json".equalsIgnoreCase(type.getSubtype())
                    || type.getCharset() != null && !StandardCharsets.UTF_8.equals(type.getCharset())) throw invalid();
            byte[] bytes = request.getInputStream().readNBytes(maxBody + 1);
            if (bytes.length == 0 || bytes.length > maxBody) throw invalid();
            JsonNode body = reader.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
            if (body == null || !body.isObject()) throw invalid();
            return body;
        } catch (IOException | IllegalArgumentException failure) {
            throw invalid();
        }
    }

    static UUID uuid(String value) {
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) throw invalid();
            return id;
        } catch (IllegalArgumentException failure) { throw invalid(); }
    }

    static int expectedVersion(JsonNode body) {
        JsonNode version = body.path("expectedVersion");
        if (!version.isIntegralNumber() || !version.canConvertToInt() || version.intValue() < 1) throw invalid();
        return version.intValue();
    }

    static <T extends Enum<T>> T option(Class<T> type, String value) {
        if (value == null) return null;
        try { return Enum.valueOf(type, value); }
        catch (IllegalArgumentException failure) { throw invalid(); }
    }

    static int number(String value, int fallback, int minimum, int maximum) {
        if (value == null) return fallback;
        if (!value.matches("[0-9]{1,10}")) throw invalid();
        try {
            int number = Integer.parseInt(value);
            if (number < minimum || number > maximum) throw invalid();
            return number;
        } catch (NumberFormatException failure) { throw invalid(); }
    }

    static void query(HttpServletRequest request, Set<String> allowed) {
        request.getParameterMap().forEach((key, values) -> {
            if (!allowed.contains(key) || values.length != 1) throw invalid();
        });
    }

    static ResponseEntity<Envelope> respond(Logger log, int successStatus, Supplier<Object> action) {
        String requestId = UUID.randomUUID().toString();
        try {
            return response(successStatus, new Envelope(requestId, "COMPLETED", action.get(), null));
        } catch (ContractException failure) {
            int status = switch (failure.code()) {
                case "INVALID_SESSION" -> 401;
                case "CSRF_REJECTED", "FORBIDDEN" -> 403;
                case "NOT_FOUND" -> 404;
                case "VERSION_CONFLICT", "INVALID_TRANSITION", "ACCOUNT_LOCKED", "CONSULTANT_APPROVAL_REQUIRED", "PROFILE_EXISTS" -> 409;
                default -> 400;
            };
            return failed(status, requestId, failure.code(), failure.getMessage());
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            log.warn("Admin directory DATABASE_UNAVAILABLE requestId={}", requestId);
            return failed(503, requestId, "DATABASE_UNAVAILABLE", "Kho dữ liệu quản trị tạm thời không khả dụng.");
        } catch (RuntimeException failure) {
            log.warn("Admin directory INTERNAL_ERROR requestId={}", requestId);
            return failed(500, requestId, "INTERNAL_ERROR", "Không thể xử lý yêu cầu quản trị.");
        }
    }

    private static ResponseEntity<Envelope> failed(int status, String id, String code, String message) {
        return response(status, new Envelope(id, "FAILED", null, new ApiError(code, message, null, null)));
    }

    private static ResponseEntity<Envelope> response(int status, Envelope envelope) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(envelope);
    }

    static ContractException invalid() { return new ContractException("INVALID_INPUT", "Dữ liệu yêu cầu không hợp lệ."); }
    record Envelope(String requestId, String status, Object data, ApiError error) {}
}
