package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.*;
import static com.huyenco.common.validation.CmsInput.text;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.admin.AdminWebsiteContent.Action;
import com.huyenco.admin.AdminWebsiteContent.Draft;
import com.huyenco.admin.AdminWebsiteContent.Section;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
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
@RequestMapping(value = "/api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
final class AdminWebsiteContentController {
    private static final String SLOT = "/admin/website-content/{sectionCode}";
    private static final Logger LOG = LoggerFactory.getLogger(AdminWebsiteContentController.class);
    private final AdminWebsiteContent service;
    private final Optional<AdminRequestAccess> access;
    private final ObjectReader reader;

    AdminWebsiteContentController(AdminWebsiteContent service, Optional<AdminRequestAccess> access, ObjectMapper mapper) {
        this.service = service;
        this.access = access;
        this.reader = reader(mapper);
    }

    @GetMapping("/website-content")
    ResponseEntity<Envelope> published(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            query(request, Set.of());
            return Map.of("items", service.published());
        });
    }

    @GetMapping(SLOT)
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String sectionCode) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return service.detail(option(Section.class, sectionCode));
        });
    }

    @GetMapping(SLOT + "/events")
    ResponseEntity<Envelope> events(HttpServletRequest request, @PathVariable String sectionCode) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("page", "size"));
            return service.events(option(Section.class, sectionCode),
                    number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    @PutMapping(SLOT + "/draft")
    ResponseEntity<Envelope> save(HttpServletRequest request, @PathVariable String sectionCode) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            JsonNode input = input(request, Set.of("expectedVersion", "title", "body", "editorNote"));
            var draft = new Draft(text(input, "title", 120, false, false), text(input, "body", 6000, true, false),
                    text(input, "editorNote", 500, true, true));
            JsonNode version = input.path("expectedVersion");
            int expected = version.isIntegralNumber() && version.canConvertToInt() && version.intValue() == 0
                    ? 0 : expectedVersion(input);
            return service.update(option(Section.class, sectionCode), expected, Action.SAVE_DRAFT, draft, null, admin);
        });
    }

    @PostMapping(SLOT + "/{command:submit-review|return-to-draft|publish}")
    ResponseEntity<Envelope> review(HttpServletRequest request, @PathVariable String sectionCode, @PathVariable String command) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            Action action = switch (command) {
                case "submit-review" -> Action.SUBMIT_REVIEW;
                case "return-to-draft" -> Action.RETURN_TO_DRAFT;
                case "publish" -> Action.PUBLISH;
                default -> throw invalid();
            };
            boolean returning = action == Action.RETURN_TO_DRAFT;
            JsonNode input = input(request, returning ? Set.of("expectedVersion", "reason") : Set.of("expectedVersion"));
            return service.update(option(Section.class, sectionCode), expectedVersion(input), action, null,
                    returning ? text(input, "reason", 500, true, false) : null, admin);
        });
    }

    private JsonNode input(HttpServletRequest request, Set<String> fields) {
        query(request, Set.of());
        JsonNode input = body(request, reader, 32 * 1024);
        input.fieldNames().forEachRemaining(field -> {
            if (!fields.contains(field)) throw invalid();
        });
        return input;
    }
}
