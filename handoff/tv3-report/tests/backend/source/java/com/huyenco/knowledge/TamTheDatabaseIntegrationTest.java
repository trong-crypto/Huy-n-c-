package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import static com.huyenco.tamthe.TamTheKnowledge.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.calendar.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import com.huyenco.config.*;
import com.huyenco.tamthe.*;
import java.util.*;
import java.util.function.UnaryOperator;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

@EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
class TamTheDatabaseIntegrationTest {
    static final ObjectMapper MAPPER=new ObjectMapper();
    static final Set<String> ALL=Set.of(YEAR,CAREER11,CAREER13,WEALTH,LOVE);
    static JdbcKnowledgeRepository repository;
    static RuleCatalog catalog;
    static CalendarService calendar;
    static TamTheSnapshot snapshot;

    @BeforeAll static void load() throws Exception {
        catalog=RuleCatalog.load(MAPPER);
        repository=new JdbcKnowledgeRepository(new JdbcKnowledgeRepositoryTest.Connections(false),catalog);
        calendar=new CalendarService(new VietnameseLunarCalendar(),new RuleRegistry(catalog,repository));
        snapshot=repository.tamThe(ALL);
    }
    static JsonNode input(String date,String type,boolean leap,String... categories) {
        var node=MAPPER.createObjectNode().put("birthDate",date).put("birthTime","08:30")
                .put("calendarType",type).put("isLeapMonth",leap);
        if(categories.length>0) {var list=node.putArray("categories");for(var c:categories)list.add(c);}
        return node;
    }
    static TamTheService service() {return new TamTheService(calendar,repository,catalog);}
    static TamTheSnapshot scope(TamTheSnapshot source,Set<String> codes) {
        var rules=new LinkedHashMap<String,RuleState>();codes.forEach(c->{if(source.rules().containsKey(c))rules.put(c,source.rules().get(c));});
        return new TamTheSnapshot(rules,source.entries().stream().filter(e->codes.contains(e.ruleCode())).toList());
    }
    static TamTheService cached(TamTheSnapshot source) {return new TamTheService(calendar,codes->scope(source,codes),catalog);}
    static List<String> codes(TamTheResult.CategoryResult result) {return result.entries().stream().map(TamTheResult.InterpretationEntry::resultCode).toList();}

    @Test void springWiringAndRealDatabaseReturnAllThreeVerifiedCategories() {
        try(var context=new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("db");
            context.registerBean(ObjectMapper.class,()->MAPPER);
            context.registerBean(DataSource.class,()->new JdbcKnowledgeRepositoryTest.Connections(false));
            context.register(RuleRegistryConfig.class,KnowledgeDatabaseConfig.class,CalendarService.class,VietnameseLunarCalendar.class,TamTheService.class);
            context.refresh();assertEquals(1,context.getBeansOfType(TamTheRepository.class).size());
            var stages=new ArrayList<ProgressEvent.Step>();
            var result=context.getBean(TamTheService.class).calculate(input("2024-02-10","SOLAR",false),(stage,msg)->stages.add(stage));
            assertEquals(List.of(ProgressEvent.Step.CALCULATING,ProgressEvent.Step.LOOKUP),stages);
            assertEquals(List.of(TamTheCategory.CAREER,TamTheCategory.WEALTH,TamTheCategory.LOVE),result.categories().stream().map(TamTheResult.CategoryResult::category).toList());
            assertEquals(List.of("LAM_THO","CAREER13_C01"),codes(result.categories().get(0)));
            assertEquals(List.of("WEALTH_C01","WEALTH_C07"),codes(result.categories().get(1)));
            assertEquals(List.of("LOVE_C01"),codes(result.categories().get(2)));
            assertEquals(RuleBasis.SOURCE_VERIFIED,result.ruleBasis());assertEquals(SourceStatus.VERIFIED,result.sourceStatus());
            assertEquals(List.of("LUNAR-CONVERSION",YEAR,CAREER11,CAREER13,WEALTH,LOVE),result.rules().stream().map(RuleEvidence::ruleCode).toList());
            assertFalse(MAPPER.valueToTree(result).toString().contains("2024-02-10"));
            assertTrue(result.categories().get(1).entries().get(0).content().contains("[CHU_MO]"));
        }
    }

