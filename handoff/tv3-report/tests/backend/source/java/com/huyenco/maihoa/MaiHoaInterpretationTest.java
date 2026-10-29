package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.calendar.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.dto.DetailedReading.*;
import com.huyenco.common.dto.MaiHoaReadingOptions.Topic;
import com.huyenco.common.exception.*;
import com.huyenco.knowledge.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.junit.jupiter.api.*;

class MaiHoaInterpretationTest {
    static final ObjectMapper MAPPER=new ObjectMapper();
    // Independent directed relation table: rows Body, columns comparator, in KIM/MOC/THUY/HOA/THO order.
    static final Relation[][] EXPECTED={
        {Relation.SAME_ELEMENT,Relation.BODY_CONTROLS_USE,Relation.BODY_GENERATES_USE,Relation.USE_CONTROLS_BODY,Relation.USE_GENERATES_BODY},
        {Relation.USE_CONTROLS_BODY,Relation.SAME_ELEMENT,Relation.USE_GENERATES_BODY,Relation.BODY_GENERATES_USE,Relation.BODY_CONTROLS_USE},
        {Relation.USE_GENERATES_BODY,Relation.BODY_GENERATES_USE,Relation.SAME_ELEMENT,Relation.BODY_CONTROLS_USE,Relation.USE_CONTROLS_BODY},
        {Relation.BODY_CONTROLS_USE,Relation.USE_GENERATES_BODY,Relation.USE_CONTROLS_BODY,Relation.SAME_ELEMENT,Relation.BODY_GENERATES_USE},
        {Relation.BODY_GENERATES_USE,Relation.USE_CONTROLS_BODY,Relation.BODY_CONTROLS_USE,Relation.USE_GENERATES_BODY,Relation.SAME_ELEMENT}};
    static final String[] CODES_BY_BITS={"KHON","CHAN","KHAM","DOAI","CAN2","LY","TON","CAN"};
    static final Element[] ELEMENTS_BY_BITS={Element.THO,Element.MOC,Element.THUY,Element.KIM,Element.THO,Element.HOA,Element.MOC,Element.KIM};

