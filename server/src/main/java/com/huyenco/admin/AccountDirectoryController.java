package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.body;
import static com.huyenco.admin.AdminDirectoryHttp.expectedVersion;
import static com.huyenco.admin.AdminDirectoryHttp.invalid;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.option;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;
import static com.huyenco.admin.AdminDirectoryHttp.uuid;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@RequestMapping(value = "/api/v1/admin/accounts", produces = MediaType.APPLICATION_JSON_VALUE)
final class AccountDirectoryController {
    private static final Logger LOG = LoggerFactory.getLogger(AccountDirectoryController.class);
    private static final int MAX_BODY = 12000;
    private final AccountDirectoryService service;
    private final Optional<AdminRequestAccess> access;
    private final ObjectReader reader;

    AccountDirectoryController(AccountDirectoryService service, Optional<AdminRequestAccess> access, ObjectMapper mapper) {
        this.service = service;
        this.access = access;
        this.reader = AdminDirectoryHttp.reader(mapper);
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("q", "role", "status", "page", "size", "passwordRequest"));
            String q = request.getParameter("q");
            if (q != null && (q.length() > 100 || q.codePoints().anyMatch(Character::isISOControl))) throw invalid();
            String passwordRequest = request.getParameter("passwordRequest");
            if (passwordRequest != null && !"pending".equals(passwordRequest)) throw invalid();
            return service.list(q == null ? "" : q.strip(), option(AccountDirectoryService.Role.class, request.getParameter("role")),
                    option(AccountDirectoryService.Status.class, request.getParameter("status")), passwordRequest != null,
                    number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    @GetMapping("/{id}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("from", "to"));
            LocalDate from = date(request.getParameter("from"));
            LocalDate to = date(request.getParameter("to"));
            if (from != null && to != null && from.isAfter(to)) throw invalid();
            return service.detail(uuid(id), from, to);
        });
    }

    private static LocalDate date(String value) {
        if (value == null) return null;
        if (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw invalid();
        try {
            LocalDate parsed = LocalDate.parse(value);
            if (parsed.getYear() < 1900 || parsed.getYear() > 9998) throw invalid();
            return parsed;
        } catch (DateTimeParseException error) { throw invalid(); }
    }

    @PutMapping("/{id}/status")
    ResponseEntity<Envelope> update(HttpServletRequest request, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            UUID actor = actor(access, request, true);
            query(request, Set.of());
            JsonNode body = body(request, reader, MAX_BODY);
            JsonNode status = body.path("status");
            if (!status.isTextual() || body.size() != (body.has("reason") ? 3 : 2)
                    || body.has("reason") && !body.path("reason").isTextual()) throw invalid();
            return service.change(uuid(id), expectedVersion(body), option(AccountDirectoryService.Status.class, status.textValue()), actor,
                    body.has("reason") ? body.path("reason").asText() : null);
        });
    }

    @PutMapping("/{id}/role")
    ResponseEntity<Envelope> updateRole(HttpServletRequest request, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            UUID actor = actor(access, request, true);
            query(request, Set.of());
            JsonNode body = body(request, reader, MAX_BODY);
            JsonNode role = body.path("role");
            boolean approveProfile = body.has("approveProfile");
            if (body.size() != (approveProfile ? 3 : 2) || !role.isTextual()
                    || approveProfile && (!body.path("approveProfile").isBoolean()
                    || !body.path("approveProfile").booleanValue() || !"CONSULTANT".equals(role.textValue()))) throw invalid();
            return service.changeRole(uuid(id), expectedVersion(body), option(AccountDirectoryService.Role.class, role.textValue()), actor, approveProfile);
        });
    }

}
