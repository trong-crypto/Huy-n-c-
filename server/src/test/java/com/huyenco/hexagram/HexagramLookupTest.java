package com.huyenco.hexagram;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.huyenco.common.dto.SourceReference;
import com.huyenco.knowledge.*;
import java.nio.file.*;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HexagramLookupTest {
    static final SourceReference SOURCE = new SourceReference("MH", "Mai Hoa Dịch Số", "PDF supplied",
            "MH-64-QUE-NAMES-278", "278", 271, "a".repeat(64), null);

    static HexagramLookupSnapshot snapshot() throws Exception {
        var records = new ArrayList<HexagramRecord>();
        for (String row : Files.readAllLines(Path.of("../data/hexagram_names.csv")).subList(1, 65)) {
            String[] r = row.split(",");
            records.add(new HexagramRecord("H_" + r[1] + "_" + r[2], r[3], r[1], r[2],
                    List.of(true, false, true, false, true, false), "CANONICAL_TITLE", SourceStatus.VERIFIED,
                    "same tool", SOURCE));
        }
        return new HexagramLookupSnapshot(records, List.of(new HexagramLookupSnapshot.Gloss("H_KHAM_TON",
                "Giếng nước", SourceStatus.VERIFIED, "Codex same tool", Instant.parse("2026-10-25T07:00:00Z"),
                "Printed Ích at position 48; normalized to Tỉnh", 48, "Ích", SOURCE)));
    }
    static HexagramLookupService service() throws Exception {
        var data = snapshot(); return new HexagramLookupService(() -> data);
    }

    @Test void allPagesStableSortedUniqueAndBeyondLastEmpty() throws Exception {
        var service = service();
        var first = service.list("", null, null, 0, 20);
        assertEquals(64, first.totalElements()); assertEquals(4, first.totalPages());
        var codes = new ArrayList<String>();
        for (int i=0; i<4; i++) codes.addAll(service.list("", null, null, i, 20).items().stream().map(HexagramLookupService.Item::code).toList());
        assertEquals(64, new HashSet<>(codes).size()); assertEquals(codes.stream().sorted().toList(), codes);
        assertTrue(service.list("", null, null, Integer.MAX_VALUE, 100).items().isEmpty());
        assertEquals(64, service.list("", null, null, 0, 100).items().size());
        assertEquals(0, service.list("no such title", null, null, 0, 20).totalPages());
    }

    @Test void accentedAndUnaccentedSearchAndUnicodeNormalization() throws Exception {
        var service=service();
        for (String name : List.of("Bĩ", "Bí", "Ly", "Lý", "Càn", "Cấn", "Ký tế", "Vị tế")) {
            var result=service.list(name, null, null, 0, 100);
            assertTrue(result.items().stream().anyMatch(h -> h.name().equals(name)), name);
            if (!name.equals("Ly")) {
                if (List.of("Bĩ", "Bí", "Lý", "Càn", "Cấn").contains(name)) assertEquals(1,result.totalElements(),name);
            }
        }
        assertEquals(Set.of("Bĩ","Bí"), service.list("bi",null,null,0,100).items().stream().map(HexagramLookupService.Item::name).collect(java.util.stream.Collectors.toSet()));
        assertEquals(Set.of("Ly","Lý"), service.list("ly",null,null,0,100).items().stream().map(HexagramLookupService.Item::name).collect(java.util.stream.Collectors.toSet()));
        assertEquals(1,service.list(Normalizer.normalize("TỈNH",Normalizer.Form.NFD),null,null,0,20).totalElements());
        assertEquals("H_KHAM_TON",service.list("h_kham_ton",null,null,0,20).items().get(0).code());
        assertEquals(0,service.list("%' OR 1=1 --",null,null,0,20).totalElements());
        assertEquals(0,service.list("%", null, null, 0,20).totalElements());
        assertEquals(0,service.list("_", null, null, 0,100).totalElements());
        assertEquals(64,service.list("H_", null, null, 0,100).totalElements());
    }

    @Test void filtersAndDetailKeepSixLinesAndSourceDecision() throws Exception {
        var service=service();
        assertEquals(8,service.list("", "KHAM",null,0,20).totalElements());
        assertEquals(8,service.list("", null,"TON",0,20).totalElements());
        var result=service.list("", "KHAM","TON",0,20);
        assertEquals(1,result.totalElements()); assertEquals("Tỉnh",result.items().get(0).name());
        var detail=service.detail("H_KHAM_TON");
        assertEquals(6,detail.linesBottomUp().size()); assertEquals(SOURCE,detail.sourceReferences().get(0));
        var meaning=detail.interpretations().get(0);
        assertEquals("NAME_GLOSS",meaning.category()); assertEquals("Giếng nước",meaning.content());
        assertEquals("Ích",meaning.printedSourceLabel()); assertEquals(48,meaning.sourceOrder());
        assertEquals("NOT_FOUND",assertThrows(com.huyenco.common.exception.ContractException.class,()->service.detail("H_UNKNOWN_CAN")).code());
    }

    @Test void unreviewedOrMissingReviewMetadataNeverPublished() throws Exception {
        var data=snapshot(); var g=data.glosses().get(0);
        for (var status : SourceStatus.values()) {
            var gloss=new HexagramLookupSnapshot.Gloss(g.code(),g.content(),status,g.reviewer(),null,g.note(),48,"Ích",g.source());
            var service=new HexagramLookupService(()->new HexagramLookupSnapshot(data.hexagrams(),List.of(gloss)));
            assertTrue(service.detail(g.code()).interpretations().isEmpty());
        }
        var draft=new HexagramRecord("H_CAN_CAN","bản chép", "CAN","CAN",List.of(true,true,true,true,true,true),
                "CANONICAL_TITLE",SourceStatus.SOURCE_LOCATED,null,SOURCE);
        var records=new ArrayList<>(data.hexagrams());records.removeIf(h->h.code().equals(draft.code()));records.add(draft);
        var service=new HexagramLookupService(()->new HexagramLookupSnapshot(records,List.of()));
        assertEquals(SourceStatus.SOURCE_LOCATED,service.detail(draft.code()).verificationStatus());
        assertTrue(service.detail(draft.code()).interpretations().isEmpty());
        assertThrows(KnowledgeDataException.class,()->new HexagramLookupService(()->new HexagramLookupSnapshot(List.of(),List.of())).list("",null,null,0,20));
    }

    @Test void httpEnvelopesValidationAndSanitizedErrors() throws Exception {
        var mvc=MockMvcBuilders.standaloneSetup(new HexagramController(service())).build();
        mvc.perform(get("/api/v1/hexagrams")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.items.length()").value(20)).andExpect(jsonPath("$.data.totalElements").value(64));
        for (String query : List.of("size=0","size=101","page=-1","page=2147483648","page=1.5","page=","size=2&size=3",
                "upperTrigramCode=BAD","lowerTrigramCode=","surprise=1","q="+"a".repeat(101))) {
            mvc.perform(get("/api/v1/hexagrams?"+query)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("INVALID_INPUT")).andExpect(jsonPath("$.data").isEmpty());
        }
        mvc.perform(get("/api/v1/hexagrams/H_UNKNOWN_CAN")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        mvc.perform(get("/api/v1/hexagrams/bad")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/hexagrams/H_CAN_CAN?size=1")).andExpect(status().isBadRequest());
        for (var error : List.of(new KnowledgeAccessException(),new KnowledgeDataException(), new IllegalStateException("password SQL secret"))) {
            var failed=MockMvcBuilders.standaloneSetup(new HexagramController(new HexagramLookupService(()->{throw error;}))).build();
            failed.perform(get("/api/v1/hexagrams")).andExpect(status().is(error instanceof IllegalStateException ? 500:503))
                    .andExpect(jsonPath("$.status").value("FAILED"))
                    .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
        }
    }
}
