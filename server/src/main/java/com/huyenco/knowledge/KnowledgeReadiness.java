package com.huyenco.knowledge;

import java.util.List;
import java.util.Map;

/** Storage readiness is deliberately separate from implemented business features. */
public record KnowledgeReadiness(String status, String scope, String database, String schema, String seed,
                                 boolean businessFeaturesReady, Map<String, Long> counts,
                                 List<RuleReadiness> rules, List<String> pending) {
    public record RuleReadiness(String ruleCode, String executionPolicy, String sourceStatus,
                                boolean calculationAuthorized, String reason) { }

    public static KnowledgeReadiness unavailable(String database, String schema) {
        return new KnowledgeReadiness("NOT_READY", "KNOWLEDGE_STORAGE", database, schema, "NOT_CHECKED",
                false, Map.of(), List.of(), List.of("BUSINESS_IMPLEMENTATION_PENDING"));
    }
}
