package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.history.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL",matches=".+")
class HistoryStoreDatabaseTest {
    final JdbcKnowledgeRepositoryTest.Connections source=new JdbcKnowledgeRepositoryTest.Connections(false);
    final JdbcHistoryStore store=new JdbcHistoryStore(source,new ObjectMapper());
    final Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    final List<HistoryStore.Owner> owners=new ArrayList<>();
    HistoryStore.Owner owner(){var o=store.create(SessionService.hash(UUID.randomUUID().toString()),now,now.plusSeconds(3600));owners.add(o);return o;}
    @AfterEach void cleanup()throws Exception {
        try(var c=source.getConnection();var s=c.prepareStatement("DELETE FROM anonymous_sessions WHERE owner_id=?")) {
            for(var o:owners){s.setObject(1,o.id());s.executeUpdate();}
        }
    }
    @Test void ownerIsolationPersistenceLiteralSearchAndIdempotency()throws Exception {
        var a=owner();var b=owner();UUID request=UUID.randomUUID();
        var result=new CompletedResults.Result("MAI_HOA","TEAM_DECISION","{\"method\":\"LINES\"}");
        var saved=store.save(a,request,result,"Lịch sử %_ có dấu",now,2);
        assertEquals(saved.id(),store.save(a,request,result,"Ignored duplicate title",now,2).id());
        assertTrue(store.detail(b.id(),saved.id()).isEmpty());assertFalse(store.delete(b.id(),saved.id()));assertTrue(store.byRequest(b.id(),request).isEmpty());
        var reopened=new JdbcHistoryStore(source,new ObjectMapper());
        assertEquals(saved.result(),reopened.detail(a.id(),saved.id()).orElseThrow().result());
        assertEquals(1,store.list(a.id(),"%_",null,0,20).totalElements());
        assertEquals(0,store.list(a.id(),"' OR 1=1 --",null,0,20).totalElements());
        assertEquals(0,store.list(b.id(),"",null,0,20).totalElements());
        assertTrue(store.list(a.id(),"",null,Integer.MAX_VALUE,100).items().isEmpty());
        store.save(a,UUID.randomUUID(),result,"second",now.plusSeconds(1),2);
        assertEquals("second",store.list(a.id(),"",null,0,1).items().get(0).title());
        assertThrows(com.huyenco.common.exception.ContractException.class,()->store.save(a,UUID.randomUUID(),result,"third",now,2));
        assertTrue(store.delete(a.id(),saved.id()));assertTrue(store.detail(a.id(),saved.id()).isEmpty());
    }
    @Test void concurrentSavesCannotExceedOwnerLimit()throws Exception {
        var a=owner();var executor=Executors.newFixedThreadPool(4);
        try {
            var tasks=new ArrayList<Callable<Boolean>>();
            for(int i=0;i<8;i++)tasks.add(()->{
                try{store.save(a,UUID.randomUUID(),new CompletedResults.Result("MAI_HOA","SOURCE_VERIFIED","{}"),"test",now,1);return true;}
                catch(com.huyenco.common.exception.ContractException expected){assertEquals("INVALID_INPUT",expected.code());return false;}
            });
            int saved=0;for(var f:executor.invokeAll(tasks))if(f.get())saved++;
            assertEquals(1,saved);assertEquals(1,store.list(a.id(),"",null,0,20).totalElements());
        } finally {executor.shutdownNow();}
    }
    @Test void expiredSessionAndExpiredSaveAreRejected()throws Exception {
        String hash=SessionService.hash(UUID.randomUUID().toString());var a=store.create(hash,now,now.plusSeconds(1));owners.add(a);
        assertTrue(store.owner(hash,now).isPresent());assertTrue(store.owner(hash,now.plusSeconds(1)).isEmpty());
        assertThrows(com.huyenco.common.exception.ContractException.class,()->store.save(a,UUID.randomUUID(),new CompletedResults.Result("TAM_THE","SOURCE_VERIFIED","{}"),"test",now.plusSeconds(1),1000));
    }
}
