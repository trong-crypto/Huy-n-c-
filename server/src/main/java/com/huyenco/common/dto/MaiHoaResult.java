package com.huyenco.common.dto;

import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record MaiHoaResult(String method, String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                           List<DecisionReference> decisionReferences, List<CalculationStep> calculationSteps,
                           HexagramView primaryHexagram, HexagramView mutualHexagram,
                           HexagramView changedHexagram, int movingLine, LunarDate lunarDate) {
    public MaiHoaResult {
        rules = List.copyOf(rules);
        sourceReferences = List.copyOf(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
        calculationSteps = List.copyOf(calculationSteps);
        if (movingLine < 1 || movingLine > 6) {
            throw new IllegalArgumentException("movingLine must be in 1..6");
        }
    }

    public static MaiHoaResult of(String method, EvidenceSummary evidence, List<CalculationStep> steps,
                                   HexagramView primary, HexagramView mutual, HexagramView changed,
                                   int movingLine, LunarDate lunarDate) {
        return new MaiHoaResult(method, evidence.ruleVersion(), evidence.ruleBasis(), evidence.sourceStatus(),
                evidence.rules(), evidence.sourceReferences(), evidence.decisionReferences(), steps,
                primary, mutual, changed, movingLine, lunarDate);
    }
}
