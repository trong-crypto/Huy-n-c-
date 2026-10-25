package com.huyenco.tamthe;

import com.fasterxml.jackson.databind.JsonNode;
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
import static com.huyenco.tamthe.TamTheKnowledge.*;

@Service
public class TamTheService {
    private final CalendarService calendar;
    private final TamTheRepository repository;
    private final RuleCatalog catalog;

    public TamTheService(CalendarService calendar, TamTheRepository repository, RuleCatalog catalog) {
        this.calendar=calendar; this.repository=repository; this.catalog=catalog;
    }

    public TamTheResult calculate(JsonNode payload) { return calculate(payload,CalculationProgress.NONE); }

    public TamTheResult calculate(JsonNode payload, CalculationProgress progress) {
        ContractValidator.validateTamThe(payload);
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
        var snapshot=repository.tamThe(required);
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
        progress.report(Step.CALCULATING,"Đang xác định hành mệnh và khóa tra theo năm, tháng âm.");
        var year=knowledge.year(converted.year().stem(),converted.year().branch());
        String month=String.format(Locale.ROOT,"%02d",converted.lunarDate().month());
        String stemKey="STEM:"+converted.year().stem()+"|MONTH:"+month;
        String elementKey="ELEMENT:"+year.resultCode()+"|MONTH:"+month;
        progress.report(Step.LOOKUP,"Đang tra các mục đã duyệt và đầy đủ trang nguồn.");
        var used=new ArrayList<TamTheSnapshot.Entry>();used.add(year);
        var results=new ArrayList<TamTheResult.CategoryResult>();
        for(var category:categories) {
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
        return new TamTheResult(evidence.ruleVersion(),evidence.ruleBasis(),evidence.sourceStatus(),evidence.rules(),
                evidence.sourceReferences(),evidence.decisionReferences(),results);
    }

    private static List<String> categoryRules(TamTheCategory category) {
        return switch(category) {case CAREER->List.of(CAREER11,CAREER13);case WEALTH->List.of(WEALTH);case LOVE->List.of(LOVE);};
    }
}

