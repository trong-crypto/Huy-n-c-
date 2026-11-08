package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.invalid;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.option;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;
import static com.huyenco.admin.AdminDirectoryHttp.uuid;

import com.huyenco.admin.AdminAuditService.Action;
import com.huyenco.admin.AdminAuditService.Filters;
import com.huyenco.admin.AdminAuditService.TargetType;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
final class AdminAuditController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminAuditController.class);
    private static final Set<String> METHOD_CODES = Set.of("TIME", "OBJECT_COUNT", "LINES", "TAM_THE");
    private static final Set<String> FILTERS = Set.of("targetType", "targetId", "action", "actorId", "from", "to", "page", "size");
    private final AdminAuditService audit;
    private final Optional<AdminRequestAccess> access;

    AdminAuditController(AdminAuditService audit, Optional<AdminRequestAccess> access) {
        this.audit = audit;
        this.access = access;
    }

    @GetMapping(value = "/api/v1/admin/audit", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, FILTERS);
            var from = timestamp(request.getParameter("from"));
            var to = timestamp(request.getParameter("to"));
            if (from != null && to != null && !from.isBefore(to)) throw invalid();
            var type = option(TargetType.class, request.getParameter("targetType"));
            String actorId = request.getParameter("actorId");
            var filters = new Filters(type, target(type, request.getParameter("targetId")),
                    option(Action.class, request.getParameter("action")), actorId == null ? null : uuid(actorId), from, to);
            return audit.list(filters, number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    private static String target(TargetType type, String value) {
        if (value == null) return null;
        if (METHOD_CODES.contains(value)) {
            if (type != null && type != TargetType.METHOD_GUIDE) throw invalid();
            return value;
        }
        if (type == TargetType.METHOD_GUIDE) throw invalid();
        return uuid(value).toString();
    }

    private static OffsetDateTime timestamp(String value) {
        if (value == null) return null;
        if (value.length() > 40 || !value.matches("[0-9]{4}-.*")) throw invalid();
        try {
            OffsetDateTime date = OffsetDateTime.parse(value);
            if (date.getYear() < 1 || date.getNano() % 1000 != 0) throw invalid();
            return date;
        } catch (DateTimeParseException failure) {
            throw invalid();
        }
    }
}
