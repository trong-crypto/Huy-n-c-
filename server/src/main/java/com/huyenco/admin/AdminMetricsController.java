package com.huyenco.admin;

import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
final class AdminMetricsController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminMetricsController.class);
    private final AdminMetricsService metrics;
    private final Optional<AdminRequestAccess> access;

    AdminMetricsController(AdminMetricsService metrics, Optional<AdminRequestAccess> access) {
        this.metrics = metrics;
        this.access = access;
    }

    @GetMapping(value = "/api/v1/admin/metrics", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Envelope> read(HttpServletRequest request) {
        String id = UUID.randomUUID().toString();
        try {
            access.orElseThrow(() -> new ContractException("INVALID_SESSION", "Cần phiên quản trị hợp lệ."))
                    .require(request, false);
            return response(200, new Envelope(id, "COMPLETED", metrics.read(date(request)), null));
        } catch (ContractException failure) {
            int status = switch (failure.code()) {
                case "INVALID_SESSION" -> 401;
                case "FORBIDDEN", "CSRF_REJECTED" -> 403;
                default -> 400;
            };
            return failed(id, status, failure.code(), failure.getMessage());
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            LOG.warn("Admin metrics DATABASE_UNAVAILABLE requestId={}", id);
            return failed(id, 503, "DATABASE_UNAVAILABLE", "Kho thống kê tạm thời không khả dụng.");
        } catch (RuntimeException failure) {
            LOG.warn("Admin metrics INTERNAL_ERROR requestId={}", id);
            return failed(id, 500, "INTERNAL_ERROR", "Không thể đọc thống kê quản trị.");
        }
    }

    private static LocalDate date(HttpServletRequest request) {
        var query = request.getParameterMap();
        if (query.isEmpty()) return null;
        String[] values = query.get("date");
        if (query.size() == 1 && values != null && values.length == 1 && values[0].matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
            try {
                LocalDate date = LocalDate.parse(values[0]);
                if (date.getYear() >= 1) return date;
            } catch (DateTimeParseException ignored) {
                // Return the same validation error for malformed and impossible dates.
            }
        }
        throw new ContractException("INVALID_INPUT", "Ngày thống kê phải theo định dạng YYYY-MM-DD.");
    }

    private static ResponseEntity<Envelope> failed(String id, int status, String code, String message) {
        return response(status, new Envelope(id, "FAILED", null, new ApiError(code, message, null, null)));
    }

    private static ResponseEntity<Envelope> response(int status, Envelope envelope) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(envelope);
    }

    record Envelope(String requestId, String status, AdminMetricsService.Metrics data, ApiError error) {}
}
