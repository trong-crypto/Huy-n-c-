package com.huyenco.common.validation;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.MaiHoaResult;
import com.huyenco.common.dto.ProgressEvent;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContractExamplesTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private JsonNode example(String filename) throws Exception {
        return MAPPER.readTree(Path.of("..", "docs", "examples", filename).toFile());
    }

    @Test
    void capturedCalendarFixturesMatchJavaDtosAndRealInputValidation() throws Exception {
        var convert = example("calendar-convert.response.json").get("data");
        var result = MAPPER.treeToValue(convert, com.huyenco.calendar.CalendarResult.class);
        assertEquals(convert, MAPPER.valueToTree(result));
        assertEquals("2000-01-01", result.solarDate());
        assertEquals(1999, result.lunarDate().year());
        var can = example("calendar-can-chi.response.json").get("data");
        var canResult = MAPPER.treeToValue(can, com.huyenco.calendar.CanChiResult.class);
        assertEquals(can, MAPPER.valueToTree(canResult));
        assertEquals("GIAP", canResult.hour().stem());
        assertDoesNotThrow(() -> com.huyenco.calendar.CalendarInput.parse(example("calendar-can-chi.request.json").get("date")));
        assertEquals("INVALID_DATE", example("calendar-invalid-date.response.json").path("error").path("code").asText());
        for(String name:List.of("tam-the","tam-the-career","tam-the-wealth","tam-the-love")) {
            var body=example(name+".response.json").get("data");
            var tamThe=MAPPER.treeToValue(body,com.huyenco.common.dto.TamTheResult.class);
            assertEquals(body,MAPPER.valueToTree(tamThe));
            assertEquals(RuleBasis.SOURCE_VERIFIED,tamThe.ruleBasis());
            assertEquals(SourceStatus.VERIFIED,tamThe.sourceStatus());
            assertTrue(tamThe.categories().stream().allMatch(c->!c.entries().isEmpty()));
        }
    }

    @Test
    void timeFixtureKeepsCalendarEvidenceAndUnresolvedBookConflict() throws Exception {
        var response = example("mai-hoa-time.response.json");
        var result = MAPPER.treeToValue(response.get("data"), MaiHoaResult.class);
        assertEquals(response.get("data"),MAPPER.valueToTree(result));
        assertEquals("TIME",result.method());
        assertEquals(RuleBasis.TEAM_DECISION,result.ruleBasis());
        assertEquals(SourceStatus.VERIFIED,result.sourceStatus());
        assertEquals("C01-VN-FIXED7",result.sourceReferences().get(0).sourceId());
        assertEquals(2024,result.lunarDate().year());
        assertEquals(2,result.movingLine());
    }

    @Test
    void allStompRequestsFollowTheActualValidator() throws Exception {
        for (String name : List.of("mai-hoa-lines", "mai-hoa-object-count", "mai-hoa-time", "tam-the", "tam-the-career", "tam-the-wealth", "tam-the-love", "tam-the-no-match")) {
            JsonNode request = example(name + ".request.json");
            assertDoesNotThrow(() -> ContractValidator.validate(request, request.path("type").asText()), name);
        }
    }

    @Test
    void linesResponseDeserializesToDtoAndHasCorrectOrientation() throws Exception {
        JsonNode response = example("mai-hoa-lines.response.json");
        MaiHoaResult result = MAPPER.treeToValue(response.get("data"), MaiHoaResult.class);
        assertEquals(RuleBasis.SOURCE_VERIFIED, result.ruleBasis());
        assertEquals(List.of(false, true, false, true, false, true), result.mutualHexagram().linesBottomUp());
        assertEquals(List.of(true, true, true, false, true, false), result.changedHexagram().linesBottomUp());
        assertEquals("Ký tế", result.primaryHexagram().name());
        assertEquals(response.get("data"), MAPPER.valueToTree(result));
    }

    @Test
    void objectCountFixturePreservesDecisionAndUnverifiedSourceStatus() throws Exception {
        JsonNode response = example("mai-hoa-object-count.response.json");
        MaiHoaResult result = MAPPER.treeToValue(response.get("data"), MaiHoaResult.class);
        assertEquals(RuleBasis.TEAM_DECISION, result.ruleBasis());
        assertEquals(SourceStatus.SOURCE_AMBIGUOUS, result.sourceStatus());
        assertFalse(result.decisionReferences().isEmpty());
        assertEquals(List.of(false, false, false, true, false, false), result.primaryHexagram().linesBottomUp());
        assertEquals(List.of(false, true, false, true, false, false), result.changedHexagram().linesBottomUp());
        assertEquals("Dự", result.primaryHexagram().name());
        assertEquals(response.get("data"), MAPPER.valueToTree(result));
        assertFalse(MAPPER.valueToTree(result.decisionReferences().get(0)).has("complete"));
    }

    @Test
    void progressIsSeparateFromTerminalEnvelopeAndErrorsAreExplicit() throws Exception {
        JsonNode progress = example("calculation.progress.json");
        ProgressEvent event = MAPPER.treeToValue(progress, ProgressEvent.class);
        assertEquals(1, event.sequence());
        assertFalse(progress.has("status"));
        for (String name : List.of("rule-not-available.response.json", "tam-the-unavailable.response.json")) {
            JsonNode failed = example(name);
            assertTrue(failed.get("data").isNull());
            assertEquals("FAILED", failed.path("status").asText());
            assertEquals("RULE_NOT_AVAILABLE", failed.path("error").path("code").asText());
            assertTrue(failed.path("error").path("reason").isTextual());
        }
        assertEquals("TT-TAI-LOC",example("tam-the-unavailable.response.json").path("error").path("ruleCode").asText());
        assertEquals("LOOKUP_NOT_AVAILABLE",example("tam-the-unavailable.response.json").path("error").path("reason").asText());
    }
}
