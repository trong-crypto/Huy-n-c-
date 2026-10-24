package com.huyenco.common.dto;

import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.Comparator;
import java.util.List;

/** Metadata is assembled only after every required rule has been authorized. */
public record EvidenceSummary(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                              List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                              List<DecisionReference> decisionReferences) {
    public EvidenceSummary {
        rules = List.copyOf(rules);
        sourceReferences = List.copyOf(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
    }

    public static EvidenceSummary from(List<RuleEvidence> rules) {
        if (rules == null || rules.isEmpty()) {
            throw new IllegalArgumentException("Result metadata requires authorized rules");
        }
        List<String> versions = rules.stream().map(RuleEvidence::ruleVersion).distinct().toList();
        if (versions.size() != 1) {
            throw new IllegalArgumentException("Result rules must share the current rule-set version");
        }
        RuleBasis basis = rules.stream().anyMatch(rule -> rule.ruleBasis() == RuleBasis.TEAM_DECISION)
                ? RuleBasis.TEAM_DECISION : RuleBasis.SOURCE_VERIFIED;
        SourceStatus source = rules.stream().map(RuleEvidence::sourceStatus)
                .max(Comparator.comparingInt(EvidenceSummary::uncertainty)).orElseThrow();
        return new EvidenceSummary(versions.get(0), basis, source, rules,
                rules.stream().flatMap(rule -> rule.sourceReferences().stream()).distinct().toList(),
                rules.stream().flatMap(rule -> rule.decisionReferences().stream()).distinct().toList());
    }

    private static int uncertainty(SourceStatus status) {
        return switch (status) {
            case VERIFIED -> 0;
            case SOURCE_LOCATED -> 1;
            case SOURCE_AMBIGUOUS -> 2;
            case BLOCKED_SOURCE_CONFLICT -> 3;
            case DRAFT -> 4;
        };
    }
}
