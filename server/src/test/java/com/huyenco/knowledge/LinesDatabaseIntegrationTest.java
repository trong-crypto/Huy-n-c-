package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.maihoa.MaiHoaService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import com.huyenco.config.KnowledgeDatabaseConfig;
import com.huyenco.config.RuleRegistryConfig;
import javax.sql.DataSource;

@EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
class LinesDatabaseIntegrationTest {
    @Test
    void realServiceUsesDatabaseApprovalsAndStructuralCodesThroughSpringWiring() throws Exception {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("db");
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.registerBean(DataSource.class, () -> new JdbcKnowledgeRepositoryTest.Connections(false));
            context.register(RuleRegistryConfig.class, KnowledgeDatabaseConfig.class, MaiHoaService.class);
            context.refresh();
            assertEquals(1, context.getBeansOfType(HexagramRepository.class).size());
            var result = context.getBean(MaiHoaService.class).calculate(new ObjectMapper().readTree("""
                {"method":"LINES","linesBottomUp":[true,false,true,false,true,false],"movingLine":2}
                """));
            assertEquals("H_KHAM_LY", result.primaryHexagram().code());
            assertEquals("H_LY_KHAM", result.mutualHexagram().code());
            assertEquals("H_KHAM_CAN", result.changedHexagram().code());
            assertEquals(List.of(true, true, true, false, true, false), result.changedHexagram().linesBottomUp());
            assertEquals(RuleBasis.SOURCE_VERIFIED, result.ruleBasis());
            assertEquals(SourceStatus.VERIFIED, result.sourceStatus());
            assertTrue(result.rules().stream().allMatch(r -> r.sourceStatus() == SourceStatus.VERIFIED));
            assertEquals(List.of(42, 41), result.sourceReferences().stream().map(s -> s.pdfPage()).toList());
            assertEquals("Ký tế", result.primaryHexagram().name());
            assertEquals("Vị tế", result.mutualHexagram().name());
            assertEquals("Nhu", result.changedHexagram().name());
            assertEquals(SourceStatus.VERIFIED, result.primaryHexagram().nameStatus());
            assertEquals(1, context.getBeansOfType(TrigramRepository.class).size());
            var counted = context.getBean(MaiHoaService.class).calculate(new ObjectMapper().readTree("""
                {"method":"OBJECT_COUNT","objectCount":12,"hourIndex":8}
                """));
            assertEquals("Dự", counted.primaryHexagram().name());
            assertEquals("Kiển", counted.mutualHexagram().name());
            assertEquals("Giải", counted.changedHexagram().name());
            assertEquals(2, counted.movingLine());
            assertEquals(RuleBasis.TEAM_DECISION, counted.ruleBasis());
            assertEquals(SourceStatus.SOURCE_AMBIGUOUS, counted.sourceStatus());
            assertEquals(List.of(46, 39, 42, 41), counted.sourceReferences().stream().map(s -> s.pdfPage()).toList());
            var mapper = new ObjectMapper();
            var fixture = mapper.readTree(java.nio.file.Path.of("..", "docs", "examples",
                    "mai-hoa-object-count.response.json").toFile());
            assertEquals(fixture.get("data"), mapper.valueToTree(counted));
        }
    }
}
