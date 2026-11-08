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
import com.huyenco.admin.AccountDirectoryService.Status;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.admin.ConsultantDirectoryService.Decision;
import com.huyenco.admin.ConsultantDirectoryService.ReviewStatus;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@RequestMapping(value = "/api/v1/admin/consultants", produces = MediaType.APPLICATION_JSON_VALUE)
final class ConsultantDirectoryController {
    private static final Logger LOG = LoggerFactory.getLogger(ConsultantDirectoryController.class);
    private static final int MAX_BODY = 8192;
    private final ConsultantDirectoryService service;
    private final Optional<AdminRequestAccess> access;
    private final ObjectReader reader;

    ConsultantDirectoryController(ConsultantDirectoryService service, Optional<AdminRequestAccess> access,
                                  ObjectMapper mapper) {
        this.service = service;
        this.access = access;
        this.reader = AdminDirectoryHttp.reader(mapper);
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("q", "accountStatus", "reviewStatus", "page", "size"));
            String q = request.getParameter("q");
            if (q != null && (q.length() > 100 || q.codePoints().anyMatch(Character::isISOControl))) throw invalid();
            return service.list(q == null ? "" : q.strip(), option(Status.class, request.getParameter("accountStatus")),
                    option(ReviewStatus.class, request.getParameter("reviewStatus")),
                    number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    @GetMapping("/{id}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return service.detail(uuid(id));
        });
    }

    @PostMapping
    ResponseEntity<Envelope> create(HttpServletRequest request) {
        return respond(LOG, 201, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            JsonNode data = body(request, reader, MAX_BODY);
            if (data.size() != 2 || !data.path("accountId").isTextual()) throw invalid();
            return service.create(uuid(data.path("accountId").textValue()), profileText(data.path("summary")), actorId);
        });
    }

    @PutMapping("/{id}/review")
    ResponseEntity<Envelope> review(HttpServletRequest request, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            JsonNode data = body(request, reader, MAX_BODY);
            JsonNode decisionNode = data.path("decision");
            if (!decisionNode.isTextual()) throw invalid();
            Decision decision = option(Decision.class, decisionNode.textValue());
            boolean rejecting = decision == Decision.REJECTED;
            if (data.size() != (rejecting ? 3 : 2) || !rejecting && data.has("reason")) throw invalid();
            String reason = rejecting ? profileText(data.path("reason")) : null;
            return service.review(uuid(id), expectedVersion(data), decision, reason, actorId);
        });
    }

    private static String profileText(JsonNode value) {
        if (!value.isTextual()) throw invalid();
        String text = value.textValue().strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > 500 || text.codePoints().anyMatch(point ->
                (Character.isISOControl(point) && point != '\r' && point != '\n' && point != '\t')
                        || point >= Character.MIN_SURROGATE && point <= Character.MAX_SURROGATE)) throw invalid();
        return text;
    }
}
