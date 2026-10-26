package com.huyenco.config;

import com.huyenco.knowledge.JdbcKnowledgeRepository;
import com.huyenco.knowledge.RuleCatalog;
import com.huyenco.knowledge.MaiHoaReadingRepository;
import com.huyenco.knowledge.JdbcMaiHoaReadingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("db")
public class KnowledgeDatabaseConfig {
    @Bean
    public com.huyenco.knowledge.TamTheExtendedRepository tamTheExtendedRepository(DataSource source, RuleCatalog catalog, ObjectMapper mapper) {
        return new com.huyenco.knowledge.JdbcTamTheExtendedRepository(source,catalog,mapper);
    }
    @Bean
    public MaiHoaReadingRepository maiHoaReadingRepository(DataSource source, ObjectMapper mapper) {
        return new JdbcMaiHoaReadingRepository(source,mapper);
    }
    @Bean
    public JdbcKnowledgeRepository knowledgeRepository(DataSource dataSource, RuleCatalog catalog) {
        return new JdbcKnowledgeRepository(dataSource, catalog);
    }
}
