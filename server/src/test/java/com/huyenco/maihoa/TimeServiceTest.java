package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import com.huyenco.calendar.VietnameseLunarCalendar;
import com.huyenco.common.dto.LunarDate;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.knowledge.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class TimeServiceTest {
    private static final int[] PATTERNS = {0,7,3,5,1,6,2,4,0};
    private static final String[] CODES = {"","CAN","DOAI","LY","CHAN","TON","KHAM","CAN2","KHON"};
    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER = MaiHoaServiceTest.MAPPER;

    static RuleState state(String code) {
        if (!code.equals("LUNAR-CONVERSION")) return MaiHoaServiceTest.reviewed(code,
                SourceStatus.VERIFIED);
        return new RuleState(code, RuleModule.CALENDAR, "1.0", SourceStatus.VERIFIED,
                List.of(new SourceReference(VietnameseLunarCalendar.SOURCE_ID,"C01 fixed UTC+7",VietnameseLunarCalendar.SOURCE_VERSION,
                        "C01 generated table",null,null,VietnameseLunarCalendar.DATA_SHA,VietnameseLunarCalendar.SOURCE_URL)),
                "C01 test reviewer", Instant.parse("2026-10-24T00:00:00Z"));
    }

    static MaiHoaService service() throws Exception {
        return new MaiHoaService(MaiHoaServiceTest.registry(code -> Optional.of(state(code))),
                MaiHoaServiceTest::records, ObjectCountServiceTest::trigrams);
    }

    static com.fasterxml.jackson.databind.JsonNode payload(String datetime) {
        return MAPPER.createObjectNode().put("method","TIME").put("datetime",datetime).put("question","private-time-question");
    }

    private static int bits(List<Boolean> lines) {
        int result=0; for(int i=0;i<lines.size();i++) if(lines.get(i)) result|=1<<i; return result;
    }

    @Test
    void lunarTetHourNumbersGenerateCorrectThreeHexagramsAndFullEvidence() throws Exception {
        var stages=new ArrayList<Step>();
        var result=service().calculate(payload("2024-02-10T00:00:00+07:00"),(step,message)->stages.add(step));
        // Giap Thin year -> 5, lunar month/day 1/1, Ty -> 1: sums 7/8 -> Can/Khon, line2.
        assertEquals(new LunarDate(2024,1,1,false),result.lunarDate());
        assertEquals("H_CAN2_KHON",result.primaryHexagram().code());
        assertEquals("H_KHON_KHON",result.mutualHexagram().code());
        assertEquals("H_CAN2_KHAM",result.changedHexagram().code());
        assertEquals(2,result.movingLine());
        assertEquals(RuleBasis.TEAM_DECISION,result.ruleBasis());
        assertEquals(SourceStatus.VERIFIED,result.sourceStatus());
        assertEquals(List.of("LUNAR-CONVERSION","MH-TIME","MH-TRIGRAM","MH-MUTUAL","MH-CHANGE"),result.rules().stream().map(r->r.ruleCode()).toList());
        assertTrue(result.decisionReferences().stream().anyMatch(d->d.decisionId().equals("DEC-20261022-MH-TIME-MOD6")));
        assertTrue(result.decisionReferences().stream().anyMatch(d->d.decisionId().equals("DEC-20261024-B04-CIVIL-TIME")));
        assertEquals(List.of(Step.CALCULATING,Step.LOOKUP),stages);
        assertFalse(MAPPER.writeValueAsString(result).contains("private-time-question"));
        assertEquals(List.of("TIME_NUMBERS","MUTUAL","CHANGE"),result.calculationSteps().stream().map(s->s.code()).toList());
    }

    @Test
    void equalInstantsNormalizeBeforeCalendarAndRangeChecks() throws Exception {
        var svc=service();
        assertEquals(svc.calculate(payload("2024-02-10T00:00:00+07:00")),svc.calculate(payload("2024-02-09T17:00:00Z")));
        assertEquals(svc.calculate(payload("2024-02-10T01:00:00+08:00")),svc.calculate(payload("2024-02-09T09:00:00-08:00")));
        assertEquals(svc.calculate(payload("1900-01-01T00:00:00+07:00")),svc.calculate(payload("1899-12-31T17:00:00Z")));
        assertEquals(svc.calculate(payload("2099-12-31T23:59:00+07:00")),svc.calculate(payload("2100-01-01T10:59:00+18:00")));
    }

    @Test
    void tetMidnightHourBoundariesAndLeapMonthUseAdoptedCivilConvention() throws Exception {
        var svc=service();
        var before=svc.calculate(payload("2024-02-09T23:59:00+07:00"));
        var after=svc.calculate(payload("2024-02-10T00:00:00+07:00"));
        assertEquals(2023,before.lunarDate().year()); assertEquals(2024,after.lunarDate().year());
        assertEquals(4,before.calculationSteps().get(0).values().get("yearBranchIndex"));
        assertEquals(1,before.calculationSteps().get(0).values().get("hourIndex"));
        assertEquals(1,after.calculationSteps().get(0).values().get("hourIndex"));
        var normal=svc.calculate(payload("2023-02-20T10:00:00+07:00"));
        var leap=svc.calculate(payload("2023-03-22T10:00:00+07:00"));
        assertFalse(normal.lunarDate().isLeapMonth()); assertTrue(leap.lunarDate().isLeapMonth());
        assertEquals(normal.primaryHexagram(),leap.primaryHexagram()); assertEquals(normal.movingLine(),leap.movingLine());
        assertEquals("SAME_MONTH_NUMBER",leap.calculationSteps().get(0).values().get("leapMonthPolicy"));
        for(var entry:List.of(new Object[]{"00:59:59",1},new Object[]{"01:00:00",2},new Object[]{"22:59:59",12},new Object[]{"23:00:00",1})) {
            var r=svc.calculate(payload("2024-02-10T"+entry[0]+"+07:00"));
            assertEquals(entry[1],r.calculationSteps().get(0).values().get("hourIndex"));
        }
    }

    @Test
    void fullTimeArithmeticDomainMatchesBitOracleAndZeroRemainders() {
        for(int year=1;year<=12;year++) for(int month=1;month<=12;month++) for(int day=1;day<=30;day++) for(int hour=1;hour<=12;hour++) {
            var n=MaiHoaNumbers.fromTime(year,month,day,hour);
            int date=year+month+day, total=date+hour;
            assertEquals((date-1)%8+1,n.upperTrigram()); assertEquals((total-1)%8+1,n.lowerTrigram());
            assertEquals((total-1)%6+1,n.movingLine()); assertEquals(date,n.dateSum()); assertEquals(total,n.timeSum());
            int primary=PATTERNS[n.lowerTrigram()]|(PATTERNS[n.upperTrigram()]<<3);
            var lines=MaiHoaLines.calculate(MaiHoaLinesTest.lines(primary),n.movingLine());
            assertEquals(primary,bits(lines.primary()));
            assertEquals(((primary>>1)&7)|(((primary>>2)&7)<<3),bits(lines.mutual()));
            assertEquals(primary^(1<<(n.movingLine()-1)),bits(lines.changed()));
        }
        for(int[] values:List.of(new int[]{0,1,1,1},new int[]{13,1,1,1},new int[]{1,0,1,1},new int[]{1,13,1,1},
                new int[]{1,1,0,1},new int[]{1,1,31,1},new int[]{1,1,1,0},new int[]{1,1,1,13}))
            assertThrows(IllegalArgumentException.class,()->MaiHoaNumbers.fromTime(values[0],values[1],values[2],values[3]));
    }

    @Test
    void allFiveDependenciesGateOutputBeforeTrigramReadOrCalculationProgress() throws Exception {
        for(String blocked:List.of("LUNAR-CONVERSION","MH-TIME","MH-TRIGRAM","MH-MUTUAL","MH-CHANGE")) {
            var read=new AtomicBoolean();var stages=new ArrayList<Step>();
            var svc=new MaiHoaService(MaiHoaServiceTest.registry(code->code.equals(blocked)?Optional.empty():Optional.of(state(code))),
                    ()->{read.set(true);return List.of();},()->{read.set(true);return List.of();});
            var error=assertThrows(RuleNotAvailableException.class,()->svc.calculate(payload("2024-02-10T00:00:00+07:00"),(step,message)->stages.add(step)));
            assertEquals(blocked,error.ruleCode());assertFalse(read.get());assertTrue(stages.isEmpty());
        }
        var badCalendar=new RuleState("LUNAR-CONVERSION",RuleModule.CALENDAR,"1.0",SourceStatus.VERIFIED,
                List.of(new SourceReference(VietnameseLunarCalendar.SOURCE_ID,"Old calendar","old","old",null,null,"0".repeat(64),VietnameseLunarCalendar.SOURCE_URL)),"r",Instant.now());
        var svc=new MaiHoaService(MaiHoaServiceTest.registry(code->Optional.of(code.equals("LUNAR-CONVERSION")?badCalendar:state(code))),List::of,List::of);
        assertThrows(RuleNotAvailableException.class,()->svc.calculate(payload("2024-02-10T00:00:00+07:00")));
    }

    @Test
    void dateErrorsAndIncompleteDataCannotReturnCalculatedOutput() throws Exception {
        var svc=service();
        for(String datetime:List.of("2024-02-30T00:00:00+07:00","2024-01-01T12:00:00","1899-12-31T23:59:59+07:00",
                "2100-01-01T00:00:00+07:00","+999999999-12-31T23:59:59-18:00")) {
            assertEquals("INVALID_DATE",assertThrows(ContractException.class,()->svc.calculate(payload(datetime))).code());
        }
        var missing=new MaiHoaService(MaiHoaServiceTest.registry(code->Optional.of(state(code))),MaiHoaServiceTest::records,List::of);
        assertThrows(KnowledgeDataException.class,()->missing.calculate(payload("2024-02-10T00:00:00+07:00")));
    }
}
