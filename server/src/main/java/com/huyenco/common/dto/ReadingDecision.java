package com.huyenco.common.dto;

import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;
import static com.huyenco.common.dto.ReadingContracts.*;

/** A project convention is not authorization to publish unreviewed interpretation text. */
public record ReadingDecision(String decisionId, Purpose purpose, RuleBasis ruleBasis,
                              SourceStatus sourceStatus, String policy, String description,
                              String limitation, List<SourceReference> sourceReferences) {
    public enum Purpose { CALCULATION, EDITORIAL_LINK }
    public ReadingDecision {
        require(text(decisionId) && purpose != null && ruleBasis == RuleBasis.TEAM_DECISION
                && sourceStatus != null && sourceStatus != SourceStatus.DRAFT
                && text(policy) && text(description) && text(limitation), "A traceable, scoped project decision is required");
        sourceReferences = sources(sourceReferences);
    }
}
