package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.calendar.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import com.huyenco.history.*;
import com.huyenco.tamthe.*;
import java.lang.reflect.Proxy;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named="HUYENCO_M02_DB_URL",matches=".+")
class TamTheExtendedDatabaseTest {
    @BeforeAll static void open() throws Exception { MaiHoaReadingDatabaseTest.openPool(); }
    @AfterAll static void close() throws Exception { MaiHoaReadingDatabaseTest.closePool(); }
    final ObjectMapper mapper=new ObjectMapper();
    final DataSource source=new JdbcKnowledgeRepositoryTest.Connections(false) {
        @Override public Connection getConnection() throws SQLException { return MaiHoaReadingDatabaseTest.actualConnection(); }
    };
    TamTheService service(DataSource data) throws Exception {
        var catalog=RuleCatalog.load(mapper);var core=new JdbcKnowledgeRepository(data,catalog);
        var calendar=new CalendarService(new VietnameseLunarCalendar(),new RuleRegistry(catalog,core));
        return new TamTheService(calendar,core,catalog,new JdbcTamTheExtendedRepository(data,catalog,mapper),mapper);
    }
    ObjectNode input(String date,String type,boolean leap,String... categories) {
        var input=mapper.createObjectNode().put("birthDate",date).put("birthTime","08:30").put("calendarType",type)
                .put("isLeapMonth",leap).put("wealthMode","EXTENDED");
        if(categories.length>0) { var list=input.putArray("categories");for(String category:categories)list.add(category); }
        return input;
    }
    @Test void all720YearMonthsReturnThreeCategoriesAndKeep360MissingLocIntersectionsHonest() throws Exception {
        var app=service(source);var approved=ReadingTestFixtures.snapshot().bundle().document();
        var elements=Files.readAllLines(Path.of("../data/tam_the_year_elements.csv")).subList(1,61).stream().map(row->row.split(",")).toList();
        int matched=0,missing=0;var sangSeen=new HashSet<String>();var landSeen=new HashSet<String>();
        for(int year=1984;year<2044;year++) for(int month=1;month<=12;month++) {
            var stage=new ArrayList<ProgressEvent.Step>();
            var result=app.calculate(input(String.format(Locale.ROOT,"%04d-%02d-01",year,month),"LUNAR",false),(step,message)->stage.add(step));
            assertEquals(List.of(ProgressEvent.Step.CALCULATING,ProgressEvent.Step.LOOKUP),stage);
            assertEquals(List.of(TamTheCategory.CAREER,TamTheCategory.WEALTH,TamTheCategory.LOVE),result.categories().stream().map(TamTheResult.CategoryResult::category).toList());
            assertEquals(TamTheResult.WealthMode.EXTENDED,result.coverageMode());assertEquals(ReviewedTamTheWealth.BUNDLE_ID,result.bundleId());
            var subs=result.categories().get(1).subreadings();
            assertEquals(List.of(WealthSubreading.Code.LOC,WealthSubreading.Code.SANG_HEN,WealthSubreading.Code.DIEN_SAN),subs.stream().map(WealthSubreading::code).toList());
            var cycle=elements.get(year-1984);String suffix=String.format(Locale.ROOT,"%02d",month);
            assertEquals("STEM:"+cycle[1]+"|MONTH:"+suffix,subs.get(0).lookupKey());
            assertEquals("BRANCH:"+cycle[2]+"|MONTH:"+suffix,subs.get(1).lookupKey());
            assertEquals("ELEMENT:"+cycle[3]+"|MONTH:"+suffix,subs.get(2).lookupKey());
            if(month%2==(year-1984+1)%2) { matched++;assertEquals(WealthSubreading.Status.MATCHED,subs.get(0).status());assertEquals(2,subs.get(0).entries().size()); }
            else {missing++;assertEquals(WealthSubreading.Status.NO_SOURCE_MATCH,subs.get(0).status());assertEquals(WealthSubreading.Reason.NO_PRINTED_INTERSECTION,subs.get(0).reason());assertTrue(subs.get(0).entries().isEmpty());}
            for(var sub:subs.subList(1,3)) {
                var row=approved.path("tamTheMappings").valueStream().filter(r->r.path("ruleCode").asText().equals(sub.ruleCode())
                        && r.path("lookupKey").asText().equals(sub.lookupKey())).findFirst().orElseThrow();
                var expected=approved.path("tamTheResults").valueStream().filter(r->r.path("code").asText().equals(row.path("resultCode").asText())).findFirst().orElseThrow();
                assertEquals(expected.path("code").asText(),sub.entries().get(0).resultCode());
                assertEquals(expected.path("content").asText(),sub.entries().get(0).content());
                assertEquals(expected.path("title").asText(),sub.entries().get(0).title());
                assertTrue(result.editorialDecisions().containsAll(sub.decisionReferences()));
                assertTrue(sub.sourceReferences().stream().allMatch(s->s.sha256().equals(ReviewedTamTheWealth.BOOK_SHA)));
            }
            sangSeen.add(subs.get(1).entries().get(0).resultCode());landSeen.add(subs.get(2).entries().get(0).resultCode());
            assertEquals(subs.stream().flatMap(sub->sub.entries().stream()).toList(),result.categories().get(1).entries());
            assertEquals(RuleBasis.SOURCE_VERIFIED,result.ruleBasis());assertEquals(SourceStatus.VERIFIED,result.sourceStatus());
            assertTrue(result.editorialDecisions().stream().allMatch(d->d.ruleBasis()==RuleBasis.TEAM_DECISION && d.sourceStatus()==SourceStatus.SOURCE_AMBIGUOUS));
            assertEquals(1,result.categories().get(2).entries().size());
            assertEquals(mapper.valueToTree(result),mapper.valueToTree(mapper.treeToValue(mapper.valueToTree(result),TamTheResult.class)));
        }
        assertEquals(360,matched);assertEquals(360,missing);assertEquals(12,sangSeen.size());assertEquals(7,landSeen.size());
    }
    @Test void legacyJsonCalendarBoundariesCategoryOrderAndBirthTimeRemainCompatible() throws Exception {
        var app=service(source);
        for(String name:List.of("tam-the-career","tam-the-wealth","tam-the-love")) {
            var request=mapper.readTree(Path.of("../docs/examples/"+name+".request.json").toFile()).get("payload");
            assertEquals(mapper.readTree(Path.of("../docs/examples/"+name+".response.json").toFile()).get("data"),mapper.valueToTree(app.calculate(request)));
        }
        var missing=input("2024-02-01","LUNAR",false);missing.remove("wealthMode");
        assertEquals(RuleUnavailableReason.LOOKUP_NOT_AVAILABLE,assertThrows(RuleNotAvailableException.class,()->app.calculate(missing)).reason());
        var explicit=missing.deepCopy().put("wealthMode","LEGACY");
        assertEquals(RuleUnavailableReason.LOOKUP_NOT_AVAILABLE,assertThrows(RuleNotAvailableException.class,()->app.calculate(explicit)).reason());
        assertEquals(app.calculate(input("2024-02-10","SOLAR",false)),app.calculate(input("2024-01-01","LUNAR",false)));
        assertEquals(app.calculate(input("2023-03-22","SOLAR",false)),app.calculate(input("2023-02-01","LUNAR",true)));
        assertEquals(app.calculate(input("2023-02-01","LUNAR",false)),app.calculate(input("2023-02-01","LUNAR",true)));
        assertNotNull(app.calculate(input("1900-01-01","SOLAR",false)));
        assertNotNull(app.calculate(input("2099-12-31","SOLAR",false)));
        assertNotEquals(app.calculate(input("2024-02-09","SOLAR",false)),app.calculate(input("2024-02-10","SOLAR",false)));
        var ordered=input("2024-02-01","LUNAR",false,"LOVE","WEALTH","CAREER");
        assertEquals(List.of(TamTheCategory.LOVE,TamTheCategory.WEALTH,TamTheCategory.CAREER),app.calculate(ordered).categories().stream().map(TamTheResult.CategoryResult::category).toList());
        assertEquals(app.calculate(ordered),app.calculate(ordered.deepCopy().put("birthTime","23:59")));
        assertEquals(1,app.calculate(input("2024-02-01","LUNAR",false,"WEALTH")).categories().size());
        assertThrows(ContractException.class,()->app.calculate(input("2023-03-01","LUNAR",true)));
        assertThrows(ContractException.class,()->app.calculate(input("2100-01-01","SOLAR",false)));
        assertThrows(ContractException.class,()->app.calculate(input("2024-01-01","LUNAR",false,"CAREER")));
        var control=app.calculate(input("1984-01-01","LUNAR",false));
        var land=control.categories().get(1).subreadings().get(2);
        assertEquals("Phú / Phá",land.entries().get(0).title());assertEquals(2,land.decisionReferences().size());
    }
    @Test void freshSnapshotBlocksSourceAndMappingChangesBeforeCalculationThenRollsBack() throws Exception {
        var mutations=List.of(
                "UPDATE reading_source_bundles SET document_sha256=repeat('0',64)",
                "UPDATE reading_source_bundles SET reviewer='changed'",
                "UPDATE reading_source_bundles SET reviewed_at=reviewed_at+interval '1 second'",
                "UPDATE reading_source_bundles SET reviewed_document=jsonb_set(reviewed_document,'{decisions,4,basis}','\"SOURCE_VERIFIED\"')",
                "DELETE FROM tam_the_supplement_mappings WHERE rule_code='TT-SANG-HEN' AND lookup_key='BRANCH:TY|MONTH:01'",
                "UPDATE tam_the_supplement_mappings SET result_code='TT-SANG-HEN-02' WHERE rule_code='TT-SANG-HEN' AND lookup_key='BRANCH:TY|MONTH:01'",
                "UPDATE tam_the_supplement_mappings SET table_row=2 WHERE rule_code='TT-SANG-HEN' AND lookup_key='BRANCH:TY|MONTH:01'",
                "UPDATE tam_the_supplement_results SET title='changed' WHERE result_code='TT-DIEN-SAN-06'",
                "UPDATE tam_the_supplement_results SET source_table_label='changed' WHERE result_code='TT-DIEN-SAN-06'",
                "UPDATE tam_the_supplement_results SET source_content_heading='changed' WHERE result_code='TT-DIEN-SAN-06'",
                "UPDATE tam_the_supplement_results SET content='changed',source_record=jsonb_set(source_record,'{content}','\"changed\"') WHERE result_code='TT-SANG-HEN-01'",
                "UPDATE tam_the_supplement_results SET source_record=jsonb_set(source_record,'{review,reviewer}','\"changed\"') WHERE result_code='TT-SANG-HEN-01'",
                "UPDATE source_books SET file_sha256=repeat('0',64) WHERE file_sha256='"+ReviewedTamTheWealth.BOOK_SHA+"'",
                "ALTER TABLE tam_the_supplement_mappings RENAME TO d04_test_missing_mappings",
                "DELETE FROM tam_the_lookup_source_pages WHERE entry_id IN (SELECT id FROM tam_the_lookup_entries WHERE rule_id=(SELECT id FROM calculation_rules WHERE rule_code='TT-TAI-LOC') AND lookup_key='STEM:GIAP|MONTH:01'); "
                        +"DELETE FROM tam_the_lookup_entries WHERE rule_id=(SELECT id FROM calculation_rules WHERE rule_code='TT-TAI-LOC') AND lookup_key='STEM:GIAP|MONTH:01'");
        for(String mutation:mutations) try(var connection=source.getConnection()) {
            connection.setAutoCommit(false);
            try {
                var isolated=new JdbcKnowledgeRepositoryTest.Connections(false) {
                    @Override public Connection getConnection() {
                        return (Connection)Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class<?>[]{Connection.class},(proxy,method,args)->{
                            if(Set.of("commit","rollback","close","setReadOnly","setAutoCommit","setTransactionIsolation").contains(method.getName()))return null;
                            try{return method.invoke(connection,args);}catch(java.lang.reflect.InvocationTargetException failure){throw failure.getCause();}
                        });
                    }
                };
                var app=service(isolated);assertNotNull(app.calculate(input("1984-01-01","LUNAR",false)));
                try(var statement=connection.createStatement()){statement.executeUpdate(mutation);}
                var stages=new ArrayList<ProgressEvent.Step>();
                assertThrows(KnowledgeDataException.class,()->app.calculate(input("1984-01-01","LUNAR",false),(step,message)->stages.add(step)),mutation);
                assertTrue(stages.isEmpty(),mutation);
            } finally {connection.rollback();}
        }
        assertNotNull(service(source).calculate(input("1984-01-01","LUNAR",false)));
    }
    @Test void actualExtendedServiceResultsSurviveHistoryAndStayOwnerScoped() throws Exception {
        var now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);var store=new JdbcHistoryStore(source,mapper);
        var owner=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));
        var other=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));
        try {
            var app=service(source);
            for(String date:List.of("1984-01-01","1984-02-01")) {
                var result=app.calculate(input(date,"LUNAR",false));var cache=new CompletedResults(mapper,Clock.fixed(now,ZoneOffset.UTC),900,10,1000000);
                var id=UUID.randomUUID();cache.capture(owner,id.toString(),"TAM_THE",result);
                var saved=store.save(owner,id,cache.find(owner.id(),id).orElseThrow(),"D04 actual extended result",now,10);
                assertEquals(mapper.valueToTree(result),new JdbcHistoryStore(source,mapper).detail(owner.id(),saved.id()).orElseThrow().result());
                assertTrue(store.detail(other.id(),saved.id()).isEmpty());assertFalse(store.delete(other.id(),saved.id()));assertTrue(store.delete(owner.id(),saved.id()));
            }
        } finally {
            try(var connection=source.getConnection();var statement=connection.prepareStatement("DELETE FROM anonymous_sessions WHERE owner_id IN (?,?)")) {
                statement.setObject(1,owner.id());statement.setObject(2,other.id());statement.executeUpdate();
            }
        }
    }
}
