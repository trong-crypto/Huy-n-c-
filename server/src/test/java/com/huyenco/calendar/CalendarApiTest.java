package com.huyenco.calendar;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.knowledge.*;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class CalendarApiTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String DATE = "{\"calendarType\":\"SOLAR\",\"year\":2024,\"month\":2,\"day\":10,\"isLeapMonth\":false}";
    static RuleState state() {
        return new RuleState("LUNAR-CONVERSION", RuleModule.CALENDAR, "1.0", SourceStatus.VERIFIED,
                List.of(new SourceReference(VietnameseLunarCalendar.SOURCE_ID, "C01 fixed UTC+7", VietnameseLunarCalendar.SOURCE_VERSION,
                        "Moon phase / civil Can Chi", null, null, VietnameseLunarCalendar.DATA_SHA, VietnameseLunarCalendar.SOURCE_URL)),
                "C01 test review", Instant.parse("2026-10-24T00:00:00Z"));
    }
    static CalendarService service(RuleStateProvider provider) throws Exception {
        return new CalendarService(new VietnameseLunarCalendar(), new RuleRegistry(RuleCatalog.load(JSON), provider));
    }
    private MockMvc mvc(RuleStateProvider provider) throws Exception {
        return MockMvcBuilders.standaloneSetup(new CalendarController(service(provider), JSON)).build();
    }

    @Test
    void actualRestSerializationMatchesContractInBothDirections() throws Exception {
        MockMvc mvc = mvc(code -> Optional.of(state()));
        mvc.perform(post("/api/v1/calendar/convert").contentType("application/json").content(DATE))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.requestId").isString()).andExpect(jsonPath("$.error").isEmpty())
                .andExpect(jsonPath("$.data.lunarDate.year").value(2024)).andExpect(jsonPath("$.data.lunarDate.month").value(1))
                .andExpect(jsonPath("$.data.lunarDate.day").value(1)).andExpect(jsonPath("$.data.timezone").value("Asia/Ho_Chi_Minh"))
                .andExpect(jsonPath("$.data.sourceReferences[0].pdfPage").isEmpty()).andExpect(jsonPath("$.data.sourceReferences[0].url").value(VietnameseLunarCalendar.SOURCE_URL));
        mvc.perform(post("/api/v1/calendar/convert").contentType("application/json")
                        .content("{\"calendarType\":\"LUNAR\",\"year\":2023,\"month\":2,\"day\":1,\"isLeapMonth\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.solarDate").value("2023-03-22"));
    }

    @Test
    void malformedWrongTypeExtraFieldsAndDatesFailWithSafeEnvelope() throws Exception {
        MockMvc mvc = mvc(code -> Optional.of(state()));
        for (String input : List.of("{}", "null", "[]", "{", DATE + "{}", DATE.replace("2024", "2024.0"),
                DATE.replace("2024", "999999999999999999999"), DATE.replace("false", "null"),
                DATE.replace("\"day\":10", "\"day\":10,\"day\":11"), DATE.replace("false", "true"),
                DATE.replace("2024", "1900").replace("\"day\":10", "\"day\":29"),
                DATE.replace("2024", "2100"), DATE.replace("false}", "false,\"ownerId\":\"x\"}"), " ".repeat(16001))) {
            mvc.perform(post("/api/v1/calendar/convert").contentType("application/json").content(input))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value("FAILED"))
                    .andExpect(jsonPath("$.data").isEmpty()).andExpect(jsonPath("$.error.ruleCode").isEmpty());
        }
        mvc.perform(post("/api/v1/calendar/convert").contentType("application/json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void missingApprovalOutageAndWrongSnapshotDoNotReturnComputedData() throws Exception {
        mvc(code -> Optional.empty()).perform(post("/api/v1/calendar/convert").contentType("application/json").content(DATE))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.reason").value("RULE_STATE_UNAVAILABLE"))
                .andExpect(jsonPath("$.data").isEmpty());
        mvc(code -> { throw new KnowledgeAccessException(); }).perform(post("/api/v1/calendar/convert").contentType("application/json").content(DATE))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("DATABASE_UNAVAILABLE"));
        var original = state();
        var badSource = new SourceReference(VietnameseLunarCalendar.SOURCE_ID, "Wrong table", "old", "some rule", null, null, "0".repeat(64), VietnameseLunarCalendar.SOURCE_URL);
        mvc(code -> Optional.of(new RuleState(original.ruleCode(), original.module(), original.ruleVersion(), original.sourceStatus(),
                        List.of(badSource), original.reviewer(), original.reviewedAt())))
                .perform(post("/api/v1/calendar/convert").contentType("application/json").content(DATE))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.reason").value("RULE_VERSION_MISMATCH"));
    }

    @Test
    void canChiHasCivilYearMonthDayAndOptionalHour() throws Exception {
        MockMvc mvc = mvc(code -> Optional.of(state()));
        mvc.perform(post("/api/v1/calendar/can-chi").contentType("application/json").content("{\"date\":" + DATE + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.year.stem").value("GIAP"))
                .andExpect(jsonPath("$.data.year.branch").value("THIN"))
                .andExpect(jsonPath("$.data.month.stem").value("BINH")).andExpect(jsonPath("$.data.month.branch").value("DAN"))
                .andExpect(jsonPath("$.data.day.stem").value("GIAP")).andExpect(jsonPath("$.data.day.branch").value("THIN"))
                .andExpect(jsonPath("$.data.hour").isEmpty());
        mvc.perform(post("/api/v1/calendar/can-chi").contentType("application/json").content("{\"date\":" + DATE + ",\"time\":\"23:59\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.hour.stem").value("GIAP")).andExpect(jsonPath("$.data.hour.branch").value("TY"));
        for (String time : List.of("null", "24:00", "1:00", "12:60", "23:00:00")) {
            mvc.perform(post("/api/v1/calendar/can-chi").contentType("application/json")
                    .content("{\"date\":" + DATE + ",\"time\":\"" + time + "\"}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void tetAndMidnightBoundariesUseLunarYearAndCurrentCivilDay() throws Exception {
        var svc = service(code -> Optional.of(state()));
        var before = svc.canChi(new CalendarInput("SOLAR", 2024, 2, 9, false), LocalTime.of(23, 59));
        var after = svc.canChi(new CalendarInput("SOLAR", 2024, 2, 10, false), LocalTime.of(0, 0));
        assertEquals(new CanChiResult.Pair("QUY", "MAO"), before.year());
        assertEquals(new CanChiResult.Pair("GIAP", "THIN"), after.year());
        assertEquals("TY", before.hour().branch()); assertEquals("TY", after.hour().branch());
        assertNotEquals(before.day(), after.day()); assertNotEquals(before.hour().stem(), after.hour().stem());
        var normal = svc.canChi(new CalendarInput("LUNAR", 2023, 2, 1, false), null);
        var leap = svc.canChi(new CalendarInput("LUNAR", 2023, 2, 1, true), null);
        assertEquals(normal.month(), leap.month()); assertNotEquals(normal.solarDate(), leap.solarDate());
    }
}
