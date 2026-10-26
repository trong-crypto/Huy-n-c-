package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.common.dto.MaiHoaReadingOptions.Topic;
import com.huyenco.common.exception.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class ReviewedMaiHoaKnowledgeTest {
    final ReviewedMaiHoaKnowledge knowledge=new ReviewedMaiHoaKnowledge(new ObjectMapper());
    @Test void changedSourceContentReviewerTimestampHashOrPartialBundleNeverAuthorize() throws Exception {
        var source=ReadingTestFixtures.snapshot();var b=source.bundle();
        var badDocument=b.document().deepCopy();((ObjectNode)badDocument.path("decisions").get(0)).put("basis","SOURCE_VERIFIED");
        for(var changed:List.of(
            new MaiHoaReadingRepository.Bundle(b.id(),"0".repeat(64),b.document(),b.editor(),b.reviewer(),b.reviewedAt(),b.reviewMethod(),b.status()),
            new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),badDocument,b.editor(),b.reviewer(),b.reviewedAt(),b.reviewMethod(),b.status()),
            new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),"another reviewer",b.reviewedAt(),b.reviewMethod(),b.status()),
            new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),b.reviewer(),b.reviewedAt().plusSeconds(1),b.reviewMethod(),b.status()))) {
            assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new MaiHoaReadingRepository.Snapshot(changed,source.templates()),Topic.GENERAL,false));
        }
        assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new MaiHoaReadingRepository.Snapshot(b,source.templates().subList(0,19)),Topic.GENERAL,false));
        var old=source.templates().get(0);
        for(var row:List.of(
            new MaiHoaReadingRepository.Template(old.code(),old.bundleId(),old.topic(),old.relation(),"unreviewed",old.textKind(),old.sourceRecord(),old.bookSha256(),old.bookPages(),old.bookTitle()),
            new MaiHoaReadingRepository.Template(old.code(),old.bundleId(),old.topic(),old.relation(),old.content(),old.textKind(),old.sourceRecord(),"0".repeat(64),old.bookPages(),old.bookTitle()))) {
            var rows=new ArrayList<>(source.templates());rows.set(0,row);
            assertThrows(KnowledgeDataException.class,()->knowledge.authorize(new MaiHoaReadingRepository.Snapshot(b,rows),Topic.GENERAL,false));
        }
        var noReview=new MaiHoaReadingRepository.Bundle(b.id(),b.sha256(),b.document(),b.editor(),null,null,b.reviewMethod(),b.status());
        assertEquals(RuleUnavailableReason.MISSING_SOURCE_REVIEW,assertThrows(RuleNotAvailableException.class,
                ()->knowledge.authorize(new MaiHoaReadingRepository.Snapshot(noReview,source.templates()),Topic.GENERAL,false)).reason());
    }
    @Test void interpretationProofsAreVerifiedAndConventionsCannotAuthorizeInterpretations() throws Exception {
        var authorized=knowledge.authorize(ReadingTestFixtures.snapshot(),Topic.LOVE,true);
        assertEquals(6,authorized.proofs().size());
        assertEquals(4,authorized.proofs().stream().filter(p->p.ruleBasis()==RuleBasis.TEAM_DECISION).count());
        assertTrue(authorized.proofs().stream().filter(p->p.ruleBasis()==RuleBasis.SOURCE_VERIFIED).allMatch(p->p.sourceStatus()==SourceStatus.VERIFIED));
        var body=authorized.proofs().get(0);
        var registry=new RuleRegistry(new RuleCatalog(List.of(new RuleDefinition(body.ruleCode(),RuleModule.MAI_HOA,"1.0",ExecutionPolicy.TEAM_DECISION,body.decisionReferences()))),
                code->Optional.of(new RuleState(code,RuleModule.MAI_HOA,"1.0",body.sourceStatus(),body.sourceReferences(),null,null)));
        assertEquals(RuleUnavailableReason.TEAM_DECISION_NOT_ALLOWED,assertThrows(RuleNotAvailableException.class,
                ()->registry.authorize(body.ruleCode(),RulePurpose.INTERPRETATION)).reason());
    }
}
