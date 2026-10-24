package com.huyenco.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.knowledge.RuleCatalog;
import com.huyenco.knowledge.RuleRegistry;
import com.huyenco.knowledge.RuleStateProvider;
import com.huyenco.knowledge.HexagramRepository;
import com.huyenco.knowledge.TrigramRepository;
import java.io.IOException;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class RuleRegistryConfig {
    @Bean
    public RuleCatalog ruleCatalog(ObjectMapper mapper) throws IOException {
        return RuleCatalog.load(mapper);
    }

    @Bean
    @Profile("!db")
    public RuleStateProvider unavailableRuleStateProvider() {
        // Running without the db profile must never assert source approval.
        return code -> Optional.empty();
    }

    @Bean
    @Profile("!db")
    public HexagramRepository unavailableHexagramRepository() {
        return java.util.List::of;
    }

    @Bean
    @Profile("!db")
    public TrigramRepository unavailableTrigramRepository() {
        return java.util.List::of;
    }

    @Bean
    public RuleRegistry ruleRegistry(RuleCatalog catalog, RuleStateProvider states) {
        return new RuleRegistry(catalog, states);
    }
}
