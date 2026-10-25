package com.huyenco.calendar;

import com.huyenco.common.dto.*;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record CanChiResult(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                           List<DecisionReference> decisionReferences, String solarDate,
                           LunarDate lunarDate, String timezone, Pair year, Pair month, Pair day, Pair hour) {
    public record Pair(String stem, String branch) { }

    static CanChiResult of(CalendarResult c, Pair year, Pair month, Pair day, Pair hour) {
        return new CanChiResult(c.ruleVersion(), c.ruleBasis(), c.sourceStatus(), c.rules(), c.sourceReferences(),
                c.decisionReferences(), c.solarDate(), c.lunarDate(), c.timezone(), year, month, day, hour);
    }
}
