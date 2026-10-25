package com.huyenco.calendar;

import com.huyenco.common.dto.*;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record CalendarResult(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                             List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                             List<DecisionReference> decisionReferences, String solarDate,
                             LunarDate lunarDate, String timezone) {
    static CalendarResult of(EvidenceSummary e, java.time.LocalDate solar, LunarDate lunar) {
        return new CalendarResult(e.ruleVersion(), e.ruleBasis(), e.sourceStatus(), e.rules(), e.sourceReferences(),
                e.decisionReferences(), solar.toString(), lunar, VietnameseLunarCalendar.ZONE_LABEL);
    }
}
