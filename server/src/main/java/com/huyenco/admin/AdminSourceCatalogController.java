package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.body;
import static com.huyenco.admin.AdminDirectoryHttp.invalid;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.option;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;
import static com.huyenco.common.validation.CmsInput.expectedVersion;
import static com.huyenco.common.validation.CmsInput.text;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.admin.AdminSourceCatalog.Kind;
import com.huyenco.admin.AdminSourceProposals.Action;
import com.huyenco.admin.AdminSourceProposals.BookChange;
import com.huyenco.admin.AdminSourceProposals.BookField;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.common.validation.CmsInput;
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
@RequestMapping(value = "/api/v1/admin/sources", produces = MediaType.APPLICATION_JSON_VALUE)
final class AdminSourceCatalogController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminSourceCatalogController.class);
    private static final String PROPOSAL = "/{kind}/{id}/proposal";
    private final AdminSourceCatalog sources;
    private final AdminSourceProposals proposals;
    private final AdminSourceProposalApplications applications;
    private final Optional<AdminRequestAccess> access;
    private final ObjectReader reader;

    AdminSourceCatalogController(AdminSourceCatalog sources, AdminSourceProposals proposals, AdminSourceProposalApplications applications,
                                 Optional<AdminRequestAccess> access, ObjectMapper mapper) {
        this.sources = sources;
        this.proposals = proposals;
        this.applications = applications;
        this.access = access;
        this.reader = AdminDirectoryHttp.reader(mapper);
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("kind", "q", "page", "size"));
            String q = request.getParameter("q");
            if (q == null) q = "";
            if (q.length() > 100 || q.codePoints().anyMatch(Character::isISOControl)) throw invalid();
            return sources.list(option(Kind.class, request.getParameter("kind")), q.strip(),
                    number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    @GetMapping("/{kind}/{id}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return sources.detail(sourceKind(kind, id), id);
        });
    }

    @GetMapping(PROPOSAL)
    ResponseEntity<Envelope> proposal(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return proposals.read(sourceKind(kind, id), id, null);
        });
    }

    @GetMapping(PROPOSAL + "/revisions/{version}")
    ResponseEntity<Envelope> revision(HttpServletRequest request, @PathVariable String kind, @PathVariable String id,
                                      @PathVariable String version) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return proposals.read(sourceKind(kind, id), id, number(version, 0, 1, Integer.MAX_VALUE));
        });
    }

    @GetMapping(PROPOSAL + "/workflow")
    ResponseEntity<Envelope> workflow(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return proposals.workflow(sourceKind(kind, id), id);
        });
    }

    @PostMapping(PROPOSAL + "/workflow/{command:submit-review|return-to-draft|approve}")
    ResponseEntity<Envelope> transition(HttpServletRequest request, @PathVariable String kind,
                                        @PathVariable String id, @PathVariable String command) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            query(request, Set.of());
            Action action = switch (command) {
                case "submit-review" -> Action.SUBMIT;
                case "return-to-draft" -> Action.RETURN;
                case "approve" -> Action.APPROVE;
                default -> throw invalid();
            };
            boolean submit = action == Action.SUBMIT;
            var input = body(request, reader, 8192);
            var fields = submit ? Set.of("expectedVersion") : Set.of("expectedVersion", "note");
            input.fieldNames().forEachRemaining(field -> {
                if (!fields.contains(field)) throw invalid();
            });
            return proposals.transition(sourceKind(kind, id), id, expectedVersion(input), action,
                    submit ? null : text(input, "note", 500, true, false), admin);
        });
    }

    @PostMapping(PROPOSAL)
    ResponseEntity<Envelope> create(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return save(request, kind, id, true);
    }

    @PutMapping(PROPOSAL)
    ResponseEntity<Envelope> update(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return save(request, kind, id, false);
    }

    @GetMapping(PROPOSAL + "/workflow/application")
    ResponseEntity<Envelope> previewApplication(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return applications.preview(sourceKind(kind, id), id);
        });
    }

    @PostMapping(PROPOSAL + "/workflow/application")
    ResponseEntity<Envelope> apply(HttpServletRequest request, @PathVariable String kind, @PathVariable String id) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            query(request, Set.of());
            var input = body(request, reader, 1024);
            if (input.size() != 1 || !input.has("expectedVersion")) throw invalid();
            return applications.apply(sourceKind(kind, id), id, expectedVersion(input), admin);
        });
    }

    private ResponseEntity<Envelope> save(HttpServletRequest request, String kind, String id, boolean create) {
        return respond(LOG, create ? 201 : 200, () -> {
            var admin = actor(access, request, true);
            query(request, Set.of());
            var input = body(request, reader, 32 * 1024);
            var fields = create ? Set.of("proposal", "reason", "bookField", "bookValue")
                    : Set.of("proposal", "reason", "expectedVersion", "bookField", "bookValue");
            input.fieldNames().forEachRemaining(field -> {
                if (!fields.contains(field)) throw invalid();
            });
            return proposals.save(sourceKind(kind, id), id, create ? null : expectedVersion(input),
                    text(input, "proposal", 2000, true, false), text(input, "reason", 500, true, false), bookChange(input), admin);
        });
    }

    private static BookChange bookChange(JsonNode input) {
        if (!input.has("bookField") && !input.has("bookValue")) return null;
        BookField field = switch (input.path("bookField").asText("")) {
            case "AUTHOR" -> BookField.AUTHOR;
            case "PUBLISHER" -> BookField.PUBLISHER;
            default -> throw CmsInput.invalid("bookField");
        };
        String value = text(input, "bookValue", 300, false, false);
        String raw = input.path("bookValue").textValue();
        if (raw.indexOf(0x2028) >= 0 || raw.indexOf(0x2029) >= 0) throw CmsInput.invalid("bookValue");
        return new BookChange(field, value);
    }

    private static Kind sourceKind(String kind, String id) {
        if (!id.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}")) throw invalid();
        return option(Kind.class, kind);
    }
}
