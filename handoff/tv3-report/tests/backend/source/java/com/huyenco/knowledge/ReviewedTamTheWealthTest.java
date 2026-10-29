package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import java.util.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.*;

class ReviewedTamTheWealthTest {
    final ReviewedTamTheWealth knowledge=new ReviewedTamTheWealth(new ObjectMapper());
    TamTheExtendedRepository.Snapshot snapshot() throws Exception {
        return ReadingTestFixtures.extended(new TamTheSnapshot(Map.of(),List.of()));
    }
    @TestFactory Stream<DynamicTest> all204ReviewedMappingsRetainTextTitlesSourcesAndDecisions() throws Exception {
        var data=snapshot();var approved=knowledge.authorize(data);
        return data.bundle().document().path("tamTheMappings").valueStream().map(row->DynamicTest.dynamicTest(row.toString(),()->{
            var code=row.path("ruleCode").asText().equals("TT-SANG-HEN")?WealthSubreading.Code.SANG_HEN:WealthSubreading.Code.DIEN_SAN;
            var result=approved.lookup(code,row.path("lookupKey").asText());
            assertEquals(row.path("resultCode").asText(),result.entries().get(0).resultCode());
            var expected=data.bundle().document().path("tamTheResults").valueStream()
                    .filter(r->r.path("code").asText().equals(result.entries().get(0).resultCode())).findFirst().orElseThrow();
            assertEquals(expected.path("title").asText(),result.entries().get(0).title());
            assertEquals(expected.path("content").asText(),result.entries().get(0).content());
            assertEquals(expected.path("decisionIds").valueStream().map(n->n.asText()).toList(),
                    result.decisionReferences().stream().map(ReadingDecision::decisionId).toList());
            assertTrue(result.sourceReferences().stream().allMatch(s->s.sha256().equals(ReviewedTamTheWealth.BOOK_SHA)));
            assertTrue(result.decisionReferences().stream().allMatch(d->d.ruleBasis()==RuleBasis.TEAM_DECISION
                    && d.sourceStatus()==SourceStatus.SOURCE_AMBIGUOUS));
        }));
    }
    @Test void independentControlRowsPreservePrintedAliasesAndReferenceCaveats() throws Exception {
        var data=knowledge.authorize(snapshot());
        int[] kim={6,6,3,1,1,5,4,7,5,2,3,2};
        for(int month=1;month<=12;month++) {
            String suffix=String.format(Locale.ROOT,"%02d",month);
            assertEquals("TT-SANG-HEN-"+suffix,data.lookup(WealthSubreading.Code.SANG_HEN,"BRANCH:TY|MONTH:"+suffix).entries().get(0).resultCode());
            assertEquals("TT-DIEN-SAN-"+String.format(Locale.ROOT,"%02d",kim[month-1]),
                    data.lookup(WealthSubreading.Code.DIEN_SAN,"ELEMENT:KIM|MONTH:"+suffix).entries().get(0).resultCode());
        }
        var aliases=List.of("Hoa cái / Hao Cái","Vong sát / Vong Thần","Tướng linh / Tướng Tinh","Thiên an / Phiên An");
        for(int i=0;i<4;i++) assertEquals(aliases.get(i),data.lookup(WealthSubreading.Code.SANG_HEN,
                "BRANCH:TY|MONTH:"+String.format(Locale.ROOT,"%02d",new int[]{3,10,11,12}[i])).entries().get(0).title());
        var land=data.lookup(WealthSubreading.Code.DIEN_SAN,"ELEMENT:KIM|MONTH:01");
        assertEquals("Phú / Phá",land.entries().get(0).title());
        assertEquals(2,land.decisionReferences().size());
        assertTrue(land.decisionReferences().get(0).description().contains("Số 6"));
        assertTrue(land.sourceReferences().stream().anyMatch(s->s.pdfPage()==50));
        assertThrows(RuleNotAvailableException.class,()->data.lookup(WealthSubreading.Code.DIEN_SAN,"ELEMENT:KIM|MONTH:13"));
    }
    @Test void missingOrChangedAttestationRowsAndMappingsNeverAuthorizePinnedFallback() throws Exception {
        var good=snapshot();var b=good.bundle();
        var unreviewed=new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),b.reviewer(),b.reviewedAt(),b.reviewMethod(),"SOURCE_LOCATED");
        assertEquals(RuleUnavailableReason.SOURCE_UNVERIFIED,assertThrows(RuleNotAvailableException.class,
                ()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),unreviewed,good.results(),good.mappings()))).reason());
        assertEquals(RuleUnavailableReason.RULE_STATE_UNAVAILABLE,assertThrows(RuleNotAvailableException.class,
                ()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),null,good.results(),good.mappings()))).reason());
        for(var bad:List.of(
                new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),null,b.reviewedAt(),b.reviewMethod(),b.status()),
                new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),b.reviewer(),null,b.reviewMethod(),b.status())))
            assertEquals(RuleUnavailableReason.MISSING_SOURCE_REVIEW,assertThrows(RuleNotAvailableException.class,
                    ()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),bad,good.results(),good.mappings()))).reason());
        for(var bad:List.of(
                new MaiHoaReadingRepository.Bundle(b.id(),"0".repeat(64),b.document(),b.editor(),b.reviewer(),b.reviewedAt(),b.reviewMethod(),b.status()),
                new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),"changed",b.reviewedAt(),b.reviewMethod(),b.status()),
                new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),b.reviewer(),b.reviewedAt().plusSeconds(1),b.reviewMethod(),b.status())))
            assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),bad,good.results(),good.mappings())));
        assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),b,good.results().subList(1,19),good.mappings())));
        assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),b,good.results(),good.mappings().subList(1,204))));
        var changed=new ArrayList<>(good.mappings());var row=changed.get(0);
        changed.set(0,new TamTheExtendedRepository.Mapping(row.ruleCode(),row.lookupKey(),row.bundleId(),row.resultCode(),row.tableRow()+1,row.tableColumn()));
        assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),b,good.results(),changed)));
        var corrupted=new ArrayList<>(good.results());var r=corrupted.get(0);
        corrupted.set(0,new TamTheExtendedRepository.Result(r.code(),r.bundleId(),r.ruleCode(),r.column(),r.title(),r.tableLabel(),
                r.contentHeading(),r.content(),r.textKind(),r.sourceRecord(),"0".repeat(64),r.bookPages(),r.bookTitle()));
        assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new TamTheExtendedRepository.Snapshot(good.base(),b,corrupted,good.mappings())));
        assertEquals(2,knowledge.authorize(good).proofs().size()); // no stale mutable approval cache
    }
    @Test void jdbcOutageIsSanitizedWithoutInventingSourceState() throws Exception {
        var repository=new JdbcTamTheExtendedRepository(new JdbcKnowledgeRepositoryTest.Connections(true),
                RuleCatalog.load(new ObjectMapper()),new ObjectMapper());
        var failure=assertThrows(KnowledgeAccessException.class,()->repository.extended(Set.of("TT-NGU-HANH","TT-TAI-LOC")));
        assertNull(failure.getCause());assertFalse(failure.getMessage().contains("sensitive"));
    }
    @Test void aggregateSourceOrderUsesCanonicalResultColumnsRatherThanImmutableMapIteration() throws Exception {
        var proofs=knowledge.authorize(snapshot()).proofs();
        assertEquals(List.of("TT-SANG-HEN/TABLE:43","TT-SANG-HEN/CONTENT:43","TT-SANG-HEN/CONTENT:44"),
                proofs.get(0).sourceReferences().stream().map(s->s.section()+":"+s.pdfPage()).toList());
        assertEquals(List.of("TT-DIEN-SAN/TABLE:49","TT-DIEN-SAN/CONTENT:49","TT-DIEN-SAN/CONTENT:50"),
                proofs.get(1).sourceReferences().stream().map(s->s.section()+":"+s.pdfPage()).toList());
    }
}
