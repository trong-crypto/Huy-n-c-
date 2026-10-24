package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.config.RuleRegistryConfig;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.maihoa.MaiHoaService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class RuleRegistryContextTest {
    @Test
    void defaultServerStartsWithCatalogButDoesNotInventDatabaseApprovals() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.register(RuleRegistryConfig.class, MaiHoaService.class);
            context.refresh();
            assertEquals(14, context.getBean(RuleCatalog.class).all().size());
            RuleRegistry registry = context.getBean(RuleRegistry.class);
            var error = assertThrows(RuleNotAvailableException.class,
                    () -> registry.authorize("MH-MUTUAL", RulePurpose.CALCULATION));
            assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE, error.reason());
            assertEquals(1, context.getBeansOfType(HexagramRepository.class).size());
            var service = context.getBean(MaiHoaService.class);
            var calculationError = assertThrows(RuleNotAvailableException.class, () -> service.calculate(
                    new ObjectMapper().readTree("""
                        {"method":"LINES","linesBottomUp":[true,false,true,false,true,false],"movingLine":2}
                        """)));
            assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE, calculationError.reason());
        }
    }
}
