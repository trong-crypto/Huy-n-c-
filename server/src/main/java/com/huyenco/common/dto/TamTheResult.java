package com.huyenco.common.dto;

import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record TamTheResult(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                           List<DecisionReference> decisionReferences, List<CategoryResult> categories) {
    public TamTheResult {
        if (ruleBasis != RuleBasis.SOURCE_VERIFIED || sourceStatus != SourceStatus.VERIFIED
                || rules == null || rules.isEmpty() || categories == null || categories.isEmpty()
                || rules.stream().anyMatch(rule -> rule.ruleBasis() != RuleBasis.SOURCE_VERIFIED
                    || rule.sourceStatus() != SourceStatus.VERIFIED)) {
            throw new IllegalArgumentException("Interpretations require verified source evidence");
        }
        rules = List.copyOf(rules);
        sourceReferences = List.copyOf(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
        categories = List.copyOf(categories);
    }
    public record CategoryResult(TamTheCategory category, List<InterpretationEntry> entries) {
        public CategoryResult {
            if (category == null || entries == null || entries.isEmpty()) {
                throw new IllegalArgumentException("Requested category must have verified content");
            }
            entries = List.copyOf(entries);
        }
    }

    public record InterpretationEntry(String resultCode, String title, String content,
                                       List<SourceReference> sourceReferences) {
        public InterpretationEntry {
            if (resultCode == null || resultCode.isBlank() || title == null || title.isBlank()
                    || content == null || content.isBlank() || sourceReferences == null || sourceReferences.isEmpty()
                    || sourceReferences.stream().anyMatch(source -> !source.hasTraceableLocation())) {
                throw new IllegalArgumentException("Interpretation content requires traceable sources");
            }
            sourceReferences = List.copyOf(sourceReferences);
        }
    }
}
