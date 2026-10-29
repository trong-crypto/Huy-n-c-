package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.huyenco.hexagram.HexagramLookupService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
class HexagramLookupDatabaseTest {
    @Test void actualDatabaseHasAll64VerifiedGlossesAndCorrectIdentities() throws Exception {
        var repository=new JdbcKnowledgeRepository(new JdbcKnowledgeRepositoryTest.Connections(false),JdbcKnowledgeRepositoryTest.catalog());
        var snapshot=repository.lookupSnapshot();
        assertEquals(64,snapshot.hexagrams().size()); assertEquals(64,snapshot.glosses().size());
        var service=new HexagramLookupService(repository);
        var all=service.list("",null,null,0,100);
        assertEquals(64,all.totalElements());
        for(var item : all.items()) {
            var detail=service.detail(item.code());
            assertEquals(6,detail.linesBottomUp().size()); assertEquals(SourceStatus.VERIFIED,detail.verificationStatus());
            assertEquals(1,detail.interpretations().size());
            assertTrue(detail.interpretations().get(0).sourceReferences().get(0).hasTraceableLocation());
        }
        var tinh=service.detail("H_KHAM_TON");
        assertEquals("Tỉnh",tinh.name()); assertEquals("Giếng nước",tinh.interpretations().get(0).content());
        assertEquals("Ích",tinh.interpretations().get(0).printedSourceLabel());
        assertEquals("Ký tế",service.detail("H_KHAM_LY").name());
        assertEquals("Vị tế",service.detail("H_LY_KHAM").name());
        assertNotEquals(service.detail("H_KHAM_LY").linesBottomUp(), service.detail("H_LY_KHAM").linesBottomUp());
    }
}