    static List<TrigramRecord> trigrams() {
        int[] bits={7,3,5,1,6,2,4,0};var rows=new ArrayList<TrigramRecord>();
        for(int n=0;n<8;n++) rows.add(new TrigramRecord(CODES_BY_BITS[bits[n]],CODES_BY_BITS[bits[n]],n+1,
                ELEMENTS_BY_BITS[bits[n]].name(),MaiHoaLinesTest.lines(bits[n]).subList(0,3)));
        return rows;
    }
    static RuleRegistry registry() throws Exception {
        return MaiHoaServiceTest.registry(code->{
            var existing=TimeServiceTest.state(code);
            var location=Map.of("MH-TRIGRAM",new String[]{"39","44","MH-QUAI-SO"},"MH-MUTUAL",new String[]{"42","47","MH-QUE-HO-BIEN"},
                    "MH-CHANGE",new String[]{"41","46","MH-HAO-6"}).get(code);
            if(location==null) return Optional.of(existing);
            return Optional.of(new RuleState(code,existing.module(),existing.ruleVersion(),existing.sourceStatus(),
                    List.of(new SourceReference("MH","Mai Hoa Dịch Số","Test review",location[2],location[1],Integer.valueOf(location[0]),ReviewedMaiHoaKnowledge.BOOK_SHA,null)),
                    existing.reviewer(),existing.reviewedAt()));
        });
    }
    static MaiHoaService service(MaiHoaReadingRepository repository) throws Exception {
        var registry=registry();var calendar=new CalendarService(new VietnameseLunarCalendar(),registry);
        var interpreter=new MaiHoaInterpretationService(repository,MAPPER,calendar);
        return new MaiHoaService(registry,MaiHoaServiceTest::records,MaiHoaInterpretationTest::trigrams,calendar,interpreter);
    }
    static ObjectNode request(int pattern,int line,Topic topic) {
        var p=MAPPER.createObjectNode().put("method","LINES").put("movingLine",line);
        var lines=p.putArray("linesBottomUp");for(int bit=0;bit<6;bit++) lines.add((pattern&(1<<bit))!=0);
        p.putObject("reading").put("topic",topic.name());return p;
    }
    @TestFactory java.util.stream.Stream<DynamicTest> all1536StructuresHaveCorrectRolesDirectedPhasesAndReviewedText() throws Exception {
        var snapshot=ReadingTestFixtures.snapshot();var service=service(()->snapshot);
        var templates=new HashMap<String,String>();snapshot.templates().forEach(t->templates.put(t.code(),t.content()));
        return IntStream.range(0,64).boxed().flatMap(pattern->IntStream.rangeClosed(1,6).boxed()
            .flatMap(line->Arrays.stream(Topic.values()).map(topic->DynamicTest.dynamicTest(pattern+"/"+line+"/"+topic,()->{
                var result=service.calculate(request(pattern,line,topic));var reading=result.detailedReading();
                int bodyBits=line<=3?pattern>>3:pattern&7;int useBits=line<=3?pattern&7:pattern>>3;
                int lowerMutual=(pattern>>1)&7,upperMutual=(pattern>>2)&7;
                int changed=pattern^(1<<(line-1));int finalUse=line<=3?changed&7:changed>>3;
                int[] comparatorBits={useBits,line<=3?upperMutual:lowerMutual,line<=3?lowerMutual:upperMutual,finalUse};
                assertEquals(CODES_BY_BITS[bodyBits],reading.body().trigramCode().name());
                assertEquals(line<=3?Side.UPPER:Side.LOWER,reading.body().side());
                assertEquals(ELEMENTS_BY_BITS[bodyBits],reading.body().element());
                for(int i=0;i<4;i++) {
                    var phase=reading.phases().get(i);var expected=EXPECTED[ELEMENTS_BY_BITS[bodyBits].ordinal()][ELEMENTS_BY_BITS[comparatorBits[i]].ordinal()];
                    assertEquals(CODES_BY_BITS[comparatorBits[i]],phase.comparator().trigramCode().name());
                    assertEquals(expected,phase.relation());assertEquals(templates.get("MH-"+topic+"-"+expected),phase.content());
                    assertEquals(RuleBasis.SOURCE_VERIFIED,phase.ruleBasis());assertEquals(SourceStatus.VERIFIED,phase.sourceStatus());
                    assertTrue(phase.sourceReferences().stream().allMatch(SourceReference::hasTraceableLocation));
                }
                assertEquals(SeasonStatus.NOT_EVALUATED,reading.season().status());
                assertEquals(RuleBasis.TEAM_DECISION,result.ruleBasis());assertEquals(SourceStatus.SOURCE_AMBIGUOUS,result.sourceStatus());
                assertEquals(2,reading.calculationDecisions().size());
                assertFalse(reading.summary().contains("%"));
            }))));
    }
    @Test void all25ElementPairsAndAllTwelveMonthGroupsHaveExplicitExpectedResults() {
        for(var body:Element.values()) for(var use:Element.values()) assertEquals(EXPECTED[body.ordinal()][use.ordinal()],MaiHoaInterpretationService.relation(body,use));
        Season[] seasons={Season.SPRING,Season.SPRING,Season.EARTH_MONTH,Season.SUMMER,Season.SUMMER,Season.EARTH_MONTH,
                Season.AUTUMN,Season.AUTUMN,Season.EARTH_MONTH,Season.WINTER,Season.WINTER,Season.EARTH_MONTH};
        for(int month=1;month<=12;month++) assertEquals(seasons[month-1],MaiHoaInterpretationService.season(month));
        assertEquals(Strength.VIGOROUS,MaiHoaInterpretationService.strength(Element.MOC,Season.SPRING));
        assertEquals(Strength.WEAK,MaiHoaInterpretationService.strength(Element.THO,Season.SPRING));
        assertEquals(Strength.UNCLASSIFIED,MaiHoaInterpretationService.strength(Element.KIM,Season.SPRING));
    }
    @Test void knownCachCaseLeapMonthContextAndTimeReuseCalendarWithoutInferringTheQuestion() throws Exception {
        var snapshot=ReadingTestFixtures.snapshot();var service=service(()->snapshot);
        var p=request(29,1,Topic.LOVE);var result=service.calculate(p); // 011101 bottom-first: Ly below Doai.
        assertEquals(List.of(Relation.USE_CONTROLS_BODY,Relation.SAME_ELEMENT,Relation.BODY_CONTROLS_USE,Relation.USE_GENERATES_BODY),
                result.detailedReading().phases().stream().map(Phase::relation).toList());
        var dates=List.of("2024-02-10T09:00:00+07:00","2024-02-10T02:00:00Z","2023-03-22T09:00:00+07:00");
        for(String date:dates) {
            ((ObjectNode)p.get("reading")).putObject("context").put("datetime",date);
            var evaluated=service.calculate(p);assertEquals(SeasonStatus.EVALUATED,evaluated.detailedReading().season().status());
            assertEquals(4,evaluated.detailedReading().calculationDecisions().size());
            if(date.startsWith("2023")) assertTrue(evaluated.detailedReading().season().lunarDate().isLeapMonth());
        }
        var time=MAPPER.createObjectNode().put("method","TIME").put("datetime",dates.get(0)).put("question","private time question");
        time.putObject("reading").put("topic","GENERAL");var calculated=service.calculate(time);
        assertEquals(calculated.lunarDate(),calculated.detailedReading().season().lunarDate());
        assertEquals(1,calculated.rules().stream().filter(r->r.ruleCode().equals("LUNAR-CONVERSION")).count());
        var count=MAPPER.createObjectNode().put("method","OBJECT_COUNT").put("objectCount",12).put("hourIndex",8).put("question","năm sau tình duyên");
        count.putObject("reading").put("topic","WEALTH");var first=service.calculate(count);
        count.put("question","unrelated private text");assertEquals(first,service.calculate(count));
        assertFalse(MAPPER.writeValueAsString(first).contains("unrelated private text"));
    }
    @Test void everyRequestRechecksDatabaseStateAndBadTrigramsFailBeforeCalculation() throws Exception {
        var current=new AtomicReference<>(ReadingTestFixtures.snapshot());var service=service(current::get);
        assertNotNull(service.calculate(request(0,3,Topic.GENERAL)).detailedReading());
        current.set(new MaiHoaReadingRepository.Snapshot(null,List.of()));
        assertThrows(RuleNotAvailableException.class,()->service.calculate(request(0,3,Topic.GENERAL)));
        var snapshot=ReadingTestFixtures.snapshot();var registry=registry();var calendar=new CalendarService(new VietnameseLunarCalendar(),registry);
        var wrong=trigrams();var original=wrong.get(0);wrong.set(0,new TrigramRecord(original.code(),original.name(),1,"MOC",original.linesBottomUp()));
        var bad=new MaiHoaService(registry,MaiHoaServiceTest::records,()->wrong,calendar,new MaiHoaInterpretationService(()->snapshot,MAPPER,calendar));
        var progress=new ArrayList<ProgressEvent.Step>();
        assertThrows(KnowledgeDataException.class,()->bad.calculate(request(0,4,Topic.GENERAL),(step,message)->progress.add(step)));
        assertTrue(progress.isEmpty());
    }
}
