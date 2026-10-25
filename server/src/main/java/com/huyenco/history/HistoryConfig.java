package com.huyenco.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.knowledge.KnowledgeAccessException;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.context.annotation.*;

@Configuration
public class HistoryConfig {
    @Bean public Clock historyClock() { return Clock.systemUTC(); }
    @Bean @Profile("db") public HistoryStore historyStore(DataSource source, ObjectMapper mapper) {
        return new JdbcHistoryStore(source, mapper);
    }
    @Bean @Profile("!db") public HistoryStore unavailableHistoryStore() {
        return new HistoryStore() {
            public Owner create(String hash,Instant created,Instant expires){throw new KnowledgeAccessException();}
            public Optional<Owner> owner(String hash,Instant now){throw new KnowledgeAccessException();}
            public Optional<Detail> byRequest(UUID owner,UUID request){throw new KnowledgeAccessException();}
            public Detail save(Owner owner,UUID request,CompletedResults.Result result,String title,Instant now,int limit){throw new KnowledgeAccessException();}
            public Page list(UUID owner,String query,String type,int page,int size){throw new KnowledgeAccessException();}
            public Optional<Detail> detail(UUID owner,UUID id){throw new KnowledgeAccessException();}
            public boolean delete(UUID owner,UUID id){throw new KnowledgeAccessException();}
        };
    }
}
