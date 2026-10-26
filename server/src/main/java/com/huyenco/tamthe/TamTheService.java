package com.huyenco.tamthe;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.calendar.CalendarInput;
import com.huyenco.calendar.CalendarService;
import com.huyenco.common.dto.*;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.knowledge.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import static com.huyenco.tamthe.TamTheKnowledge.*;

@Service
public class TamTheService {
    private final CalendarService calendar;
    private final TamTheRepository repository;
    private final RuleCatalog catalog;
    private final TamTheExtendedRepository extendedRepository;
    private final ObjectMapper mapper;
    private volatile ReviewedTamTheWealth extendedKnowledge;

    public TamTheService(CalendarService calendar, TamTheRepository repository, RuleCatalog catalog) {
        this(calendar,repository,catalog,null,null);
    }

    @Autowired
    public TamTheService(CalendarService calendar, TamTheRepository repository, RuleCatalog catalog,
                         TamTheExtendedRepository extendedRepository, ObjectMapper mapper) {
        this.calendar=calendar; this.repository=repository; this.catalog=catalog;
        this.extendedRepository=extendedRepository;this.mapper=mapper;
    }

    public TamTheResult calculate(JsonNode payload) { return calculate(payload,CalculationProgress.NONE); }

    public TamTheResult calculate(JsonNode payload, CalculationProgress progress) {
        ContractValidator.validateTamThe(payload);
        boolean extended="EXTENDED".equals(payload.path("wealthMode").asText());
        // Explicitly unconfigured test/embedded callers must never silently downgrade.
        if (extended && extendedRepository==null) {
            throw new RuleNotAvailableException("TT-WEALTH-EXTENDED");
        }
        String date=payload.get("birthDate").textValue();
        var input=new CalendarInput(payload.get("calendarType").textValue(),Integer.parseInt(date.substring(0,4)),
                Integer.parseInt(date.substring(5,7)),Integer.parseInt(date.substring(8,10)),payload.get("isLeapMonth").booleanValue());
        // These common categories use lunar year/month, not the seasonal hour table.
        // birthTime is validated by the request contract and never echoed.
        var converted=calendar.canChi(input,null);
        List<TamTheCategory> categories=new ArrayList<>();
        if(payload.has("categories")) payload.get("categories").forEach(c->categories.add(TamTheCategory.valueOf(c.textValue())));
        else categories.addAll(List.of(TamTheCategory.CAREER,TamTheCategory.WEALTH,TamTheCategory.LOVE));
        var required=new LinkedHashSet<String>();required.add(YEAR);
        for(var category:categories) required.addAll(categoryRules(category));
        var extendedSnapshot=extended?extendedRepository.extended(required):null;
        var supplementary=extended?extendedKnowledge().authorize(extendedSnapshot):null;
        var snapshot=extended?extendedSnapshot.base():repository.tamThe(required);
        var registry=new RuleRegistry(catalog,code->Optional.ofNullable(snapshot.rules().get(code)));
        var proofs=new ArrayList<RuleEvidence>(converted.rules());
        for(String code:required) {
            var proof=registry.authorize(code,code.equals(YEAR)?RulePurpose.CALCULATION:RulePurpose.INTERPRETATION);
            var location=ruleLocation(code);
            if(proof.sourceReferences().size()!=1 || !sourceMatches(proof.sourceReferences().get(0),location.getKey(),location.getValue()))
                throw new RuleNotAvailableException(code,RuleUnavailableReason.MISSING_SOURCE_REFERENCE);
            proofs.add(proof);
        }
        var knowledge=new TamTheKnowledge(snapshot,required);
        if(extended) proofs.addAll(supplementary.proofs());
        progress.report(Step.CALCULATING,"Đang xác định hành mệnh và khóa tra theo năm, tháng âm.");
        var year=knowledge.year(converted.year().stem(),converted.year().branch());
        String month=String.format(Locale.ROOT,"%02d",converted.lunarDate().month());
        String stemKey="STEM:"+converted.year().stem()+"|MONTH:"+month;
        String elementKey="ELEMENT:"+year.resultCode()+"|MONTH:"+month;
        progress.report(Step.LOOKUP,"Đang tra các mục đã duyệt và đầy đủ trang nguồn.");
        var used=new ArrayList<TamTheSnapshot.Entry>();used.add(year);
        var results=new ArrayList<TamTheResult.CategoryResult>();
        var editorial=new LinkedHashSet<ReadingDecision>();
        for(var category:categories) {
            if(extended && category==TamTheCategory.WEALTH) {
                var locMatches=knowledge.matches(WEALTH,stemKey);used.addAll(locMatches);
                var locEntries=locMatches.stream().map(TamTheKnowledge::view).map(e->
                        new TamTheResult.InterpretationEntry(e.resultCode(),e.title(),e.content(),e.sourceReferences(),WealthSubreading.Code.LOC)).toList();
                var locSources=new LinkedHashSet<>(snapshot.rules().get(WEALTH).sourceReferences());
                locMatches.forEach(e->locSources.addAll(references(e)));
                var loc=new WealthSubreading(WealthSubreading.Code.LOC,locEntries.isEmpty()?WealthSubreading.Status.NO_SOURCE_MATCH:WealthSubreading.Status.MATCHED,
                        WEALTH,stemKey,locEntries,locEntries.isEmpty()?WealthSubreading.Reason.NO_PRINTED_INTERSECTION:null,List.copyOf(locSources),List.of());
                String branchKey="BRANCH:"+converted.year().branch()+"|MONTH:"+month;
                var subs=List.of(loc,supplementary.lookup(WealthSubreading.Code.SANG_HEN,branchKey),
                        supplementary.lookup(WealthSubreading.Code.DIEN_SAN,elementKey));
                subs.forEach(sub->editorial.addAll(sub.decisionReferences()));
                results.add(new TamTheResult.CategoryResult(category,subs.stream().flatMap(sub->sub.entries().stream()).toList(),subs));
                continue;
            }
            var selected=new ArrayList<TamTheSnapshot.Entry>();
            for(String code:categoryRules(category)) {
                var matches=knowledge.matches(code,code.equals(CAREER11)||code.equals(LOVE)?elementKey:stemKey);
                if(matches.isEmpty() && !code.equals(CAREER11))
                    throw new RuleNotAvailableException(code,RuleUnavailableReason.LOOKUP_NOT_AVAILABLE);
                selected.addAll(matches);
            }
            used.addAll(selected);
            results.add(new TamTheResult.CategoryResult(category,selected.stream().map(TamTheKnowledge::view).toList()));
        }
        var enriched=proofs.stream().map(proof->{
            var refs=new LinkedHashSet<>(proof.sourceReferences());
            used.stream().filter(e->e.ruleCode().equals(proof.ruleCode())).forEach(e->refs.addAll(references(e)));
            return new RuleEvidence(proof.ruleCode(),proof.ruleVersion(),proof.executionPolicy(),proof.ruleBasis(),
                    proof.sourceStatus(),List.copyOf(refs),proof.decisionReferences());
        }).toList();
        var evidence=EvidenceSummary.from(enriched);
        if(extended) {
            var refs=new LinkedHashSet<>(evidence.sourceReferences());editorial.forEach(d->refs.addAll(d.sourceReferences()));
            return new TamTheResult(evidence.ruleVersion(),evidence.ruleBasis(),evidence.sourceStatus(),evidence.rules(),
                    List.copyOf(refs),evidence.decisionReferences(),results,TamTheResult.WealthMode.EXTENDED,
                    ReviewedTamTheWealth.BUNDLE_ID,List.copyOf(editorial));
        }
        return new TamTheResult(evidence.ruleVersion(),evidence.ruleBasis(),evidence.sourceStatus(),evidence.rules(),
                evidence.sourceReferences(),evidence.decisionReferences(),results);
    }

    private ReviewedTamTheWealth extendedKnowledge() {
        var cached=extendedKnowledge;
        if(cached==null) synchronized(this) {
            cached=extendedKnowledge;
            if(cached==null) extendedKnowledge=cached=new ReviewedTamTheWealth(mapper);
        }
        return cached;
    }

    private static List<String> categoryRules(TamTheCategory category) {
        return switch(category) {case CAREER->List.of(CAREER11,CAREER13);case WEALTH->List.of(WEALTH);case LOVE->List.of(LOVE);};
    }
}

