package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.knowledge.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class MaiHoaServiceTest {
    static final ObjectMapper MAPPER = new ObjectMapper();
    static final String PAYLOAD = """
        {"method":"LINES","linesBottomUp":[true,false,true,false,true,false],"movingLine":2}
        """;

    static RuleState reviewed(String code, SourceStatus status) {
        int page = code.equals("MH-MUTUAL") ? 42 : 41;
        var source = new SourceReference("MH", "Mai Hoa", "Test edition", "section-" + code,
                String.valueOf(page + 5), page, "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de", null);
        return new RuleState(code, RuleModule.MAI_HOA, "1.0", status, List.of(source), "Test reviewer",
                Instant.parse("2026-10-23T00:00:00Z"));
    }

    static RuleRegistry registry(RuleStateProvider states) throws Exception {
        return new RuleRegistry(RuleCatalog.load(MAPPER), states);
    }

    static List<HexagramRecord> records() {
        String[] codes = {"KHON", "CHAN", "KHAM", "DOAI", "CAN2", "LY", "TON", "CAN"};
        var records = new ArrayList<HexagramRecord>();
        for (int pattern = 0; pattern < 64; pattern++) {
            String upper = codes[pattern >> 3], lower = codes[pattern & 7];
            records.add(new HexagramRecord("H_" + upper + "_" + lower, "Unreviewed title", upper, lower,
                    MaiHoaLinesTest.lines(pattern), "CANONICAL_TITLE", SourceStatus.SOURCE_LOCATED, null, null));
        }
        return records;
    }

    static MaiHoaService readyService(HexagramRepository hexagrams) throws Exception {
        return new MaiHoaService(registry(code -> Optional.of(reviewed(code, SourceStatus.VERIFIED))), hexagrams);
    }

    @Test
    void returnsThreeRealStructuresWithEvidenceAndWithoutUnreviewedNames() throws Exception {
        var result = readyService(MaiHoaServiceTest::records).calculate(MAPPER.readTree(PAYLOAD));
        assertEquals("H_KHAM_LY", result.primaryHexagram().code());
        assertEquals("H_LY_KHAM", result.mutualHexagram().code());
        assertEquals("H_KHAM_CAN", result.changedHexagram().code());
        assertNull(result.primaryHexagram().name());
        assertEquals(SourceStatus.SOURCE_LOCATED, result.primaryHexagram().nameStatus());
        assertEquals(RuleBasis.SOURCE_VERIFIED, result.ruleBasis());
        assertEquals(SourceStatus.VERIFIED, result.sourceStatus());
        assertEquals(List.of("MH-MUTUAL", "MH-CHANGE"), result.rules().stream().map(r -> r.ruleCode()).toList());
        assertEquals(List.of(42, 41), result.sourceReferences().stream().map(SourceReference::pdfPage).toList());
        assertTrue(result.decisionReferences().isEmpty());
        assertNull(result.lunarDate());
        assertEquals(List.of("MUTUAL", "CHANGE"), result.calculationSteps().stream().map(s -> s.code()).toList());
    }

    @Test
    void eitherUnreviewedRulePreventsAllOutputAndSkipsStructureRead() throws Exception {
        for (String blocked : List.of("MH-MUTUAL", "MH-CHANGE")) {
            var called = new AtomicBoolean();
            var registry = registry(code -> Optional.of(reviewed(code,
                    code.equals(blocked) ? SourceStatus.SOURCE_LOCATED : SourceStatus.VERIFIED)));
            var service = new MaiHoaService(registry, () -> { called.set(true); return records(); });
            var error = assertThrows(RuleNotAvailableException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
            assertEquals(blocked, error.ruleCode());
            assertEquals(RuleUnavailableReason.SOURCE_UNVERIFIED, error.reason());
            assertFalse(called.get());
        }
    }

    @Test
    void noDatabaseStateRemainsClosed() throws Exception {
        var service = new MaiHoaService(registry(code -> Optional.empty()), List::of);
        var error = assertThrows(RuleNotAvailableException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
        assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE, error.reason());
    }

    @Test
    void missingOrDuplicatedPatternsCannotProduceCompletedResult() throws Exception {
        var missing = records(); missing.remove(0);
        var duplicated = records(); duplicated.set(0, duplicated.get(1));
        for (var rows : List.of(missing, duplicated)) {
            assertThrows(KnowledgeDataException.class, () -> readyService(() -> rows).calculate(MAPPER.readTree(PAYLOAD)));
        }
    }

    @Test
    void inconsistentTrigramMappingCannotProduceCompletedResult() throws Exception {
        var rows = records();
        var old = rows.get(0);
        rows.set(0, new HexagramRecord("H_CAN_CAN", old.name(), "CAN", "CAN", old.linesBottomUp(),
                old.nameKind(), old.nameStatus(), null, null));
        assertThrows(KnowledgeDataException.class, () -> readyService(() -> rows).calculate(MAPPER.readTree(PAYLOAD)));
    }

    @Test
    void connectionFailureIsNotReportedAsUnverifiedRule() throws Exception {
        var service = readyService(() -> { throw new KnowledgeAccessException(); });
        assertThrows(KnowledgeAccessException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD)));
    }

    @Test
    void timeCannotReuseBookApprovalAsCalendarApproval() throws Exception {
        var service = readyService(MaiHoaServiceTest::records);
        var error = assertThrows(RuleNotAvailableException.class, () -> service.calculate(MAPPER.readTree(
                "{\"method\":\"TIME\",\"datetime\":\"2026-10-24T08:00:00+07:00\"}")));
        assertEquals("LUNAR-CONVERSION", error.ruleCode());
        assertEquals(RuleUnavailableReason.RULE_VERSION_MISMATCH, error.reason());
    }

    @Test
    void serviceAlsoValidatesPayloadWhenCalledOutsideStompController() throws Exception {
        var service = readyService(MaiHoaServiceTest::records);
        assertThrows(ContractException.class, () -> service.calculate(null));
        assertThrows(ContractException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD.replace(":2", ":7"))));
        assertThrows(ContractException.class, () -> service.calculate(MAPPER.readTree(PAYLOAD.replace("true", "1"))));
    }
}
