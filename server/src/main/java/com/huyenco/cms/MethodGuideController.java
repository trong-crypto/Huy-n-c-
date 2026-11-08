package com.huyenco.cms;

import static com.huyenco.common.validation.CmsInput.expectedVersion;
import static com.huyenco.common.validation.CmsInput.invalid;
import static com.huyenco.common.validation.CmsInput.text;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.cms.MethodGuideService.Action;
import com.huyenco.cms.MethodGuideService.Draft;
import com.huyenco.cms.MethodGuideService.Method;
import com.huyenco.cms.MethodGuideService.Status;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.validation.CmsInput.FieldFailure;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@RequestMapping(value = "/api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
final class MethodGuideController {
    private static final String ADMIN = "/admin/method-guides";
    private static final String GUIDE = ADMIN + "/{methodCode}";
    private static final int MAX_BODY_BYTES = 32 * 1024;
    private static final Logger LOG = LoggerFactory.getLogger(MethodGuideController.class);
    private final MethodGuideService service;
    private final Optional<AdminRequestAccess> admin;
    private final ObjectReader reader;

    MethodGuideController(MethodGuideService service, Optional<AdminRequestAccess> admin, ObjectMapper mapper) {
        this.service = service;
        this.admin = admin;
        this.reader = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @GetMapping(ADMIN)
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(200, () -> {
            actor(request, false);
            query(request, Set.of("q", "group", "status", "page", "size"));
            String q = request.getParameter("q");
            if (q != null && (q.length() > 100 || q.codePoints().anyMatch(c ->
                    Character.isISOControl(c) || c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE))) throw invalid("q");
            String group = request.getParameter("group");
            if (group != null && !Set.of("MAI_HOA", "TAM_THE").contains(group)) throw invalid("group");
            String status = request.getParameter("status");
            return service.list(q == null ? "" : q.strip(), group, status == null ? null : option(Status.class, status, "status"),
                    page(request), size(request));
        });
    }

    @GetMapping(GUIDE)
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String methodCode) {
        return respond(200, () -> {
            actor(request, false);
            query(request, Set.of());
            return service.detail(method(methodCode));
        });
    }

    @GetMapping(GUIDE + "/events")
    ResponseEntity<Envelope> events(HttpServletRequest request, @PathVariable String methodCode) {
        return respond(200, () -> {
            actor(request, false);
            query(request, Set.of("page", "size"));
            return service.events(method(methodCode), page(request), size(request));
        });
    }

    @PostMapping(ADMIN)
    ResponseEntity<Envelope> create(HttpServletRequest request) {
        return respond(201, () -> {
            UUID actor = actor(request, true);
            JsonNode json = body(request, Set.of("methodCode", "title", "body", "editorNote"));
            return service.create(method(text(json, "methodCode", 16, false, false)), draft(json), actor);
        });
    }

    @PutMapping(GUIDE + "/draft")
    ResponseEntity<Envelope> draft(HttpServletRequest request, @PathVariable String methodCode) {
        return respond(200, () -> {
            UUID actor = actor(request, true);
            JsonNode json = body(request, Set.of("expectedVersion", "title", "body", "editorNote"));
            return service.update(method(methodCode), expectedVersion(json), Action.SAVE_DRAFT, draft(json), null, actor);
        });
    }

    @PostMapping(GUIDE + "/{command:submit-review|return-to-draft|publish}")
    ResponseEntity<Envelope> workflow(HttpServletRequest request, @PathVariable String methodCode, @PathVariable String command) {
        return respond(200, () -> {
            UUID actor = actor(request, true);
            Action action = switch (command) {
                case "submit-review" -> Action.SUBMIT_REVIEW;
                case "return-to-draft" -> Action.RETURN_TO_DRAFT;
                case "publish" -> Action.PUBLISH;
                default -> throw invalid(null);
            };
            boolean returning = action == Action.RETURN_TO_DRAFT;
            JsonNode json = body(request, returning ? Set.of("expectedVersion", "reason") : Set.of("expectedVersion"));
            String reason = returning ? text(json, "reason", 500, true, false) : null;
            return service.update(method(methodCode), expectedVersion(json), action, null, reason, actor);
        });
    }

    @PutMapping(GUIDE + "/visibility")
    ResponseEntity<Envelope> visibility(HttpServletRequest request, @PathVariable String methodCode) {
        return respond(200, () -> {
            UUID actor = actor(request, true);
            JsonNode json = body(request, Set.of("expectedVersion", "visible"));
            if (!json.path("visible").isBoolean()) throw invalid("visible");
            Action action = json.path("visible").booleanValue() ? Action.SHOW : Action.HIDE;
            return service.update(method(methodCode), expectedVersion(json), action, null, null, actor);
        });
    }

    @GetMapping("/method-guides")
    ResponseEntity<Envelope> published(HttpServletRequest request) {
        return respond(200, () -> {
            query(request, Set.of());
            return service.published();
        });
    }

    private UUID actor(HttpServletRequest request, boolean write) {
        return admin.orElseThrow(() -> new ContractException("INVALID_SESSION", "Cần phiên quản trị hợp lệ."))
                .require(request, write);
    }

    private JsonNode body(HttpServletRequest request, Set<String> fields) {
        query(request, Set.of());
        JsonNode json;
        try {
            if (request.getContentType() == null) throw invalid(null);
            MediaType type = MediaType.parseMediaType(request.getContentType());
            if (!"application".equalsIgnoreCase(type.getType()) || !"json".equalsIgnoreCase(type.getSubtype())
                    || type.getCharset() != null && !StandardCharsets.UTF_8.equals(type.getCharset())) throw invalid(null);
            byte[] bytes = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
            if (bytes.length == 0 || bytes.length > MAX_BODY_BYTES) throw invalid(null);
            json = reader.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
        } catch (IOException | IllegalArgumentException failure) {
            throw invalid(null);
        }
        if (json == null || !json.isObject()) throw invalid(null);
        json.fieldNames().forEachRemaining(field -> {
            if (!fields.contains(field)) throw invalid(null);
        });
        return json;
    }

    private static Draft draft(JsonNode json) {
        return new Draft(text(json, "title", 120, false, false), text(json, "body", 6000, true, false),
                text(json, "editorNote", 500, true, true));
    }

    private static Method method(String value) { return option(Method.class, value, "methodCode"); }
    private static <T extends Enum<T>> T option(Class<T> type, String value, String field) {
        try { return Enum.valueOf(type, value); }
        catch (IllegalArgumentException failure) { throw invalid(field); }
    }

    private static void query(HttpServletRequest request, Set<String> fields) {
        request.getParameterMap().forEach((name, values) -> {
            if (!fields.contains(name) || values.length != 1) throw invalid(null);
        });
    }

    private static int page(HttpServletRequest request) { return number(request, "page", 0, 0, Integer.MAX_VALUE); }
    private static int size(HttpServletRequest request) { return number(request, "size", 20, 1, 50); }
    private static int number(HttpServletRequest request, String name, int fallback, int minimum, int maximum) {
        String value = request.getParameter(name);
        if (value == null) return fallback;
        if (!value.matches("[0-9]{1,10}")) throw invalid(name);
        try {
            int number = Integer.parseInt(value);
            if (number < minimum || number > maximum) throw invalid(name);
            return number;
        } catch (NumberFormatException failure) {
            throw invalid(name);
        }
    }

    private static ResponseEntity<Envelope> respond(int status, Supplier<Object> action) {
        String id = UUID.randomUUID().toString();
        try {
            return result(status, new Envelope(id, "COMPLETED", action.get(), null));
        } catch (ContractException failure) {
            int code = switch (failure.code()) {
                case "INVALID_SESSION" -> 401;
                case "CSRF_REJECTED", "FORBIDDEN" -> 403;
                case "NOT_FOUND" -> 404;
                case "GUIDE_EXISTS", "VERSION_CONFLICT", "INVALID_TRANSITION" -> 409;
                default -> 400;
            };
            String reason = failure instanceof FieldFailure input ? input.field() : null;
            return result(code, new Envelope(id, "FAILED", null, new ApiError(failure.code(), failure.getMessage(), null, reason)));
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            LOG.warn("Method guides DATABASE_UNAVAILABLE requestId={} error={}", id, failure.getClass().getSimpleName());
            return result(503, new Envelope(id, "FAILED", null,
                    new ApiError("DATABASE_UNAVAILABLE", "Kho nội dung tạm thời không truy cập được.", null, null)));
        } catch (RuntimeException failure) {
            LOG.warn("Method guides INTERNAL_ERROR requestId={} error={}", id, failure.getClass().getSimpleName());
            return result(500, new Envelope(id, "FAILED", null,
                    new ApiError("INTERNAL_ERROR", "Không thể xử lý bài hướng dẫn.", null, null)));
        }
    }

    private static ResponseEntity<Envelope> result(int status, Envelope envelope) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(envelope);
    }

    record Envelope(String requestId, String status, Object data, ApiError error) {}
}
