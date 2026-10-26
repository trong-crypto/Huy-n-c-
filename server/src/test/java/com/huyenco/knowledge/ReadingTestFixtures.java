package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.*;
import java.time.Instant;
import java.util.*;
import org.springframework.core.io.ClassPathResource;

/** A simulated repository attestation for unit tests, never a runtime source provider. */
public final class ReadingTestFixtures {
    private ReadingTestFixtures() { }
    public static TamTheExtendedRepository.Snapshot extended(TamTheSnapshot base) throws Exception {
        var bundle=snapshot().bundle();var document=bundle.document();
        var results=new ArrayList<TamTheExtendedRepository.Result>();
        for(var row:document.get("tamTheResults")) results.add(new TamTheExtendedRepository.Result(row.path("code").asText(),bundle.id(),
                row.path("ruleCode").asText(),row.path("column").asInt(),row.path("title").asText(),row.path("tableLabel").asText(),
                row.path("contentHeading").asText(),row.path("content").asText(),row.path("textKind").asText(),row,
                ReviewedTamTheWealth.BOOK_SHA,360,"Diễn Cầm Tam Thế Diễn Nghĩa"));
        var mappings=new ArrayList<TamTheExtendedRepository.Mapping>();
        for(var row:document.get("tamTheMappings")) mappings.add(new TamTheExtendedRepository.Mapping(row.path("ruleCode").asText(),
                row.path("lookupKey").asText(),bundle.id(),row.path("resultCode").asText(),row.path("tableRow").asInt(),row.path("tableColumn").asInt()));
        return new TamTheExtendedRepository.Snapshot(base,bundle,results,mappings);
    }
    public static MaiHoaReadingRepository.Snapshot snapshot() throws Exception {
        var mapper=new ObjectMapper();JsonNode document;
        try(var stream=new ClassPathResource("readings/m01_reviewed_readings.json").getInputStream()) { document=mapper.readTree(stream); }
        var review=document.get("review");
        var bundle=new MaiHoaReadingRepository.Bundle(ReviewedMaiHoaKnowledge.BUNDLE_ID,ReviewedMaiHoaKnowledge.DOCUMENT_SHA,
                document,review.get("editor").asText(),review.get("reviewer").asText(),Instant.parse(review.get("reviewedAt").asText()),review.get("method").asText(),"VERIFIED");
        var rows=new ArrayList<MaiHoaReadingRepository.Template>();
        for(var row:document.get("maiHoaTemplates")) rows.add(new MaiHoaReadingRepository.Template(row.get("code").asText(),
                bundle.id(),row.get("topic").asText(),row.get("relation").asText(),row.get("content").asText(),row.get("textKind").asText(),
                row,ReviewedMaiHoaKnowledge.BOOK_SHA,672,"Mai Hoa Dịch Số"));
        return new MaiHoaReadingRepository.Snapshot(bundle,rows);
    }
}
