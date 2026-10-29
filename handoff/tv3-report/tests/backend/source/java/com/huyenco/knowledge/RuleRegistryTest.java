package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.DecisionReference;
import com.huyenco.common.dto.EvidenceSummary;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class RuleRegistryTest {
    private static final SourceReference SOURCE = new SourceReference("MH", "Mai Hoa Dịch Số", "PDF scan",
            "MH-QUE-HO-BIEN", "47", 42,
            "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de", null);
    private static final DecisionReference DECISION = new DecisionReference("DEC-20261022-MH-OBJECT-COUNT",
            "2026-10-22", "docs/07-DECISION-LOG.md", "Use original count plus hour, modulo six.");

    private RuleDefinition definition(ExecutionPolicy policy) {
        return new RuleDefinition("TEST-RULE", RuleModule.MAI_HOA, "1.0", policy,
                policy == ExecutionPolicy.TEAM_DECISION ? List.of(DECISION) : List.of());
    }

    private RuleState state(SourceStatus status) {
        return new RuleState("TEST-RULE", RuleModule.MAI_HOA, "1.0", status, List.of(SOURCE),
                "test fixture reviewer", Instant.parse("2026-10-23T00:00:00Z"));
    }

    private RuleRegistry registry(ExecutionPolicy policy, RuleState state) {
        return new RuleRegistry(new RuleCatalog(List.of(definition(policy))), code -> Optional.ofNullable(state));
    }

    private void denied(ExecutionPolicy policy, RuleState state, RulePurpose purpose, RuleUnavailableReason reason) {
        RuleNotAvailableException error = assertThrows(RuleNotAvailableException.class,
                () -> registry(policy, state).authorize("TEST-RULE", purpose));
        assertEquals(reason, error.reason());
        assertEquals("TEST-RULE", error.ruleCode());
    }

    @Test
    void catalogMatchesFourteenExistingRuleCodesAndContainsNoSourceApprovals() throws Exception {
        RuleCatalog catalog = RuleCatalog.load(new ObjectMapper());
        assertEquals(14, catalog.all().size());
        assertEquals(java.util.Set.of("MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE", "MH-TIME", "MH-OBJECT-COUNT",
                "MH-THE-DUNG", "TT-NGU-HANH", "TT-GIO-SINH", "TT-36-PHAN", "TT-CONG-DANH-11",
                "TT-CONG-DANH-13", "TT-TAI-LOC", "TT-TINH-DUYEN", "LUNAR-CONVERSION"),
                catalog.all().stream().map(RuleDefinition::ruleCode).collect(java.util.stream.Collectors.toSet()));
        assertEquals(ExecutionPolicy.SOURCE_VERIFIED, catalog.find("MH-MUTUAL").orElseThrow().executionPolicy());
        assertEquals(ExecutionPolicy.TEAM_DECISION, catalog.find("MH-OBJECT-COUNT").orElseThrow().executionPolicy());
        assertEquals(ExecutionPolicy.SOURCE_VERIFIED, catalog.find("TT-TAI-LOC").orElseThrow().executionPolicy());
        assertEquals(ExecutionPolicy.TEAM_DECISION, catalog.find("TT-GIO-SINH").orElseThrow().executionPolicy());
        assertEquals("DEC-20261025-D02-HOUR-PARTS", catalog.find("TT-GIO-SINH").orElseThrow().decisionReferences().get(0).decisionId());
    }

    @Test
    void sourceVerifiedNeedsCurrentSourceStateAndReview() {
        var proof = registry(ExecutionPolicy.SOURCE_VERIFIED, state(SourceStatus.VERIFIED))
                .authorize("TEST-RULE", RulePurpose.CALCULATION);
        assertEquals(RuleBasis.SOURCE_VERIFIED, proof.ruleBasis());
        denied(ExecutionPolicy.SOURCE_VERIFIED, null, RulePurpose.CALCULATION,
                RuleUnavailableReason.RULE_STATE_UNAVAILABLE);
        denied(ExecutionPolicy.SOURCE_VERIFIED, state(SourceStatus.SOURCE_LOCATED), RulePurpose.CALCULATION,
                RuleUnavailableReason.SOURCE_UNVERIFIED);
        RuleState reviewed = state(SourceStatus.VERIFIED);
        denied(ExecutionPolicy.SOURCE_VERIFIED, new RuleState(reviewed.ruleCode(), reviewed.module(),
                reviewed.ruleVersion(), reviewed.sourceStatus(), reviewed.sourceReferences(), " ", null),
                RulePurpose.CALCULATION, RuleUnavailableReason.MISSING_SOURCE_REVIEW);
    }

    @Test
    void disabledCannotBeEnabledByVerifiedDataAndUnknownCodeFailsClosed() {
        denied(ExecutionPolicy.DISABLED, state(SourceStatus.VERIFIED), RulePurpose.CALCULATION,
                RuleUnavailableReason.EXECUTION_DISABLED);
        var error = assertThrows(RuleNotAvailableException.class,
                () -> registry(ExecutionPolicy.SOURCE_VERIFIED, state(SourceStatus.VERIFIED))
                        .authorize("UNKNOWN", RulePurpose.CALCULATION));
        assertEquals(RuleUnavailableReason.UNKNOWN_RULE, error.reason());
    }

    @Test
    void rejectsMissingSourceAndDifferentRuleVersion() {
        denied(ExecutionPolicy.SOURCE_VERIFIED, new RuleState("TEST-RULE", RuleModule.MAI_HOA, "1.0",
                SourceStatus.VERIFIED, List.of(), "fixture", Instant.now()), RulePurpose.CALCULATION,
                RuleUnavailableReason.MISSING_SOURCE_REFERENCE);
        denied(ExecutionPolicy.SOURCE_VERIFIED, new RuleState("TEST-RULE", RuleModule.MAI_HOA, "2.0",
                SourceStatus.VERIFIED, List.of(SOURCE), "fixture", Instant.now()), RulePurpose.CALCULATION,
                RuleUnavailableReason.RULE_VERSION_MISMATCH);
    }

    @Test
    void teamDecisionPreservesAmbiguousSourceAndNeverAuthorizesInterpretation() {
        var proof = registry(ExecutionPolicy.TEAM_DECISION, state(SourceStatus.SOURCE_AMBIGUOUS))
                .authorize("TEST-RULE", RulePurpose.CALCULATION);
        assertEquals(RuleBasis.TEAM_DECISION, proof.ruleBasis());
        assertEquals(SourceStatus.SOURCE_AMBIGUOUS, proof.sourceStatus());
        assertEquals(List.of(DECISION), proof.decisionReferences());
        denied(ExecutionPolicy.TEAM_DECISION, state(SourceStatus.SOURCE_AMBIGUOUS), RulePurpose.INTERPRETATION,
                RuleUnavailableReason.TEAM_DECISION_NOT_ALLOWED);
        denied(ExecutionPolicy.TEAM_DECISION, state(SourceStatus.DRAFT), RulePurpose.CALCULATION,
                RuleUnavailableReason.SOURCE_UNVERIFIED);
        assertThrows(IllegalArgumentException.class, () -> new RuleDefinition("TEST", RuleModule.MAI_HOA,
                "1.0", ExecutionPolicy.TEAM_DECISION, List.of()));
    }

    @Test
    void summaryCannotHideTeamDecisionBehindVerifiedRules() {
        var verified = registry(ExecutionPolicy.SOURCE_VERIFIED, state(SourceStatus.VERIFIED))
                .authorize("TEST-RULE", RulePurpose.CALCULATION);
        var convention = registry(ExecutionPolicy.TEAM_DECISION, state(SourceStatus.BLOCKED_SOURCE_CONFLICT))
                .authorize("TEST-RULE", RulePurpose.CALCULATION);
        var summary = EvidenceSummary.from(List.of(verified, convention));
        assertEquals(RuleBasis.TEAM_DECISION, summary.ruleBasis());
        assertEquals(SourceStatus.BLOCKED_SOURCE_CONFLICT, summary.sourceStatus());
        assertEquals(1, summary.sourceReferences().size());
        assertEquals(List.of(DECISION), summary.decisionReferences());
        assertThrows(IllegalArgumentException.class, () -> EvidenceSummary.from(List.of()));
    }

    @Test
    void aUrlCannotHideAnInvalidBookPageOrHash() {
        SourceReference bad = new SourceReference("MH", "Mai Hoa", "scan", "page", "47", 42,
                "bad hash", "https://example.test/reference");
        denied(ExecutionPolicy.TEAM_DECISION, new RuleState("TEST-RULE", RuleModule.MAI_HOA, "1.0",
                SourceStatus.SOURCE_AMBIGUOUS, List.of(bad), null, null), RulePurpose.CALCULATION,
                RuleUnavailableReason.MISSING_SOURCE_REFERENCE);
    }

    @Test
    void teamPolicyCannotClaimVerifiedSourceWithoutAReview() {
        denied(ExecutionPolicy.TEAM_DECISION, new RuleState("TEST-RULE", RuleModule.MAI_HOA, "1.0",
                SourceStatus.VERIFIED, List.of(SOURCE), null, null), RulePurpose.CALCULATION,
                RuleUnavailableReason.MISSING_SOURCE_REVIEW);
    }
}
