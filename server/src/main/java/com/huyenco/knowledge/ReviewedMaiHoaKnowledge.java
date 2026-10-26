package com.huyenco.knowledge;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.dto.DetailedReading.Relation;
import com.huyenco.common.dto.MaiHoaReadingOptions.Topic;
import com.huyenco.common.exception.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.core.io.ClassPathResource;

/** Authorizes immutable M01 content only after matching the current DB attestation and every row. */
public final class ReviewedMaiHoaKnowledge {
    public static final String BUNDLE_ID="M01-READINGS-20261026-V1";
    public static final String DOCUMENT_SHA="e3c460cdfe1a96546b243155205d12e8a27c1e45882452344a7dafa778e295b6";
    public static final String BOOK_SHA="225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de";
    public static final String VERSION="1.0";
    private final JsonNode document;
    private final Map<String,JsonNode> expectedTemplates;
    private final Map<String,JsonNode> decisions;

    public ReviewedMaiHoaKnowledge(ObjectMapper mapper) {
        try(var stream=new ClassPathResource("readings/m01_reviewed_readings.json").getInputStream()) {
            String text=new String(stream.readAllBytes(),StandardCharsets.UTF_8).replace("\r\n","\n").replace('\r','\n');
            String sha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
            check(DOCUMENT_SHA.equals(sha));
            document=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readTree(text);
            check(BUNDLE_ID.equals(document.path("bundleId").asText()) && !document.path("runtimeEnabled").asBoolean(true));
            var templates=new LinkedHashMap<String,JsonNode>();
            for(var row:document.path("maiHoaTemplates")) check(templates.put(row.path("code").asText(),row)==null);
            check(templates.size()==20);expectedTemplates=Map.copyOf(templates);
            var policy=new LinkedHashMap<String,JsonNode>();
            for(var row:document.path("decisions")) policy.put(row.path("id").asText(),row);
            decisions=Map.copyOf(policy);
        } catch(KnowledgeDataException failure) { throw failure; }
        catch(Exception failure) { throw new KnowledgeDataException(); }
    }

