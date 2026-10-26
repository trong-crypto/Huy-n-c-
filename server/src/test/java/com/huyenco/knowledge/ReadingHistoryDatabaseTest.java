package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.*;
import com.huyenco.history.*;
import java.nio.file.Path;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@EnabledIfEnvironmentVariable(named="HUYENCO_M02_DB_URL",matches=".+")
class ReadingHistoryDatabaseTest {
    final ObjectMapper mapper=new ObjectMapper();
    final JdbcKnowledgeRepositoryTest.Connections source=new JdbcKnowledgeRepositoryTest.Connections(false) {
        @Override public Connection getConnection() throws SQLException {
            String url=System.getenv("HUYENCO_M02_DB_URL");
            if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/huyenco_m02_test_[a-z0-9_]+"))
                throw new SQLException("Only an isolated local M02 TEST database is permitted");
            return DriverManager.getConnection(url,System.getenv("HUYENCO_TEST_DB_USER"),System.getenv("PGPASSWORD"));
        }
    };
    final JdbcHistoryStore store=new JdbcHistoryStore(source,mapper);
    final Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    final List<HistoryStore.Owner> owners=new ArrayList<>();
    HistoryStore.Owner owner() {
        var owner=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));
        owners.add(owner);return owner;
    }
    @AfterEach void cleanup() throws Exception {
        try(var connection=source.getConnection();var delete=connection.prepareStatement("DELETE FROM anonymous_sessions WHERE owner_id=?")) {
            for(var owner:owners){delete.setObject(1,owner.id());delete.executeUpdate();}
        }
    }
    @ParameterizedTest @ValueSource(strings={"detailed-no-season","detailed-season","wealth-matched","wealth-no-loc"})
    void typedSchemaSnapshotsSurviveCacheAndPostgresWithOwnerIsolation(String name) throws Exception {
        var fixture=mapper.readTree(Path.of("../docs/examples/m02-"+name+".schema.response.json").toFile());
        String type=fixture.get("type").asText();var data=fixture.get("data");
        Object typed="MAI_HOA".equals(type)?mapper.treeToValue(data,MaiHoaResult.class):mapper.treeToValue(data,TamTheResult.class);
        var a=owner();var b=owner();UUID request=UUID.randomUUID();
        var cache=new CompletedResults(mapper,Clock.fixed(now,ZoneOffset.UTC),900,10,1000000);
        cache.capture(a,request.toString(),type,typed);
        var snapshot=cache.find(a.id(),request).orElseThrow();
        assertEquals(data,mapper.readTree(snapshot.json()));assertTrue(cache.find(b.id(),request).isEmpty());
        var saved=store.save(a,request,snapshot,"M02 schema round-trip",now,10);
        var reopened=new JdbcHistoryStore(source,mapper);
        assertEquals(data,reopened.detail(a.id(),saved.id()).orElseThrow().result());
        assertTrue(reopened.detail(b.id(),saved.id()).isEmpty());assertFalse(reopened.delete(b.id(),saved.id()));
        assertEquals(saved.id(),store.save(a,request,snapshot,"duplicate",now,10).id());
        assertTrue(reopened.delete(a.id(),saved.id()));assertTrue(reopened.detail(a.id(),saved.id()).isEmpty());
    }
}