    @Test void commonLoveControlCasesAndMultiPageProvenance() {
        for(var control:List.of(Map.entry(4,"LOVE_C01"),Map.entry(1,"LOVE_C10"))) {
            var result=service().calculate(input("1984-"+String.format(Locale.ROOT,"%02d",control.getKey())+"-01","LUNAR",false,"LOVE"));
            assertEquals(List.of(control.getValue()),codes(result.categories().get(0)));
            if(control.getKey()==1) {
                assertEquals(List.of(64,66,67),result.categories().get(0).entries().get(0).sourceReferences().stream().map(SourceReference::pdfPage).toList());
                assertTrue(result.sourceReferences().stream().anyMatch(s->Integer.valueOf(67).equals(s.pdfPage())));
                assertTrue(result.rules().stream().filter(r->r.ruleCode().equals(LOVE)).findFirst().orElseThrow().sourceReferences().stream().anyMatch(s->Integer.valueOf(67).equals(s.pdfPage())));
            }
        }
        assertEquals(List.of("LOVE_C04"),codes(service().calculate(input("1988-01-01","LUNAR",false,"LOVE")).categories().get(0)));
        assertEquals(List.of("LOVE_C12"),codes(service().calculate(input("2024-12-01","LUNAR",false,"LOVE")).categories().get(0)));
    }

    @Test void careerKeepsAllOccupationsAndPrintedPassageAliases() {
        var result=service().calculate(input("1984-10-01","LUNAR",false,"CAREER"));
        assertEquals(List.of("MUA_BAN","CAU_CHAI","LAM_THO","CAREER13_C10"),codes(result.categories().get(0)));
        assertTrue(result.categories().get(0).entries().get(0).content().startsWith("Bảng Số 11 ghi nghề:"));
        var alias=service().calculate(input("1985-01-01","LUNAR",false,"CAREER")).categories().get(0).entries().stream()
                .filter(e->e.resultCode().equals("CAREER13_C12")).findFirst().orElseThrow();
        assertTrue(alias.title().contains("Thứ Tác"));assertTrue(alias.title().contains("Thủ Tất"));
        assertTrue(alias.content().contains("trồng răng"));
    }

    @Test void missingWealthKeyFailsWholeRequestButDoesNotBlockOtherCategories() {
        var error=assertThrows(RuleNotAvailableException.class,()->service().calculate(input("2024-02-01","LUNAR",false)));
        assertEquals(WEALTH,error.ruleCode());assertEquals(RuleUnavailableReason.LOOKUP_NOT_AVAILABLE,error.reason());
        var result=service().calculate(input("2024-02-01","LUNAR",false,"LOVE","CAREER"));
        assertEquals(List.of(TamTheCategory.LOVE,TamTheCategory.CAREER),result.categories().stream().map(TamTheResult.CategoryResult::category).toList());
        assertFalse(result.rules().stream().anyMatch(r->r.ruleCode().equals(WEALTH)));
    }

    @Test void allSixtyYearKeysAndTwelveMonthsPreserveCoverage() {
        var service=cached(snapshot);int success=0,missing=0;
        for(int year=1984;year<2044;year++) for(int month=1;month<=12;month++) {
            var request=input(String.format(Locale.ROOT,"%04d-%02d-01",year,month),"LUNAR",false);
            try {
                var result=service.calculate(request);success++;
                assertEquals(3,result.categories().size());assertEquals(2,result.categories().get(1).entries().size());
                assertEquals(1,result.categories().get(2).entries().size());
            } catch(RuleNotAvailableException e) {
                assertEquals(WEALTH,e.ruleCode());assertEquals(RuleUnavailableReason.LOOKUP_NOT_AVAILABLE,e.reason());missing++;
            }
        }
        assertEquals(360,success);assertEquals(360,missing);
    }

