package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.knowledge.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class ObjectCountServiceTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String PAYLOAD = "{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":8}";
    // Independent source vectors, indexed by the preheaven number (not binary order).
    private static final int[] PATTERNS = {0, 7, 3, 5, 1, 6, 2, 4, 0};
    private static final String[] CODES = {"", "CAN", "DOAI", "LY", "CHAN", "TON", "KHAM", "CAN2", "KHON"};

    static List<TrigramRecord> trigrams() {
        var result = new ArrayList<TrigramRecord>();
        for (int n = 1; n <= 8; n++) result.add(new TrigramRecord(CODES[n], CODES[n], n, "THO",
                MaiHoaLinesTest.lines(PATTERNS[n]).subList(0, 3)));
        return result;
    }

    private static RuleRegistry registry(String blocked) throws Exception {
        return MaiHoaServiceTest.registry(code -> Optional.of(MaiHoaServiceTest.reviewed(code,
                code.equals(blocked) ? SourceStatus.SOURCE_LOCATED
                        : code.equals("MH-OBJECT-COUNT") ? SourceStatus.SOURCE_AMBIGUOUS : SourceStatus.VERIFIED)));
    }

    private static int bits(List<Boolean> lines) {
        int bits = 0;
        for (int i = 0; i < lines.size(); i++) if (lines.get(i)) bits |= 1 << i;
        return bits;
    }

    @Test
    void completeModuloCycleAllHoursAndExtremeCountsMatchIndependentBitOracle() throws Exception {
        var service = new MaiHoaService(registry(""), MaiHoaServiceTest::records, ObjectCountServiceTest::trigrams);
        var counts = new ArrayList<Integer>();
        for (int n = 1; n <= 24; n++) counts.add(n);
        counts.add(999998); counts.add(999999);
        for (int count : counts) for (int hour = 1; hour <= 12; hour++) {
            var payload = MAPPER.createObjectNode().put("method", "OBJECT_COUNT")
                    .put("objectCount", count).put("hourIndex", hour).put("question", "private-question-sentinel");
            var stages = new ArrayList<Step>();
            var result = service.calculate(payload, (step, message) -> stages.add(step));
            int upper = (count - 1) % 8 + 1, lower = (hour - 1) % 8 + 1, moving = (count + hour - 1) % 6 + 1;
            int pattern = PATTERNS[lower] | (PATTERNS[upper] << 3);
            assertEquals(pattern, bits(result.primaryHexagram().linesBottomUp()), count + "/" + hour);
            assertEquals(((pattern >> 1) & 7) | (((pattern >> 2) & 7) << 3), bits(result.mutualHexagram().linesBottomUp()));
            assertEquals(pattern ^ (1 << (moving - 1)), bits(result.changedHexagram().linesBottomUp()));
            assertEquals("H_" + CODES[upper] + "_" + CODES[lower], result.primaryHexagram().code());
            assertEquals(moving, result.movingLine());
            assertEquals(RuleBasis.TEAM_DECISION, result.ruleBasis());
            assertEquals(SourceStatus.SOURCE_AMBIGUOUS, result.sourceStatus());
            assertEquals(List.of("MH-OBJECT-COUNT", "MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE"),
                    result.rules().stream().map(r -> r.ruleCode()).toList());
            assertEquals("DEC-20261022-MH-OBJECT-COUNT", result.decisionReferences().get(0).decisionId());
            assertEquals(count + hour, result.calculationSteps().get(0).values().get("movingLineSum"));
            assertEquals(List.of(Step.CALCULATING, Step.LOOKUP), stages);
            assertFalse(MAPPER.writeValueAsString(result).contains("private-question-sentinel"));
            assertNull(result.lunarDate());
        }
    }

    @Test
    void eachSourceDependencyMustAuthorizeBeforeReadingAnyTrigramsOrPublishingCalculation() throws Exception {
        for (String blocked : List.of("MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE")) {
            var read = new AtomicBoolean();
            var stages = new ArrayList<Step>();
            var service = new MaiHoaService(registry(blocked), () -> { read.set(true); return List.of(); },
                    () -> { read.set(true); return List.of(); });
            var error = assertThrows(RuleNotAvailableException.class,
                    () -> service.calculate(MAPPER.readTree(PAYLOAD), (step, message) -> stages.add(step)));
            assertEquals(blocked, error.ruleCode());
            assertFalse(read.get()); assertTrue(stages.isEmpty());
        }
        var service = new MaiHoaService(MaiHoaServiceTest.registry(code -> Optional.empty()), List::of, List::of);
        assertThrows(RuleNotAvailableException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
    }

    @Test
    void incompleteOrInconsistentTrigramDataCannotProduceAResult() throws Exception {
        var missing = trigrams(); missing.remove(0);
        var repeatedNumber = trigrams(); var r = repeatedNumber.get(0);
        repeatedNumber.set(0, new TrigramRecord(r.code(), r.name(), 2, r.element(), r.linesBottomUp()));
        var swappedForms = trigrams(); var second = swappedForms.get(1);
        swappedForms.set(0, new TrigramRecord(r.code(), r.name(), 1, r.element(), second.linesBottomUp()));
        swappedForms.set(1, new TrigramRecord(second.code(), second.name(), 2, second.element(), r.linesBottomUp()));
        for (var rows : List.of(missing, repeatedNumber, swappedForms)) {
            var service = new MaiHoaService(registry(""), MaiHoaServiceTest::records, () -> rows);
            assertThrows(KnowledgeDataException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
        }
        var service = new MaiHoaService(registry(""), MaiHoaServiceTest::records, () -> { throw new KnowledgeAccessException(); });
        assertThrows(KnowledgeAccessException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
    }
}
