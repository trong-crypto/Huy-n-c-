package com.huyenco.common.dto;

import com.huyenco.knowledge.ExecutionPolicy;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record RuleEvidence(String ruleCode, String ruleVersion, ExecutionPolicy executionPolicy,
                           RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<SourceReference> sourceReferences, List<DecisionReference> decisionReferences) {
    public RuleEvidence {
        sourceReferences = List.copyOf(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
    }
}
