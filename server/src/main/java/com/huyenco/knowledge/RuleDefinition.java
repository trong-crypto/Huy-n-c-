package com.huyenco.knowledge;

import com.huyenco.common.dto.DecisionReference;
import java.util.List;

/** Execution configuration; this record never asserts that a source was verified. */
public record RuleDefinition(String ruleCode, RuleModule module, String ruleVersion,
                             ExecutionPolicy executionPolicy, List<DecisionReference> decisionReferences) {
    public RuleDefinition {
        decisionReferences = decisionReferences == null ? List.of() : List.copyOf(decisionReferences);
        if (ruleCode == null || ruleCode.isBlank() || ruleVersion == null || ruleVersion.isBlank()
                || module == null || executionPolicy == null) {
            throw new IllegalArgumentException("Incomplete rule execution definition");
        }
        if (executionPolicy == ExecutionPolicy.TEAM_DECISION
                && (decisionReferences.isEmpty() || decisionReferences.stream().anyMatch(d -> !d.isComplete()))) {
            throw new IllegalArgumentException("TEAM_DECISION requires a dated decision reference");
        }
    }
}
