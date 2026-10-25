package com.huyenco.calendar;

import com.huyenco.common.dto.EvidenceSummary;
import com.huyenco.common.dto.LunarDate;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.knowledge.RulePurpose;
import com.huyenco.knowledge.RuleRegistry;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {
    private static final String[] STEMS = {"GIAP", "AT", "BINH", "DINH", "MAU", "KY", "CANH", "TAN", "NHAM", "QUY"};
    private static final String[] BRANCHES = {"TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI"};
    private final VietnameseLunarCalendar calendar;
    private final RuleRegistry registry;

    public CalendarService(VietnameseLunarCalendar calendar, RuleRegistry registry) {
        this.calendar = calendar;
        this.registry = registry;
    }

    public CalendarResult convert(CalendarInput input) {
        if (input == null) throw CalendarInput.invalid();
        input.validate();
        LocalDate solar;
        try {
            solar = "SOLAR".equals(input.calendarType()) ? LocalDate.of(input.year(), input.month(), input.day())
                    : calendar.toSolar(new LunarDate(input.year(), input.month(), input.day(), input.isLeapMonth()));
            VietnameseLunarCalendar.requireRange(solar);
        } catch (DateTimeException failure) {
            throw VietnameseLunarCalendar.invalidDate();
        }
        var rule = registry.authorize("LUNAR-CONVERSION", RulePurpose.CALCULATION);
        // DB approval must refer to the exact bundled snapshot, not an unrelated algorithm.
        if (rule.sourceReferences().size() != 1 || !rule.sourceReferences().get(0).sourceId().equals(VietnameseLunarCalendar.SOURCE_ID)
                || !VietnameseLunarCalendar.DATA_SHA.equals(rule.sourceReferences().get(0).sha256())
                || !VietnameseLunarCalendar.SOURCE_VERSION.equals(rule.sourceReferences().get(0).version())
                || !VietnameseLunarCalendar.SOURCE_URL.equals(rule.sourceReferences().get(0).url()))
            throw new RuleNotAvailableException("LUNAR-CONVERSION", RuleUnavailableReason.RULE_VERSION_MISMATCH);
        return CalendarResult.of(EvidenceSummary.from(List.of(rule)), solar, calendar.toLunar(solar));
    }

    public CanChiResult canChi(CalendarInput input, LocalTime time) {
        CalendarResult result = convert(input);
        LunarDate lunar = result.lunarDate();
        // Epoch day 1970-01-01 corresponds to JDN 2440588; JDN is a civil-date integer here.
        long jdn = LocalDate.parse(result.solarDate()).toEpochDay() + 2440588L;
        int dayStem = (int)Math.floorMod(jdn + 9, 10);
        int branch = time == null ? 0 : VietnameseLunarCalendar.hourBranchIndex(time);
        return CanChiResult.of(result, pair(lunar.year() + 6, lunar.year() + 8),
                pair(lunar.year() * 12 + lunar.month() + 3, lunar.month() + 1),
                pair(dayStem, (int)Math.floorMod(jdn + 1, 12)),
                time == null ? null : pair(dayStem * 2 + branch, branch));
    }

    private static CanChiResult.Pair pair(int stem, int branch) {
        return new CanChiResult.Pair(STEMS[Math.floorMod(stem, 10)], BRANCHES[Math.floorMod(branch, 12)]);
    }
}
