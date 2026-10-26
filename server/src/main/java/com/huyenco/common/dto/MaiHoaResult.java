package com.huyenco.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record MaiHoaResult(String method, String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                           List<DecisionReference> decisionReferences, List<CalculationStep> calculationSteps,
                           HexagramView primaryHexagram, HexagramView mutualHexagram,
                           HexagramView changedHexagram, int movingLine, LunarDate lunarDate,
                           @JsonInclude(JsonInclude.Include.NON_NULL) DetailedReading detailedReading) {
    public MaiHoaResult(String method, String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                        List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                        List<DecisionReference> decisionReferences, List<CalculationStep> calculationSteps,
                        HexagramView primary, HexagramView mutual, HexagramView changed, int movingLine, LunarDate lunarDate) {
        this(method, ruleVersion, ruleBasis, sourceStatus, rules, sourceReferences, decisionReferences,
                calculationSteps, primary, mutual, changed, movingLine, lunarDate, null);
    }
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

    public MaiHoaResult withDetailedReading(DetailedReading reading) {
        return new MaiHoaResult(method,ruleVersion,ruleBasis,sourceStatus,rules,sourceReferences,decisionReferences,
                calculationSteps,primaryHexagram,mutualHexagram,changedHexagram,movingLine,lunarDate,reading);
    }
}
