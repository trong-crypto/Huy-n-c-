package com.huyenco.knowledge;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.core.io.ClassPathResource;

/** M01 is a pinned review artifact, not permission to serve data without a current DB attestation. */
public final class ReviewedTamTheWealth {
    public static final String BUNDLE_ID=ReviewedMaiHoaKnowledge.BUNDLE_ID;
    public static final String SANG_HEN="TT-SANG-HEN", DIEN_SAN="TT-DIEN-SAN";
    public static final String BOOK_SHA="7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d";
    private final JsonNode document;
    private final Map<String,JsonNode> results;
    private final Map<String,JsonNode> mappings;
    private final Map<String,JsonNode> decisions;

    public ReviewedTamTheWealth(ObjectMapper mapper) {
        try(var stream=new ClassPathResource("readings/m01_reviewed_readings.json").getInputStream()) {
            String text=new String(stream.readAllBytes(),StandardCharsets.UTF_8).replace("\r\n","\n").replace('\r','\n');
            check(ReviewedMaiHoaKnowledge.DOCUMENT_SHA.equals(HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)))));
            document=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readTree(text);
            check(BUNDLE_ID.equals(document.path("bundleId").asText()) && !document.path("runtimeEnabled").asBoolean(true));
            var expected=new LinkedHashMap<String,JsonNode>();
            for(var row:document.path("tamTheResults")) check(expected.put(row.path("code").asText(),row)==null);
            check(expected.size()==19);results=Map.copyOf(expected);
            var keys=new LinkedHashMap<String,JsonNode>();
            for(var row:document.path("tamTheMappings")) check(keys.put(identity(row.path("ruleCode").asText(),row.path("lookupKey").asText()),row)==null);
            check(keys.size()==204);mappings=Map.copyOf(keys);
            var links=new LinkedHashMap<String,JsonNode>();
            for(var row:document.path("decisions")) links.put(row.path("id").asText(),row);
            decisions=Map.copyOf(links);
        } catch(KnowledgeDataException failure) { throw failure; }
        catch(Exception failure) { throw new KnowledgeDataException(); }
    }

    public Authorized authorize(TamTheExtendedRepository.Snapshot snapshot) {
        var bundle=snapshot==null?null:snapshot.bundle();
        if(bundle==null) throw denied(RuleUnavailableReason.RULE_STATE_UNAVAILABLE);
        if(!"VERIFIED".equals(bundle.status())) throw denied(RuleUnavailableReason.SOURCE_UNVERIFIED);
        if(bundle.reviewer()==null || bundle.reviewer().isBlank() || bundle.reviewedAt()==null)
            throw denied(RuleUnavailableReason.MISSING_SOURCE_REVIEW);
        var review=document.get("review");
        check(BUNDLE_ID.equals(bundle.id()) && ReviewedMaiHoaKnowledge.DOCUMENT_SHA.equals(bundle.sha256())
                && document.equals(bundle.document()) && review.path("editor").asText().equals(bundle.editor())
                && review.path("reviewer").asText().equals(bundle.reviewer())
                && Instant.parse(review.path("reviewedAt").asText()).equals(bundle.reviewedAt())
                && review.path("method").asText().equals(bundle.reviewMethod()));
        check(snapshot.results().size()==19 && snapshot.mappings().size()==204);
        var seen=new HashSet<String>();
        for(var row:snapshot.results()) {
            var expected=results.get(row.code());
            check(expected!=null && seen.add(row.code()) && BUNDLE_ID.equals(row.bundleId())
                    && expected.path("ruleCode").asText().equals(row.ruleCode()) && expected.path("column").asInt()==row.column()
                    && expected.path("title").asText().equals(row.title()) && expected.path("tableLabel").asText().equals(row.tableLabel())
                    && expected.path("contentHeading").asText().equals(row.contentHeading()) && expected.path("content").asText().equals(row.content())
                    && expected.path("textKind").asText().equals(row.textKind()) && expected.equals(row.sourceRecord())
                    && BOOK_SHA.equals(row.bookSha()) && row.bookPages()==360 && "Diễn Cầm Tam Thế Diễn Nghĩa".equals(row.bookTitle()));
        }
        seen.clear();
        for(var row:snapshot.mappings()) {
            String key=identity(row.ruleCode(),row.lookupKey());var expected=mappings.get(key);
            check(expected!=null && seen.add(key) && BUNDLE_ID.equals(row.bundleId())
                    && expected.path("resultCode").asText().equals(row.resultCode())
                    && expected.path("tableRow").asInt()==row.tableRow() && expected.path("tableColumn").asInt()==row.tableColumn());
        }
        var definitions=new ArrayList<RuleDefinition>();var states=new HashMap<String,RuleState>();
        for(String code:List.of(SANG_HEN,DIEN_SAN)) {
            var sources=results.values().stream().filter(row->code.equals(row.path("ruleCode").asText()))
                    .sorted(Comparator.comparing(row->row.path("code").asText()))
                    .flatMap(row->resultSources(row).stream()).distinct().toList();
            definitions.add(new RuleDefinition(code,RuleModule.TAM_THE,"1.0",ExecutionPolicy.SOURCE_VERIFIED,List.of()));
            states.put(code,new RuleState(code,RuleModule.TAM_THE,"1.0",SourceStatus.VERIFIED,sources,bundle.reviewer(),bundle.reviewedAt()));
        }
        var registry=new RuleRegistry(new RuleCatalog(definitions),code->Optional.ofNullable(states.get(code)));
        var proofs=registry.authorizeAll(List.of(SANG_HEN,DIEN_SAN),RulePurpose.INTERPRETATION);
        return new Authorized(this,proofs);
    }

    public static final class Authorized {
        private final ReviewedTamTheWealth knowledge;
        private final List<RuleEvidence> proofs;
        private Authorized(ReviewedTamTheWealth knowledge,List<RuleEvidence> proofs) { this.knowledge=knowledge;this.proofs=proofs; }
        public List<RuleEvidence> proofs() { return proofs; }
        public WealthSubreading lookup(WealthSubreading.Code code,String key) {
            String rule=switch(code) {case SANG_HEN->SANG_HEN;case DIEN_SAN->DIEN_SAN;default->throw new IllegalArgumentException("Not a supplemental lookup");};
            var mapping=knowledge.mappings.get(identity(rule,key));
            if(mapping==null) throw new RuleNotAvailableException(rule,RuleUnavailableReason.LOOKUP_NOT_AVAILABLE);
            var row=knowledge.results.get(mapping.path("resultCode").asText());
            var links=new ArrayList<ReadingDecision>();
            for(var id:row.path("decisionIds")) links.add(knowledge.decision(id.asText()));
            var sources=resultSources(row);
            var entry=new TamTheResult.InterpretationEntry(row.path("code").asText(),row.path("title").asText(),row.path("content").asText(),sources,code);
            return new WealthSubreading(code,WealthSubreading.Status.MATCHED,rule,key,List.of(entry),null,sources,links);
        }
    }

    private ReadingDecision decision(String id) {
        var row=decisions.get(id);check(row!=null && "TEAM_DECISION".equals(row.path("basis").asText()));
        var decision=new ReadingDecision(id,ReadingDecision.Purpose.valueOf(row.path("purpose").asText()),RuleBasis.TEAM_DECISION,
                SourceStatus.valueOf(row.path("sourceStatus").asText()),row.path("policy").asText(),row.path("detail").asText(),
                row.path("limitation").asText(),references(row.get("source"),id));
        // A link/calculation convention is authorized separately, never as interpretation text.
        String code="D04-"+id;
        var definition=new RuleDefinition(code,RuleModule.TAM_THE,"1.0",ExecutionPolicy.TEAM_DECISION,List.of(
                new DecisionReference(id,"2026-10-26","docs/38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md",decision.description())));
        var state=new RuleState(code,RuleModule.TAM_THE,"1.0",decision.sourceStatus(),decision.sourceReferences(),null,null);
        new RuleRegistry(new RuleCatalog(List.of(definition)),ignored->Optional.of(state)).authorize(code,RulePurpose.CALCULATION);
        return decision;
    }

    private static List<SourceReference> resultSources(JsonNode row) {
        var sources=new LinkedHashSet<SourceReference>();
        sources.addAll(references(row.get("tableSource"),row.path("ruleCode").asText()+"/TABLE"));
        sources.addAll(references(row.get("contentSource"),row.path("ruleCode").asText()+"/CONTENT"));
        return List.copyOf(sources);
    }
    private static List<SourceReference> references(JsonNode location,String section) {
        check(location!=null && "TT".equals(location.path("book").asText()));
        var pdf=location.path("pdfPages");var printed=location.path("printedPages");
        check(pdf.isArray() && !pdf.isEmpty() && pdf.size()==printed.size());
        var sources=new ArrayList<SourceReference>();
        for(int i=0;i<pdf.size();i++) sources.add(new SourceReference("TT-M01","Diễn Cầm Tam Thế Diễn Nghĩa","M01-1.0",section,
                printed.get(i).asText(),pdf.get(i).asInt(),BOOK_SHA,null));
        return List.copyOf(sources);
    }
    private static String identity(String rule,String key) { return rule+"/"+key; }
    private static RuleNotAvailableException denied(RuleUnavailableReason reason) {return new RuleNotAvailableException("TT-WEALTH-EXTENDED",reason);}
    private static void check(boolean value) { if(!value) throw new KnowledgeDataException(); }
}
