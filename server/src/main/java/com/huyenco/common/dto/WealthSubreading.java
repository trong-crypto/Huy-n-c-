package com.huyenco.common.dto;

import java.util.List;
import static com.huyenco.common.dto.ReadingContracts.*;

public record WealthSubreading(Code code, Status status, String ruleCode, String lookupKey,
                               List<TamTheResult.InterpretationEntry> entries, Reason reason,
                               List<SourceReference> sourceReferences, List<ReadingDecision> decisionReferences) {
    public enum Code { LOC, SANG_HEN, DIEN_SAN }
    public enum Status { MATCHED, NO_SOURCE_MATCH }
    public enum Reason { NO_PRINTED_INTERSECTION }
    public WealthSubreading {
        require(code != null && status != null && text(ruleCode) && text(lookupKey)
                && entries != null && decisionReferences != null, "Incomplete wealth subreading");
        String expectedRule = switch(code) { case LOC -> "TT-TAI-LOC"; case SANG_HEN -> "TT-SANG-HEN"; case DIEN_SAN -> "TT-DIEN-SAN"; };
        require(expectedRule.equals(ruleCode), "Subreading must retain its own source rule");
        if (status == Status.NO_SOURCE_MATCH) {
            require(code == Code.LOC && entries.isEmpty() && reason == Reason.NO_PRINTED_INTERSECTION,
                    "Only missing printed Loc intersections may have no content");
        } else {
            require(!entries.isEmpty() && reason == null && entries.stream().allMatch(e -> e != null && e.subreadingCode() == code),
                    "Matched content must identify its subreading");
        }
        entries = List.copyOf(entries);
        sourceReferences = sources(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
    }
}