    @Test void lunarAndSolarInputsLeapMonthAndTetUseTheSameRules() {
        assertEquals(service().calculate(input("2024-02-10","SOLAR",false)),service().calculate(input("2024-01-01","LUNAR",false)));
        assertEquals(service().calculate(input("2023-03-22","SOLAR",false,"LOVE")),service().calculate(input("2023-02-01","LUNAR",true,"LOVE")));
        assertEquals(service().calculate(input("2023-02-01","LUNAR",false,"LOVE")),service().calculate(input("2023-02-01","LUNAR",true,"LOVE")));
        var before=service().calculate(input("2024-02-09","SOLAR",false,"LOVE"));
        assertEquals(List.of("LOVE_C09"),codes(before.categories().get(0)));
        for(var payload:List.of(input("2023-03-01","LUNAR",true,"LOVE"),input("2100-01-01","SOLAR",false,"LOVE"),input("2024-02-30","SOLAR",false,"LOVE")))
            assertEquals("INVALID_DATE",assertThrows(ContractException.class,()->service().calculate(payload)).code());
    }

    static TamTheSnapshot changeFirst(String rule,UnaryOperator<TamTheSnapshot.Entry> change) {
        var entries=new ArrayList<>(snapshot.entries());
        for(int i=0;i<entries.size();i++) if(entries.get(i).ruleCode().equals(rule)) {entries.set(i,change.apply(entries.get(i)));break;}
        return new TamTheSnapshot(snapshot.rules(),entries);
    }
    static TamTheSnapshot.Entry copy(TamTheSnapshot.Entry e,SourceStatus status,String reviewer,String version,List<TamTheSnapshot.Page> pages) {
        return new TamTheSnapshot.Entry(e.ruleCode(),version,e.key(),e.resultCode(),e.title(),e.content(),status,reviewer,e.reviewedAt(),e.verificationNote(),e.tableSource(),e.firstContentSource(),e.tableLabel(),e.contentHeading(),pages);
    }

    @Test void unreviewedEntryCannotBeReleasedEvenWhenItsRuleIsVerified() {
        var altered=changeFirst(LOVE,e->copy(e,SourceStatus.SOURCE_LOCATED,e.reviewer(),e.ruleVersion(),e.contentPages()));
        var error=assertThrows(RuleNotAvailableException.class,()->cached(altered).calculate(input("2024-01-01","LUNAR",false,"LOVE")));
        assertEquals(RuleUnavailableReason.SOURCE_UNVERIFIED,error.reason());
        // A category not requested must not block an independent supported route.
        assertDoesNotThrow(()->cached(altered).calculate(input("2024-01-01","LUNAR",false,"CAREER")));
        var missingReview=cached(changeFirst(YEAR,e->copy(e,e.status(),null,e.ruleVersion(),e.contentPages())));
        assertEquals(RuleUnavailableReason.MISSING_SOURCE_REVIEW,assertThrows(RuleNotAvailableException.class,
                ()->missingReview.calculate(input("2024-01-01","LUNAR",false,"CAREER"))).reason());
    }

    @Test void incompleteTablesWrongVersionsAndMissingContinuationFailClosed() {
        var missing=new TamTheSnapshot(snapshot.rules(),snapshot.entries().subList(1,snapshot.entries().size()));
        assertThrows(KnowledgeDataException.class,()->new TamTheKnowledge(missing,ALL));
        var wrong=changeFirst(LOVE,e->copy(e,e.status(),e.reviewer(),"9.9",e.contentPages()));
        assertThrows(KnowledgeDataException.class,()->new TamTheKnowledge(wrong,ALL));
        var entries=new ArrayList<>(snapshot.entries());
        int index=0;while(entries.get(index).contentPages().size()!=2)index++;
        var e=entries.get(index);entries.set(index,copy(e,e.status(),e.reviewer(),e.ruleVersion(),e.contentPages().subList(0,1)));
        assertThrows(KnowledgeDataException.class,()->new TamTheKnowledge(new TamTheSnapshot(snapshot.rules(),entries),ALL));
        assertThrows(IllegalArgumentException.class,()->repository.tamThe(Set.of("' OR 1=1 --")));
    }

    @Test void jdbcOutageIsSanitizedAndNoRuleStateIsInvented() {
        var failing=new JdbcKnowledgeRepository(new JdbcKnowledgeRepositoryTest.Connections(true),catalog);
        var error=assertThrows(KnowledgeAccessException.class,()->failing.tamThe(ALL));assertNull(error.getCause());
        assertFalse(error.getMessage().contains("sensitive"));
        var empty=cached(new TamTheSnapshot(Map.of(),List.of()));
        assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE,assertThrows(RuleNotAvailableException.class,
                ()->empty.calculate(input("2024-01-01","LUNAR",false,"CAREER"))).reason());
    }
}
