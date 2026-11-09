package com.huyenco.chat;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
@RequestMapping(value = "/api/v1/chat/consultants", produces = MediaType.APPLICATION_JSON_VALUE)
final class ChatConsultantController {
    private static final Logger LOG = LoggerFactory.getLogger(ChatConsultantController.class);
    private static final Pattern UUID_TEXT = Pattern.compile("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}");
    private static final Pattern PAGE_NUMBER = Pattern.compile("[0-9]{1,10}");
    private final ChatSessionAccess sessions;
    private final ChatConsultantProfiles profiles;

    ChatConsultantController(ChatSessionAccess sessions, ChatConsultantProfiles profiles) {
        this.sessions = sessions;
        this.profiles = profiles;
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(request, () -> {
            validateQuery(request, Set.of("page", "size"));
            int page = number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE);
            int size = number(request.getParameter("size"), 20, 1, 50);
            return profiles.listEligible(page, size);
        });
    }

    @GetMapping("/{consultantId}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String consultantId) {
        return respond(request, () -> {
            validateQuery(request, Set.of());
            if (!UUID_TEXT.matcher(consultantId).matches()) throw invalid();
            return profiles.findEligible(UUID.fromString(consultantId))
                    .orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy hồ sơ tư vấn viên."));
        });
    }

    private ResponseEntity<Envelope> respond(HttpServletRequest request, Supplier<Object> action) {
        String requestId = UUID.randomUUID().toString();
        try {
            if (sessions.requireRead(request).role() != ChatSessionAccess.Role.USER) {
                throw new ContractException("FORBIDDEN", "Phiên này không có quyền xem danh bạ tư vấn viên.");
            }
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .body(new Envelope(requestId, "COMPLETED", action.get(), null));
        } catch (ContractException failure) {
            int status = switch (failure.code()) {
                case "INVALID_INPUT" -> 400;
                case "INVALID_SESSION" -> 401;
                case "FORBIDDEN", "CSRF_REJECTED" -> 403;
                case "NOT_FOUND" -> 404;
                default -> 500;
            };
            if (status < 500) return failed(requestId, status, failure.code(), failure.getMessage());
            return internalFailure(requestId);
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            LOG.warn("Chat consultant directory DATABASE_UNAVAILABLE requestId={}", requestId);
            return failed(requestId, 503, "DATABASE_UNAVAILABLE", "Không thể truy cập dữ liệu tài khoản hoặc danh bạ.");
        } catch (RuntimeException failure) {
            return internalFailure(requestId);
        }
    }

    private static void validateQuery(HttpServletRequest request, Set<String> keys) {
        var params = request.getParameterMap();
        if (!keys.containsAll(params.keySet()) || params.values().stream().anyMatch(values -> values.length != 1)) {
            throw invalid();
        }
    }

    private static int number(String value, int fallback, int min, int max) {
        if (value == null) return fallback;
        if (!PAGE_NUMBER.matcher(value).matches()) throw invalid();
        long parsed = Long.parseLong(value);
        if (parsed < min || parsed > max) throw invalid();
        return (int) parsed;
    }

    private static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Tham số danh bạ tư vấn viên không hợp lệ.");
    }

    private static ResponseEntity<Envelope> internalFailure(String requestId) {
        LOG.warn("Chat consultant directory INTERNAL_ERROR requestId={}", requestId);
        return failed(requestId, 500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu danh bạ tư vấn viên.");
    }

    private static ResponseEntity<Envelope> failed(String requestId, int status, String code, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new Envelope(requestId, "FAILED", null, new ApiError(code, message, null, null)));
    }

    record Envelope(String requestId, String status, Object data, ApiError error) {}
}