    public Authorized authorize(MaiHoaReadingRepository.Snapshot snapshot, Topic topic, boolean season) {
        if(snapshot==null || snapshot.bundle()==null) throw new RuleNotAvailableException("MH-DETAILED-READING",RuleUnavailableReason.RULE_STATE_UNAVAILABLE);
        var bundle=snapshot.bundle();var review=document.get("review");
        if(!"VERIFIED".equals(bundle.status())) throw new RuleNotAvailableException("MH-DETAILED-READING",RuleUnavailableReason.SOURCE_UNVERIFIED);
        if(bundle.reviewer()==null || bundle.reviewer().isBlank() || bundle.reviewedAt()==null)
            throw new RuleNotAvailableException("MH-DETAILED-READING",RuleUnavailableReason.MISSING_SOURCE_REVIEW);
        check(BUNDLE_ID.equals(bundle.id()) && DOCUMENT_SHA.equals(bundle.sha256()) && document.equals(bundle.document())
                && review.path("editor").asText().equals(bundle.editor()) && review.path("reviewer").asText().equals(bundle.reviewer())
                && Instant.parse(review.path("reviewedAt").asText()).equals(bundle.reviewedAt())
                && review.path("method").asText().equals(bundle.reviewMethod()));
        check(snapshot.templates().size()==20);
        var seen=new HashSet<String>();
        for(var row:snapshot.templates()) {
            var expected=expectedTemplates.get(row.code());
            check(expected!=null && seen.add(row.code()) && BUNDLE_ID.equals(row.bundleId())
                    && expected.path("topic").asText().equals(row.topic()) && expected.path("relation").asText().equals(row.relation())
                    && expected.path("content").asText().equals(row.content()) && expected.path("textKind").asText().equals(row.textKind())
                    && expected.equals(row.sourceRecord()) && BOOK_SHA.equals(row.bookSha256()) && row.bookPages()==672
                    && "Mai Hoa Dịch Số".equals(row.bookTitle()));
        }
        var definitions=new ArrayList<RuleDefinition>();var states=new HashMap<String,RuleState>();
        var used=new ArrayList<ReadingDecision>();
        for(String suffix:season?List.of("BODY","PHASES","SEASON"):List.of("BODY","PHASES")) {
            var row=decisions.get("DEC-20261026-M01-"+suffix);
            String code="MH-READING-"+suffix;
            var decision=new ReadingDecision(row.path("id").asText(),ReadingDecision.Purpose.CALCULATION,RuleBasis.TEAM_DECISION,
                    SourceStatus.valueOf(row.path("sourceStatus").asText()),row.path("policy").asText(),row.path("detail").asText(),
                    row.path("limitation").asText(),references(row.get("source"),code));
            used.add(decision);
            var reference=new DecisionReference(decision.decisionId(),"2026-10-26","docs/38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md",decision.description());
            definitions.add(new RuleDefinition(code,RuleModule.MAI_HOA,VERSION,ExecutionPolicy.TEAM_DECISION,List.of(reference)));
            states.put(code,new RuleState(code,RuleModule.MAI_HOA,VERSION,decision.sourceStatus(),decision.sourceReferences(),bundle.reviewer(),bundle.reviewedAt()));
        }
        if(season) {
            String code="MH-READING-SEASON-STRENGTH";
            var decision=new ReadingDecision("DEC-20261026-M03-SEASON-STRENGTH",ReadingDecision.Purpose.CALCULATION,
                    RuleBasis.TEAM_DECISION,SourceStatus.SOURCE_LOCATED,"STRUCTURED_SEASON_STRENGTH",
                    "Phân loại theo quy ước: Xuân Mộc vượng/Thổ suy; Hạ Hỏa vượng/Kim suy; Thu Kim vượng/Mộc suy; Đông Thủy vượng/Hỏa suy; tháng Thổ: Thổ vượng/Thủy suy. Hành khác là UNCLASSIFIED.",
                    "Nguồn mùa M01 còn SOURCE_LOCATED. Chỉ trả phân loại có cấu trúc theo quy ước; không phát lời luận mùa SOURCE_VERIFIED, không tính điểm hoặc tự suy ra ngày ứng nghiệm.",
                    references(decisions.get("DEC-20261026-M01-SEASON").get("source"),code));
            used.add(decision);
            definitions.add(new RuleDefinition(code,RuleModule.MAI_HOA,VERSION,ExecutionPolicy.TEAM_DECISION,
                    List.of(new DecisionReference(decision.decisionId(),"2026-10-26","docs/41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md",decision.description()))));
            states.put(code,new RuleState(code,RuleModule.MAI_HOA,VERSION,SourceStatus.SOURCE_LOCATED,decision.sourceReferences(),null,null));
        }
        var topicTemplates=new EnumMap<Relation,Template>(Relation.class);
        for(Relation relation:Relation.values()) {
            var row=expectedTemplates.get("MH-"+topic+"-"+relation);
            check(row!=null && "VERIFIED".equals(row.path("sourceStatus").asText()) && "SOURCE_VERIFIED".equals(row.path("basis").asText()));
            topicTemplates.put(relation,new Template(row.path("code").asText(),row.path("content").asText(),references(row.get("source"),row.path("code").asText())));
        }
        String topicCode="MH-READING-"+topic;
        for(String code:List.of("MH-READING-RELATIONS",topicCode)) {
            List<SourceReference> sources=code.endsWith("RELATIONS") ? references(decisions.get("DEC-20261026-M01-RELATIONS").get("source"),code)
                    : topicTemplates.values().stream().flatMap(t->t.sources().stream()).distinct().toList();
            definitions.add(new RuleDefinition(code,RuleModule.MAI_HOA,VERSION,ExecutionPolicy.SOURCE_VERIFIED,List.of()));
            states.put(code,new RuleState(code,RuleModule.MAI_HOA,VERSION,SourceStatus.VERIFIED,sources,bundle.reviewer(),bundle.reviewedAt()));
        }
        var registry=new RuleRegistry(new RuleCatalog(definitions),code->Optional.ofNullable(states.get(code)));
        var proofs=new ArrayList<RuleEvidence>();
        for(var definition:definitions) if(definition.executionPolicy()==ExecutionPolicy.TEAM_DECISION)
            proofs.add(registry.authorize(definition.ruleCode(),RulePurpose.CALCULATION));
        proofs.add(registry.authorize("MH-READING-RELATIONS",RulePurpose.INTERPRETATION));
        proofs.add(registry.authorize(topicCode,RulePurpose.INTERPRETATION));
        return new Authorized(topic,Map.copyOf(topicTemplates),List.copyOf(used),List.copyOf(proofs));
    }

    public static List<SourceReference> references(JsonNode location,String section) {
        check(location!=null && "MH".equals(location.path("book").asText()));
        var sources=new ArrayList<SourceReference>();
        var pdf=location.path("pdfPages");var printed=location.path("printedPages");check(pdf.isArray() && pdf.size()>0 && pdf.size()==printed.size());
        for(int i=0;i<pdf.size();i++) sources.add(new SourceReference("MH-M01","Mai Hoa Dịch Số","M01-1.0",section,
                printed.get(i).asText(),pdf.get(i).asInt(),BOOK_SHA,null));
        return List.copyOf(sources);
    }
    private static void check(boolean valid) { if(!valid) throw new KnowledgeDataException(); }
    public record Template(String code,String content,List<SourceReference> sources) { }
    public record Authorized(Topic topic,Map<Relation,Template> templates,List<ReadingDecision> decisions,List<RuleEvidence> proofs) { }
}
