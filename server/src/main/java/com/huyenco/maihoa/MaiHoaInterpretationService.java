package com.huyenco.maihoa;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.calendar.*;
import com.huyenco.common.dto.*;
import com.huyenco.common.dto.DetailedReading.*;
import com.huyenco.common.dto.MaiHoaReadingOptions.Topic;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.knowledge.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public final class MaiHoaInterpretationService {
    private final MaiHoaReadingRepository repository;
    private final ObjectMapper mapper;
    private final CalendarService calendar;
    private volatile ReviewedMaiHoaKnowledge knowledge;
    public MaiHoaInterpretationService(MaiHoaReadingRepository repository,ObjectMapper mapper,CalendarService calendar) {
        this.repository=repository;this.mapper=mapper;this.calendar=calendar;
    }

    /** No interpretation is emitted until this fresh DB snapshot has passed every source/review gate. */
    public Prepared prepare(JsonNode payload) {
        ContractValidator.validateMaiHoa(payload);
        Topic topic=Topic.valueOf(payload.path("reading").path("topic").asText());
        String time="TIME".equals(payload.path("method").asText()) ? payload.path("datetime").textValue()
                : payload.path("reading").path("context").path("datetime").textValue();
        var authorized=knowledge().authorize(repository.readingSnapshot(),topic,time!=null);
        Context context=null;
        if(time!=null) {
            var local=OffsetDateTime.parse(time).withOffsetSameInstant(VietnameseLunarCalendar.OFFSET);
            var date=calendar.convert(new CalendarInput("SOLAR",local.getYear(),local.getMonthValue(),local.getDayOfMonth(),false));
            context=new Context(local,date.lunarDate(),date.rules());
        }
        return new Prepared(authorized,context);
    }
    private ReviewedMaiHoaKnowledge knowledge() {
        var cached=knowledge;
        if(cached==null) synchronized(this) {
            cached=knowledge;
            if(cached==null) knowledge=cached=new ReviewedMaiHoaKnowledge(mapper);
        }
        return cached;
    }

    public DetailedReading interpret(Prepared prepared,MaiHoaLines.Calculation calculation,TrigramIndex index) {
        validateTrigrams(index);
        Side bodySide=calculation.movingLine()<=3?Side.UPPER:Side.LOWER;
        Side useSide=bodySide==Side.UPPER?Side.LOWER:Side.UPPER;
        var body=role(calculation.primary(),bodySide,index);
        var use=role(calculation.primary(),useSide,index);
        var comparisons=List.of(use,role(calculation.mutual(),bodySide,index),role(calculation.mutual(),useSide,index),
                role(calculation.changed(),useSide,index));
        var phases=new ArrayList<Phase>();
        for(int i=0;i<4;i++) {
            var comparator=comparisons.get(i);var relation=relation(body.element(),comparator.element());
            var template=prepared.authorized().templates().get(relation);
            phases.add(new Phase(PhaseKind.values()[i],comparator,relation,template.code(),template.content(),
                    TextKind.EDITORIAL_PARAPHRASE,RuleBasis.SOURCE_VERIFIED,SourceStatus.VERIFIED,template.sources()));
        }
        SeasonReading season;
        if(prepared.context()==null) season=new SeasonReading(SeasonStatus.NOT_EVALUATED,SeasonReason.MISSING_READING_TIME,
                null,null,null,null,List.of());
        else {
            var context=prepared.context();var group=season(context.lunarDate().month());
            var sources=prepared.authorized().decisions().stream().filter(d->d.decisionId().endsWith("-SEASON"))
                    .flatMap(d->d.sourceReferences().stream()).toList();
            season=new SeasonReading(SeasonStatus.EVALUATED,null,context.datetime().toString(),context.lunarDate(),group,
                    strength(body.element(),group),sources);
        }
        // Summarize the four actual relation findings without inventing an aggregate score or event.
        String[] labels={"Mở đầu", "Giữa — hỗ phía Thể", "Giữa — hỗ phía Dụng", "Cuối — Dụng biến"};
        var summary=new StringJoiner(" ");
        for(int i=0;i<4;i++) summary.add(labels[i]+": "+phases.get(i).content());
        summary.add("Các quái đối chiếu đều được so với Thể gốc. Giữ riêng từng giai đoạn; nội dung câu hỏi không tạo thêm sự kiện hoặc thời hạn ứng nghiệm.");
        var references=new LinkedHashSet<SourceReference>();
        phases.forEach(p->references.addAll(p.sourceReferences()));
        prepared.authorized().proofs().forEach(p->references.addAll(p.sourceReferences()));
        if(prepared.context()!=null) prepared.context().proofs().forEach(p->references.addAll(p.sourceReferences()));
        return new DetailedReading("1.0",ReviewedMaiHoaKnowledge.BUNDLE_ID,prepared.authorized().topic(),TextKind.EDITORIAL_PARAPHRASE,
                body,use,phases,season,summary.toString(),prepared.authorized().decisions(),List.copyOf(references));
    }

    public static Relation relation(Element body,Element use) {
        if(body==use) return Relation.SAME_ELEMENT;
        if(generates(use)==body) return Relation.USE_GENERATES_BODY;
        if(generates(body)==use) return Relation.BODY_GENERATES_USE;
        if(controls(body)==use) return Relation.BODY_CONTROLS_USE;
        return Relation.USE_CONTROLS_BODY;
    }
    public List<CalculationStep> steps(DetailedReading reading,int movingLine) {
        var phases=reading.phases();var season=reading.season();var steps=new ArrayList<CalculationStep>();
        steps.add(new CalculationStep("READING_BODY_USE","Theo quy ước nhóm: phía không chứa hào động là Thể; giữ Thể gốc khi xét các giai đoạn.",
                Map.of("movingLine",movingLine,"bodySide",reading.body().side().name(),"bodyTrigram",reading.body().trigramCode().name(),
                        "bodyElement",reading.body().element().name(),"useTrigram",reading.use().trigramCode().name(),"useElement",reading.use().element().name())));
        steps.add(new CalculationStep("READING_PHASES","So từng quái với Thể gốc; hai quái hỗ được xét riêng, không cộng điểm.",
                Map.of("initialRelation",phases.get(0).relation().name(),"bodyMutualRelation",phases.get(1).relation().name(),
                        "useMutualRelation",phases.get(2).relation().name(),"finalRelation",phases.get(3).relation().name())));
        steps.add(season.status()==SeasonStatus.NOT_EVALUATED
                ? new CalculationStep("READING_SEASON","Không xét mùa vì thiếu thời điểm lập quẻ; không sử dụng ngày máy.",Map.of("status","NOT_EVALUATED","reason","MISSING_READING_TIME"))
                : new CalculationStep("READING_SEASON","Phân loại mùa theo tháng âm và quy ước nhóm; đây không phải thuật toán tiết khí.",
                    Map.of("status","EVALUATED","lunarMonth",season.lunarDate().month(),"isLeapMonth",season.lunarDate().isLeapMonth(),
                            "season",season.season().name(),"bodyStrength",season.bodyStrength().name(),"ruleBasis","TEAM_DECISION")));
        return List.copyOf(steps);
    }
    private static Element generates(Element element) {
        return switch(element) { case MOC->Element.HOA; case HOA->Element.THO; case THO->Element.KIM; case KIM->Element.THUY; case THUY->Element.MOC; };
    }
    private static Element controls(Element element) {
        return switch(element) { case MOC->Element.THO; case THO->Element.THUY; case THUY->Element.HOA; case HOA->Element.KIM; case KIM->Element.MOC; };
    }
    public static Season season(int month) {
        return switch(month) { case 1,2->Season.SPRING; case 4,5->Season.SUMMER; case 7,8->Season.AUTUMN;
            case 10,11->Season.WINTER; case 3,6,9,12->Season.EARTH_MONTH; default->throw new IllegalArgumentException("Invalid lunar month"); };
    }
    public static Strength strength(Element body,Season season) {
        Element strong=switch(season) { case SPRING->Element.MOC; case SUMMER->Element.HOA; case AUTUMN->Element.KIM; case WINTER->Element.THUY; case EARTH_MONTH->Element.THO; };
        Element weak=switch(season) { case SPRING->Element.THO; case SUMMER->Element.KIM; case AUTUMN->Element.MOC; case WINTER->Element.HOA; case EARTH_MONTH->Element.THUY; };
        return body==strong?Strength.VIGOROUS:body==weak?Strength.WEAK:Strength.UNCLASSIFIED;
    }
    private static TrigramRole role(List<Boolean> lines,Side side,TrigramIndex index) {
        int start=side==Side.UPPER?3:0;var trigram=index.find(lines.subList(start,start+3));
        return new TrigramRole(side,Trigram.valueOf(trigram.code()),Element.valueOf(trigram.element()));
    }
    public static void validateTrigrams(TrigramIndex index) {
        String[] codes={"CAN","DOAI","LY","CHAN","TON","KHAM","CAN2","KHON"};
        Element[] elements={Element.KIM,Element.KIM,Element.HOA,Element.MOC,Element.MOC,Element.THUY,Element.THO,Element.THO};
        int[] patterns={7,3,5,1,6,2,4,0};
        for(int i=0;i<8;i++) {
            var row=index.find(i+1);int bits=0;for(int line=0;line<3;line++) if(row.linesBottomUp().get(line)) bits|=1<<line;
            if(!codes[i].equals(row.code()) || !elements[i].name().equals(row.element()) || bits!=patterns[i]) throw new KnowledgeDataException();
        }
    }
    public static void validateCoreEvidence(List<RuleEvidence> proofs) {
        for(var expected:Map.of("MH-TRIGRAM",new String[]{"39","44","MH-QUAI-SO"},
                "MH-MUTUAL",new String[]{"42","47","MH-QUE-HO-BIEN"},"MH-CHANGE",new String[]{"41","46","MH-HAO-6"}).entrySet()) {
            var proof=proofs.stream().filter(p->p.ruleCode().equals(expected.getKey())).findFirst().orElseThrow(KnowledgeDataException::new);
            var location=expected.getValue();
            if(proof.sourceReferences().size()!=1 || proof.sourceReferences().stream().anyMatch(s->!"MH".equals(s.sourceId())
                    || !ReviewedMaiHoaKnowledge.BOOK_SHA.equals(s.sha256()) || !Integer.valueOf(location[0]).equals(s.pdfPage())
                    || !location[1].equals(s.printedPage()) || !location[2].equals(s.section())))
                throw new RuleNotAvailableException(expected.getKey(),RuleUnavailableReason.RULE_VERSION_MISMATCH);
        }
    }
    public record Context(OffsetDateTime datetime,LunarDate lunarDate,List<RuleEvidence> proofs) { }
    public record Prepared(ReviewedMaiHoaKnowledge.Authorized authorized,Context context) { }
}
