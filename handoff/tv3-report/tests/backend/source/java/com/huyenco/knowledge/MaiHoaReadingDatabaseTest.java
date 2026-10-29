package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.calendar.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import com.huyenco.history.*;
import com.huyenco.maihoa.*;
import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named="HUYENCO_M02_DB_URL",matches=".+")
class MaiHoaReadingDatabaseTest {
    static DataSource pool;
    @BeforeAll static void openPool() throws Exception {
        String url=System.getenv("HUYENCO_M02_DB_URL");
        if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/huyenco_m02_test_[a-z0-9_]+"))
            throw new SQLException("Only isolated local M02/M03 TEST data is permitted");
        // Hikari is supplied by the database profile; reflection keeps non-DB test compilation independent of it.
        var type=Class.forName("com.zaxxer.hikari.HikariDataSource");var configured=type.getConstructor().newInstance();
        type.getMethod("setJdbcUrl",String.class).invoke(configured,url);
        type.getMethod("setUsername",String.class).invoke(configured,System.getenv("HUYENCO_TEST_DB_USER"));
        type.getMethod("setPassword",String.class).invoke(configured,System.getenv("PGPASSWORD"));
        type.getMethod("setMaximumPoolSize",int.class).invoke(configured,4);pool=(DataSource)configured;
    }
    @AfterAll static void closePool() throws Exception { if(pool!=null) ((AutoCloseable)pool).close(); }
    final ObjectMapper mapper=new ObjectMapper();
    final JdbcKnowledgeRepositoryTest.Connections source=new JdbcKnowledgeRepositoryTest.Connections(false) {
        @Override public Connection getConnection() throws SQLException { return actualConnection(); }
    };
    static Connection actualConnection() throws SQLException {
        return pool.getConnection();
    }
    MaiHoaService service(DataSource data) throws Exception {
        var catalog=RuleCatalog.load(mapper);var core=new JdbcKnowledgeRepository(data,catalog);
        var registry=new RuleRegistry(catalog,core);var calendar=new CalendarService(new VietnameseLunarCalendar(),registry);
        return new MaiHoaService(registry,core,core,calendar,new MaiHoaInterpretationService(new JdbcMaiHoaReadingRepository(data,mapper),mapper,calendar));
    }
    ObjectNode input() throws Exception {
        var payload=(ObjectNode)mapper.readTree(Path.of("../docs/examples/m02-lines-reading.request.json").toFile()).get("payload");
        payload.putArray("linesBottomUp").add(true).add(false).add(true).add(true).add(true).add(false);payload.put("movingLine",1);
        return payload;
    }
    @Test void allThreeMethodsUseRealApprovedDbTemplatesAndLegacyRemainsIdentical() throws Exception {
        var app=service(source);
        for(String name:List.of("lines-reading","object-reading","time-reading")) {
            var p=mapper.readTree(Path.of("../docs/examples/m02-"+name+".request.json").toFile()).get("payload");
            var result=app.calculate(p);assertNotNull(result.detailedReading());
            assertEquals(ReviewedMaiHoaKnowledge.BUNDLE_ID,result.detailedReading().bundleId());
            assertEquals(RuleBasis.TEAM_DECISION,result.ruleBasis());
            var json=mapper.valueToTree(result);
            assertEquals(json,mapper.valueToTree(mapper.treeToValue(json,MaiHoaResult.class)));
        }
        for(String name:List.of("mai-hoa-lines","mai-hoa-object-count","mai-hoa-time")) {
            var p=mapper.readTree(Path.of("../docs/examples/"+name+".request.json").toFile()).get("payload");
            var expected=mapper.readTree(Path.of("../docs/examples/"+name+".response.json").toFile()).get("data");
            assertEquals(expected,mapper.valueToTree(app.calculate(p))); // Exact prior JSON, not merely the structures.
        }
    }
    @Test void all1536CasesAlsoResolveActualReviewedNamesAndContentFromPostgres() throws Exception {
        var app=service(source);int count=0;
        for(int bits=0;bits<64;bits++) for(int moving=1;moving<=6;moving++) for(String topic:List.of("GENERAL","CAREER","WEALTH","LOVE")) {
            var p=mapper.createObjectNode().put("method","LINES").put("movingLine",moving);var lines=p.putArray("linesBottomUp");
            for(int n=0;n<6;n++) lines.add((bits&(1<<n))!=0);p.putObject("reading").put("topic",topic);
            var result=app.calculate(p);assertNotNull(result.primaryHexagram().name());assertEquals(4,result.detailedReading().phases().size());
            assertTrue(result.detailedReading().phases().stream().allMatch(phase->!phase.content().isBlank() && phase.sourceStatus()==SourceStatus.VERIFIED));
            count++;
        }
        assertEquals(1536,count);
    }
    @Test void databaseTamperingIsRejectedInsideRollbackOnlyTransactions() throws Exception {
        for(String mutation:List.of(
                "UPDATE reading_source_bundles SET document_sha256=repeat('0',64)",
                "UPDATE reading_source_bundles SET reviewer='unreviewed replacement'",
                "UPDATE reading_source_bundles SET reviewed_at=reviewed_at+interval '1 second'",
                "UPDATE reading_source_bundles SET reviewed_document=jsonb_set(reviewed_document,'{decisions,0,basis}','\"SOURCE_VERIFIED\"')",
                "DELETE FROM mai_hoa_reading_templates WHERE template_code='MH-LOVE-SAME_ELEMENT'",
                "UPDATE mai_hoa_reading_templates SET content='unreviewed',source_record=jsonb_set(source_record,'{content}','\"unreviewed\"') WHERE topic='GENERAL'",
                "UPDATE mai_hoa_reading_templates SET source_record=jsonb_set(source_record,'{review,reviewer}','\"changed\"') WHERE topic='CAREER'",
                "UPDATE source_books SET file_sha256=repeat('0',64) WHERE file_sha256='"+ReviewedMaiHoaKnowledge.BOOK_SHA+"'")) {
            try(var connection=actualConnection()) {
                connection.setAutoCommit(false);
                try {
                    try(var statement=connection.createStatement()) { statement.executeUpdate(mutation); }
                    // Only this test datasource suppresses nested transaction management. All writes remain uncommitted.
                    var rollbackOnly=new JdbcKnowledgeRepositoryTest.Connections(false) {
                        @Override public Connection getConnection() {
                            return (Connection)Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class<?>[]{Connection.class},(proxy,method,args)->{
                                if(Set.of("commit","rollback","close","setReadOnly","setAutoCommit","setTransactionIsolation").contains(method.getName())) return null;
                                try { return method.invoke(connection,args); }
                                catch(java.lang.reflect.InvocationTargetException failure) { throw failure.getCause(); }
                            });
                        }
                    };
                    var stages=new ArrayList<ProgressEvent.Step>();var app=service(rollbackOnly);
                    assertThrows(KnowledgeDataException.class,()->app.calculate(input(),(step,message)->stages.add(step)),mutation);
                    assertTrue(stages.isEmpty());
                } finally { connection.rollback(); }
            }
        }
        assertNotNull(service(source).calculate(input()).detailedReading());
    }
    @Test void realServiceResultSurvivesOwnerScopedHistoryAndMissingBundleDoesNotFallback() throws Exception {
        var now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);var store=new JdbcHistoryStore(source,mapper);
        var owner=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));
        var other=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));
        try {
            var result=service(source).calculate(input());var cache=new CompletedResults(mapper,Clock.fixed(now,ZoneOffset.UTC),900,10,1000000);
            var request=UUID.randomUUID();cache.capture(owner,request.toString(),"MAI_HOA",result);
            var saved=store.save(owner,request,cache.find(owner.id(),request).orElseThrow(),"M03 actual service result",now,10);
            assertEquals(mapper.valueToTree(result),new JdbcHistoryStore(source,mapper).detail(owner.id(),saved.id()).orElseThrow().result());
            assertTrue(store.detail(other.id(),saved.id()).isEmpty());assertFalse(store.delete(other.id(),saved.id()));assertTrue(store.delete(owner.id(),saved.id()));
        } finally {
            try(var connection=source.getConnection();var delete=connection.prepareStatement("DELETE FROM anonymous_sessions WHERE owner_id IN (?,?)")) {
                delete.setObject(1,owner.id());delete.setObject(2,other.id());delete.executeUpdate();
            }
        }
    }
}
