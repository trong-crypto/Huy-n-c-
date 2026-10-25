package com.huyenco.maihoa;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.dto.LunarDate;
import com.huyenco.common.dto.RuleEvidence;
import com.huyenco.calendar.CalendarInput;
import com.huyenco.calendar.CalendarService;
import com.huyenco.calendar.VietnameseLunarCalendar;
import java.time.DateTimeException;
import java.time.OffsetDateTime;
import com.huyenco.common.dto.CalculationStep;
import com.huyenco.common.dto.CalculationProgress;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.dto.EvidenceSummary;
import com.huyenco.common.dto.MaiHoaResult;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.knowledge.HexagramIndex;
import com.huyenco.knowledge.HexagramRepository;
import com.huyenco.knowledge.TrigramRepository;
import com.huyenco.knowledge.TrigramIndex;
import com.huyenco.knowledge.RulePurpose;
import com.huyenco.knowledge.RuleRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class MaiHoaService {
    private final RuleRegistry registry;
    private final HexagramRepository hexagrams;
    private final TrigramRepository trigrams;
    private final CalendarService calendar;

    public MaiHoaService(RuleRegistry registry, HexagramRepository hexagrams) {
        this(registry, hexagrams, java.util.List::of);
    }

    public MaiHoaService(RuleRegistry registry, HexagramRepository hexagrams, TrigramRepository trigrams) {
        this(registry, hexagrams, trigrams, new CalendarService(new VietnameseLunarCalendar(), registry));
    }

    @Autowired
    public MaiHoaService(RuleRegistry registry, HexagramRepository hexagrams, TrigramRepository trigrams, CalendarService calendar) {
        this.registry = registry;
        this.hexagrams = hexagrams;
        this.trigrams = trigrams;
        this.calendar = calendar;
    }

    public MaiHoaResult calculate(JsonNode payload) {
        return calculate(payload, CalculationProgress.NONE);
    }

    public MaiHoaResult calculate(JsonNode payload, CalculationProgress progress) {
        ContractValidator.validateMaiHoa(payload);
        String method = payload.path("method").asText();
        if ("LINES".equals(method) || "OBJECT_COUNT".equals(method) || "TIME".equals(method)) {
            boolean objectCount = "OBJECT_COUNT".equals(method);
            boolean time = "TIME".equals(method);
            LunarDate lunarDate = null;
            int hourIndex = 0;
            var rules = new ArrayList<RuleEvidence>();
            if (time) {
                OffsetDateTime local;
                try { local = OffsetDateTime.parse(payload.get("datetime").textValue()).withOffsetSameInstant(VietnameseLunarCalendar.OFFSET); }
                catch (DateTimeException failure) { throw new ContractException("INVALID_DATE", "datetime không thể chuẩn hóa về UTC+7."); }
                var converted = calendar.convert(new CalendarInput("SOLAR", local.getYear(), local.getMonthValue(), local.getDayOfMonth(), false));
                lunarDate = converted.lunarDate();
                hourIndex = VietnameseLunarCalendar.hourBranchIndex(local.toLocalTime()) + 1;
                rules.addAll(converted.rules());
            }
            rules.addAll(registry.authorizeAll(time ? List.of("MH-TIME", "MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE")
                    : objectCount ? List.of("MH-OBJECT-COUNT", "MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE")
                    : List.of("MH-MUTUAL", "MH-CHANGE"), RulePurpose.CALCULATION));
            var evidence = EvidenceSummary.from(rules);
            // All five TIME source gates finish before trigram/hexagram reads or CALCULATING.
            var trigramIndex = objectCount || time ? new TrigramIndex(trigrams.trigrams()) : null;
            var input = new ArrayList<Boolean>();
            var steps = new ArrayList<CalculationStep>();
            int movingLine;
            progress.report(Step.CALCULATING, "Đang tính quẻ chủ, quẻ hỗ và quẻ biến.");
            if (time) {
                int yearBranchIndex = Math.floorMod(lunarDate.year() + 8, 12) + 1;
                var numbers = MaiHoaNumbers.fromTime(yearBranchIndex, lunarDate.month(), lunarDate.day(), hourIndex);
                input.addAll(trigramIndex.find(numbers.lowerTrigram()).linesBottomUp());
                input.addAll(trigramIndex.find(numbers.upperTrigram()).linesBottomUp());
                movingLine = numbers.movingLine();
                steps.add(new CalculationStep("TIME_NUMBERS",
                        "Theo quy ước nhóm: năm/tháng/ngày âm lấy thượng quái; thêm giờ Chi lấy hạ quái, tổng chia 6 lấy hào.",
                        Map.ofEntries(Map.entry("lunarYear", lunarDate.year()), Map.entry("lunarMonth", lunarDate.month()),
                                Map.entry("lunarDay", lunarDate.day()), Map.entry("isLeapMonth", lunarDate.isLeapMonth()),
                                Map.entry("yearBranchIndex", yearBranchIndex), Map.entry("hourIndex", hourIndex),
                                Map.entry("dateSum", numbers.dateSum()), Map.entry("timeSum", numbers.timeSum()),
                                Map.entry("upperTrigram", numbers.upperTrigram()), Map.entry("lowerTrigram", numbers.lowerTrigram()),
                                Map.entry("movingLine", movingLine), Map.entry("utcOffset", "+07:00"),
                                Map.entry("dayBoundary", "00:00"), Map.entry("leapMonthPolicy", "SAME_MONTH_NUMBER"))));
            } else if (objectCount) {
                int count = payload.get("objectCount").intValue(), hour = payload.get("hourIndex").intValue();
                var numbers = MaiHoaNumbers.fromObjectCount(count, hour);
                input.addAll(trigramIndex.find(numbers.lowerTrigram()).linesBottomUp());
                input.addAll(trigramIndex.find(numbers.upperTrigram()).linesBottomUp());
                movingLine = numbers.movingLine();
                steps.add(new CalculationStep("OBJECT_COUNT_NUMBERS",
                        "Số vật lấy thượng quái, chỉ số giờ lấy hạ quái; tổng số gốc chia 6 lấy hào theo quy ước nhóm.",
                        Map.of("objectCount", count, "hourIndex", hour, "movingLineSum", count + hour,
                                "upperTrigram", numbers.upperTrigram(), "lowerTrigram", numbers.lowerTrigram(),
                                "movingLine", movingLine)));
            } else {
                payload.get("linesBottomUp").forEach(line -> input.add(line.booleanValue()));
                movingLine = payload.get("movingLine").intValue();
            }
            var calculation = MaiHoaLines.calculate(input, movingLine);
            progress.report(Step.LOOKUP, "Đang tra mã quẻ và tên đã duyệt trong dữ liệu nguồn.");
            var records = hexagrams.hexagrams();
            var index = new HexagramIndex(records);
            if (trigramIndex != null) trigramIndex.validateHexagrams(records);
            steps.addAll(List.of(
                    new CalculationStep("MUTUAL", "Hỗ hạ lấy hào 2–4; hỗ thượng lấy hào 3–5.",
                            Map.of("lowerLineStart", 2, "upperLineStart", 3)),
                    new CalculationStep("CHANGE", "Đảo duy nhất hào động tính từ dưới lên.",
                            Map.of("movingLine", calculation.movingLine()))));
            return MaiHoaResult.of(method, evidence, steps,
                    index.find(calculation.primary()).toCalculationView(),
                    index.find(calculation.mutual()).toCalculationView(),
                    index.find(calculation.changed()).toCalculationView(), calculation.movingLine(), lunarDate);
        }
        throw new RuleNotAvailableException("MH-UNKNOWN");
    }
}

