package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;

public final class RuleCatalog {
    private final Map<String, RuleDefinition> rules;

    public RuleCatalog(List<RuleDefinition> definitions) {
        Map<String, RuleDefinition> index = new LinkedHashMap<>();
        for (RuleDefinition definition : definitions) {
            if (index.putIfAbsent(definition.ruleCode(), definition) != null) {
                throw new IllegalArgumentException("Duplicate rule code: " + definition.ruleCode());
            }
        }
        rules = java.util.Collections.unmodifiableMap(index);
    }

    public static RuleCatalog load(ObjectMapper mapper) throws IOException {
        try (var stream = new ClassPathResource("rules/execution-catalog.json").getInputStream()) {
            CatalogFile file = mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(stream, CatalogFile.class);
            if (!"1.2".equals(file.contractVersion()) || file.rules() == null || file.rules().isEmpty()) {
                throw new IllegalArgumentException("Invalid execution catalog version or empty catalog");
            }
            return new RuleCatalog(file.rules());
        }
    }

    public Optional<RuleDefinition> find(String ruleCode) {
        return Optional.ofNullable(rules.get(ruleCode));
    }

    public List<RuleDefinition> all() {
        return List.copyOf(rules.values());
    }

    public record CatalogFile(String contractVersion, List<RuleDefinition> rules) {
    }
}
