package com.huyenco.config;

import com.huyenco.knowledge.JdbcKnowledgeRepository;
import com.huyenco.knowledge.RuleCatalog;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("db")
public class KnowledgeDatabaseConfig {
    @Bean
    public JdbcKnowledgeRepository knowledgeRepository(DataSource dataSource, RuleCatalog catalog) {
        return new JdbcKnowledgeRepository(dataSource, catalog);
    }
}
