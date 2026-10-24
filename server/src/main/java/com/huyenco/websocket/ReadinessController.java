package com.huyenco.websocket;

import com.huyenco.knowledge.JdbcKnowledgeRepository;
import com.huyenco.knowledge.KnowledgeReadiness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReadinessController {
    private final ObjectProvider<JdbcKnowledgeRepository> repositories;

    public ReadinessController(ObjectProvider<JdbcKnowledgeRepository> repositories) {
        this.repositories = repositories;
    }

    @GetMapping("/api/v1/readiness")
    public ResponseEntity<KnowledgeReadiness> readiness() {
        var repository = repositories.getIfAvailable();
        var result = repository == null ? KnowledgeReadiness.unavailable("DISABLED", "NOT_CHECKED")
                : repository.readiness();
        return ResponseEntity.status("READY".equals(result.status()) ? 200 : 503).body(result);
    }
}
