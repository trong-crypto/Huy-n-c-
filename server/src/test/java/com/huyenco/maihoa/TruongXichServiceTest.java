package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.knowledge.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class TruongXichServiceTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String RULE = "MH-TRUONG-XICH";

    @Test
    void missingSourceStateBlocksBeforeReadingTrigramsOrCalculating() throws Exception {
        var registry = MaiHoaServiceTest.registry(code -> Optional.empty());
        var service = new MaiHoaService(registry, () -> fail("Must not read hexagrams"), () -> fail("Must not read trigrams"));
        var error = assertThrows(RuleNotAvailableException.class, () ->
                service.calculate(payload(2, 4), (step, message) -> fail("Must not emit calculation progress")));
        assertEquals(RULE, error.ruleCode());
        assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE, error.reason());
    }

    @ParameterizedTest
    @CsvSource({
        "2, 4, 6, H_DOAI_CHAN, H_TON_CAN2, H_CAN_CHAN",
        "8, 8, 4, H_KHON_KHON, H_KHON_KHON, H_CHAN_KHON",
        "1, 0, 1, H_CAN_KHON, H_TON_CAN2, H_CAN_CHAN",
        "9, 5, 2, H_CAN_TON, H_CAN_CAN, H_CAN_CAN2",
        "999999, 9, 6, H_CAN2_CAN, H_CHAN_DOAI, H_KHON_CAN",
        "24, 0, 6, H_KHON_KHON, H_KHON_KHON, H_CAN2_KHON"
    })
    void matchesReferenceCasesUsingApprovedCatalog(int truong, int thuoc, int line,
            String primary, String mutual, String changed) throws Exception {
        var source = new SourceReference("MH", "Mai Hoa", "Test edition", RULE, "61", 56,
                "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de", null);
        var registry = MaiHoaServiceTest.registry(code -> Optional.of(RULE.equals(code)
                ? new RuleState(RULE, RuleModule.MAI_HOA, "1.0", SourceStatus.SOURCE_LOCATED, List.of(source), null, null)
                : MaiHoaServiceTest.reviewed(code, SourceStatus.VERIFIED)));
        var service = new MaiHoaService(registry, MaiHoaServiceTest::records, ObjectCountServiceTest::trigrams);
        var progress = new ArrayList<Step>();
        var result = service.calculate(payload(truong, thuoc), (step, message) -> progress.add(step));
        assertEquals(List.of(Step.CALCULATING, Step.LOOKUP), progress);
        assertEquals(List.of("TRUONG_XICH_NUMBERS", "MUTUAL", "CHANGE"),
                result.calculationSteps().stream().map(step -> step.code()).toList());
        assertEquals(truong + thuoc, result.calculationSteps().get(0).values().get("movingLineSum"));
        assertEquals(primary, result.primaryHexagram().code());
        assertEquals(mutual, result.mutualHexagram().code());
        assertEquals(changed, result.changedHexagram().code());
        assertEquals(line, result.movingLine());
        assertEquals(RuleBasis.TEAM_DECISION, result.ruleBasis());
        assertEquals(SourceStatus.SOURCE_LOCATED, result.sourceStatus());
        assertEquals(List.of("DEC-20261108-MH-TRUONG-XICH"),
                result.decisionReferences().stream().map(decision -> decision.decisionId()).toList());
        assertTrue(result.sourceReferences().contains(source));
        assertNull(result.lunarDate());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "\"truong\":0,\"thuoc\":4", "\"truong\":1000000,\"thuoc\":4",
        "\"truong\":2,\"thuoc\":-1", "\"truong\":2,\"thuoc\":10", "\"truong\":2,\"thuoc\":1.5",
        "\"truong\":\"2\",\"thuoc\":4", "\"truong\":2", "\"truong\":2,\"thuoc\":null",
        "\"truong\":2,\"thuoc\":4,\"hourIndex\":8"
    })
    void rejectsInvalidFieldsBeforeAccessingRuleOrData(String fields) throws Exception {
        var registry = new RuleRegistry(new RuleCatalog(List.of()), code -> fail("Must validate first"));
        var service = new MaiHoaService(registry, () -> fail("Must not read hexagrams"), () -> fail("Must not read trigrams"));
        var error = assertThrows(ContractException.class,
                () -> service.calculate(MAPPER.readTree("{\"method\":\"TRUONG_XICH\"," + fields + "}")));
        assertEquals("INVALID_INPUT", error.code());
    }

    private static com.fasterxml.jackson.databind.JsonNode payload(int truong, int thuoc) {
        return MAPPER.createObjectNode().put("method", "TRUONG_XICH").put("truong", truong).put("thuoc", thuoc);
    }
}
