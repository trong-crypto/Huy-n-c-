package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.option;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;

import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.hexagram.AdminHexagramCatalog;
import com.huyenco.hexagram.AdminHexagramCatalog.GlossStatus;
import com.huyenco.knowledge.SourceStatus;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@RequestMapping(value = "/api/v1/admin/hexagrams", produces = MediaType.APPLICATION_JSON_VALUE)
final class AdminHexagramController {
    private static final Logger LOG = LoggerFactory.getLogger(AdminHexagramController.class);
    private final AdminHexagramCatalog catalog;
    private final Optional<AdminRequestAccess> access;

    AdminHexagramController(AdminHexagramCatalog catalog, Optional<AdminRequestAccess> access) {
        this.catalog = catalog;
        this.access = access;
    }

    @GetMapping
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("q", "upperTrigramCode", "lowerTrigramCode", "nameStatus", "glossStatus", "page", "size"));
            String q = request.getParameter("q");
            return catalog.list(q == null ? "" : q, request.getParameter("upperTrigramCode"), request.getParameter("lowerTrigramCode"),
                    option(SourceStatus.class, request.getParameter("nameStatus")), option(GlossStatus.class, request.getParameter("glossStatus")),
                    number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE), number(request.getParameter("size"), 20, 1, 100));
        });
    }

    @GetMapping("/{code}")
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return catalog.detail(code);
        });
    }
}
