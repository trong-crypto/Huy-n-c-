package com.huyenco.knowledge;

import com.huyenco.common.dto.RuleEvidence;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import java.util.List;

/** Fails closed unless both execution policy and authoritative source state permit a rule. */
public final class RuleRegistry {
    private final RuleCatalog catalog;
    private final RuleStateProvider states;

    public RuleRegistry(RuleCatalog catalog, RuleStateProvider states) {
        this.catalog = catalog;
        this.states = states;
    }

    public RuleEvidence authorize(String ruleCode, RulePurpose purpose) {
        RuleDefinition rule = catalog.find(ruleCode).orElseThrow(() -> denied(ruleCode, RuleUnavailableReason.UNKNOWN_RULE));
        if (rule.executionPolicy() == ExecutionPolicy.DISABLED) {
            throw denied(ruleCode, RuleUnavailableReason.EXECUTION_DISABLED);
        }
        if (purpose == null) {
            throw new IllegalArgumentException("Rule purpose is required");
        }
        RuleState state = states.find(ruleCode).orElseThrow(() -> denied(ruleCode, RuleUnavailableReason.RULE_STATE_UNAVAILABLE));
        if (!rule.ruleCode().equals(state.ruleCode()) || rule.module() != state.module()
                || !rule.ruleVersion().equals(state.ruleVersion())) {
            throw denied(ruleCode, RuleUnavailableReason.RULE_VERSION_MISMATCH);
        }
        if (state.sourceReferences().isEmpty()
                || state.sourceReferences().stream().anyMatch(source -> !source.hasTraceableLocation())) {
            throw denied(ruleCode, RuleUnavailableReason.MISSING_SOURCE_REFERENCE);
        }
        if (state.sourceStatus() == SourceStatus.VERIFIED
                && (state.reviewer() == null || state.reviewer().isBlank() || state.reviewedAt() == null)) {
            throw denied(ruleCode, RuleUnavailableReason.MISSING_SOURCE_REVIEW);
        }
        RuleBasis basis;
        if (rule.executionPolicy() == ExecutionPolicy.SOURCE_VERIFIED) {
            if (state.sourceStatus() != SourceStatus.VERIFIED) {
                throw denied(ruleCode, RuleUnavailableReason.SOURCE_UNVERIFIED);
            }
            basis = RuleBasis.SOURCE_VERIFIED;
        } else {
            // A team decision permits a calculation convention, never unreviewed interpretations.
            if (purpose == RulePurpose.INTERPRETATION) {
                throw denied(ruleCode, RuleUnavailableReason.TEAM_DECISION_NOT_ALLOWED);
            }
            if (rule.decisionReferences().isEmpty()
                    || rule.decisionReferences().stream().anyMatch(decision -> !decision.isComplete())) {
                throw denied(ruleCode, RuleUnavailableReason.MISSING_DECISION_REFERENCE);
            }
            if (state.sourceStatus() == null || state.sourceStatus() == SourceStatus.DRAFT) {
                throw denied(ruleCode, RuleUnavailableReason.SOURCE_UNVERIFIED);
            }
            basis = RuleBasis.TEAM_DECISION;
        }
        return new RuleEvidence(rule.ruleCode(), rule.ruleVersion(), rule.executionPolicy(), basis,
                state.sourceStatus(), state.sourceReferences(), rule.decisionReferences());
    }

    public List<RuleEvidence> authorizeAll(List<String> ruleCodes, RulePurpose purpose) {
        if (ruleCodes == null || ruleCodes.isEmpty()) {
            throw new IllegalArgumentException("At least one rule is required");
        }
        return ruleCodes.stream().distinct().map(code -> authorize(code, purpose)).toList();
    }

    private static RuleNotAvailableException denied(String code, RuleUnavailableReason reason) {
        return new RuleNotAvailableException(code, reason);
    }
}
