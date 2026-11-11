package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.body;
import static com.huyenco.admin.AdminDirectoryHttp.invalid;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;
import static com.huyenco.common.validation.CmsInput.expectedVersion;
import static com.huyenco.common.validation.CmsInput.text;

import com.huyenco.websocket.AdminReviewNotifications;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.common.validation.CmsInput;
import com.huyenco.hexagram.AdminHexagramGlossDrafts;
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
@RequestMapping(value = "/api/v1/admin/hexagrams/{code}/gloss-draft", produces = MediaType.APPLICATION_JSON_VALUE)
final class AdminHexagramGlossDraftController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminHexagramGlossDraftController.class);
    private static final int MAX_BODY = 8192;
    private final AdminHexagramGlossDrafts drafts;
    private final Optional<AdminRequestAccess> access;
    private final AdminReviewNotifications notifications;
    private final ObjectReader reader;

    AdminHexagramGlossDraftController(AdminHexagramGlossDrafts drafts, Optional<AdminRequestAccess> access, ObjectMapper mapper, AdminReviewNotifications notifications) {
        this.notifications = notifications;
        this.drafts = drafts;
        this.access = access;
        this.reader = AdminDirectoryHttp.reader(mapper);
    }

    @GetMapping
    ResponseEntity<Envelope> latest(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return drafts.latest(code);
        });
    }

    @GetMapping("/revisions/{version}")
    ResponseEntity<Envelope> revision(HttpServletRequest request, @PathVariable String code, @PathVariable String version) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return drafts.revision(code, number(version, 0, 1, Integer.MAX_VALUE));
        });
    }

    @GetMapping("/workflow")
    ResponseEntity<Envelope> workflow(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return drafts.workflow(code);
        });
    }

    @PutMapping("/workflow/visibility")
    ResponseEntity<Envelope> visibility(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            JsonNode data = input(request, Set.of("expectedVersion", "visible"));
            if (!data.path("visible").isBoolean()) throw CmsInput.invalid("visible");
            return drafts.setVisibility(code, expectedVersion(data), data.path("visible").booleanValue(), actorId);
        });
    }

    @PostMapping("/workflow/{command:submit-review|return-to-draft|publish}")
    ResponseEntity<Envelope> transition(HttpServletRequest request, @PathVariable String code, @PathVariable String command) {
        return respond(LOG, 200, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            return switch (command) {
                case "submit-review" -> {
                    JsonNode data = input(request, Set.of("expectedVersion"));
                    var updated = drafts.transition(code, expectedVersion(data), AdminHexagramGlossDrafts.Action.SUBMIT, actorId, null, null, null);
                    notifications.submitted(AdminReviewNotifications.Area.NAME_GLOSS);
                    yield updated;
                }
                case "return-to-draft" -> {
                    JsonNode data = input(request, Set.of("expectedVersion", "reason"));
                    yield drafts.transition(code, expectedVersion(data), AdminHexagramGlossDrafts.Action.RETURN, actorId,
                            text(data, "reason", 500, false, false), null, null);
                }
                case "publish" -> {
                    JsonNode data = input(request, Set.of("expectedVersion", "printedSourceLabel", "verificationNote"));
                    yield drafts.transition(code, expectedVersion(data), AdminHexagramGlossDrafts.Action.PUBLISH, actorId, null,
                            text(data, "printedSourceLabel", 120, false, false), text(data, "verificationNote", 500, false, false));
                }
                default -> throw invalid();
            };
        });
    }

    @PostMapping
    ResponseEntity<Envelope> create(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 201, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            JsonNode data = input(request, Set.of("content", "sourceSectionId"));
            return drafts.create(code, text(data, "content", 500, false, false), sourceSection(data), actorId);
        });
    }

    @PutMapping
    ResponseEntity<Envelope> update(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var actorId = actor(access, request, true);
            query(request, Set.of());
            JsonNode data = input(request, Set.of("expectedVersion", "content", "sourceSectionId"));
            return drafts.update(code, expectedVersion(data), text(data, "content", 500, false, false), sourceSection(data), actorId);
        });
    }

    private JsonNode input(HttpServletRequest request, Set<String> fields) {
        JsonNode data = body(request, reader, MAX_BODY);
        data.fieldNames().forEachRemaining(field -> {
            if (!fields.contains(field)) throw invalid();
        });
        return data;
    }

    private static long sourceSection(JsonNode data) {
        var value = data.path("sourceSectionId");
        if (!value.isTextual() || !value.textValue().matches("[1-9][0-9]{0,18}")) throw CmsInput.invalid("sourceSectionId");
        try { return Long.parseLong(value.textValue()); }
        catch (NumberFormatException failure) { throw CmsInput.invalid("sourceSectionId"); }
    }
}
