package com.huyenco.knowledge;

import com.huyenco.common.dto.SourceReference;
import java.time.Instant;
import java.util.List;

/** State read from the source repository, separately from execution configuration. */
public record RuleState(String ruleCode, RuleModule module, String ruleVersion, SourceStatus sourceStatus,
                        List<SourceReference> sourceReferences, String reviewer, Instant reviewedAt) {
    public RuleState {
        sourceReferences = sourceReferences == null ? List.of() : List.copyOf(sourceReferences);
    }
}
