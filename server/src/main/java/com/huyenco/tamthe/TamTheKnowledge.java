package com.huyenco.tamthe;

import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.dto.TamTheResult.InterpretationEntry;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.exception.RuleUnavailableReason;
import com.huyenco.knowledge.*;
import java.util.*;
import java.util.stream.Collectors;

/** Validates table structure before distinguishing a real missing key from data loss. */
public final class TamTheKnowledge {
    public static final String YEAR="TT-NGU-HANH", CAREER11="TT-CONG-DANH-11", CAREER13="TT-CONG-DANH-13",
            WEALTH="TT-TAI-LOC", LOVE="TT-TINH-DUYEN";
    public static final String SHA="7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d";
    private static final List<String> STEMS=List.of("GIAP","AT","BINH","DINH","MAU","KY","CANH","TAN","NHAM","QUY");
    private static final List<String> BRANCHES=List.of("TY","SUU","DAN","MAO","THIN","TI","NGO","MUI","THAN","DAU","TUAT","HOI");
    private static final Set<String> ELEMENTS=Set.of("KIM","MOC","THUY","HOA","THO");
    private static final List<String> JOBS=List.of("MUA_BAN","CAU_CHAI","LAM_THO");
    private final Map<String,List<TamTheSnapshot.Entry>> tables;

    public TamTheKnowledge(TamTheSnapshot snapshot, Set<String> required) {
        tables=snapshot.entries().stream().collect(Collectors.groupingBy(TamTheSnapshot.Entry::ruleCode));
        require(tables.keySet().equals(required));
        var identities=new HashSet<String>();
        for (var entry:snapshot.entries()) {
            require(identities.add(entry.ruleCode()+"/"+entry.key()+"/"+entry.resultCode()));
            validateEntry(entry);
        }
        for (String code:required) validateTable(code,tables.get(code));
    }

    public static boolean sourceMatches(SourceReference ref, int page, String label) {
        return ref!=null && ref.hasTraceableLocation() && "TT".equals(ref.sourceId()) && SHA.equals(ref.sha256())
                && Integer.valueOf(page).equals(ref.pdfPage()) && String.valueOf(page+1).equals(ref.printedPage())
                && label.equals(ref.section());
    }

    public static Map.Entry<Integer,String> ruleLocation(String rule) {
        return switch(rule) {
            case YEAR -> Map.entry(11,YEAR);
            case CAREER11 -> Map.entry(32,CAREER11);
            case CAREER13 -> Map.entry(35,CAREER13);
            case WEALTH -> Map.entry(41,"D02-TT-P041");
            case LOVE -> Map.entry(63,"D02-TT-P063");
            default -> throw new KnowledgeDataException();
        };
    }

    private static void validateEntry(TamTheSnapshot.Entry e) {
        if (e.status()!=SourceStatus.VERIFIED) throw new RuleNotAvailableException(e.ruleCode(),RuleUnavailableReason.SOURCE_UNVERIFIED);
        if (!text(e.reviewer()) || e.reviewedAt()==null || !text(e.verificationNote()))
            throw new RuleNotAvailableException(e.ruleCode(),RuleUnavailableReason.MISSING_SOURCE_REVIEW);
        require("1.0".equals(e.ruleVersion()) && text(e.title()) && text(e.key()) && text(e.resultCode()));
        int tablePage=switch(e.ruleCode()) {case YEAR->11;case CAREER11->32;case CAREER13->35;case WEALTH->41;case LOVE->64;default->throw new KnowledgeDataException();};
        String label=(e.ruleCode().equals(WEALTH)||e.ruleCode().equals(LOVE)) ? pageLabel(tablePage):e.ruleCode();
        require(sourceMatches(e.tableSource(),tablePage,label));
        if (e.ruleCode().equals(YEAR)||e.ruleCode().equals(CAREER11)) {
            require(e.content()==null && e.firstContentSource()==null && e.contentPages().isEmpty()
                    && e.tableLabel()==null && e.contentHeading()==null);
            return;
        }
        require(text(e.content()) && text(e.tableLabel()) && text(e.contentHeading()) && e.title().equals(e.tableLabel()));
        int column=column(e.resultCode(),switch(e.ruleCode()) {case CAREER13->"CAREER13_C";case WEALTH->"WEALTH_C";case LOVE->"LOVE_C";default->throw new KnowledgeDataException();});
        List<Integer> pages;
        if (e.ruleCode().equals(CAREER13)) pages=List.of(column<=3?35:36);
        else if (e.ruleCode().equals(WEALTH)) pages=List.of(column<=3?41:42);
        else pages=switch(column) {
            case 1,2->List.of(64);case 3->List.of(64,65);case 4,5->List.of(65);case 6->List.of(65,66);
            case 7,8,9->List.of(66);case 10->List.of(66,67);case 11,12->List.of(67);default->throw new KnowledgeDataException();
        };
        String firstLabel=e.ruleCode().equals(CAREER13)?(pages.get(0)==35?CAREER13:"TT-CONG-DANH-13-TEXT"):pageLabel(pages.get(0));
        require(sourceMatches(e.firstContentSource(),pages.get(0),firstLabel));
        if (e.ruleCode().equals(CAREER13)) require(e.contentPages().isEmpty()); // D01 predates V9; one-page passages.
        else {
            require(e.contentPages().size()==pages.size());
            for (int i=0;i<pages.size();i++) require(e.contentPages().get(i).order()==i+1
                    && sourceMatches(e.contentPages().get(i).source(),pages.get(i),pageLabel(pages.get(i))));
            require(e.contentPages().get(0).source().equals(e.firstContentSource()));
        }
        if (e.ruleCode().equals(LOVE)) require(e.content().lines().count()==8);
    }

    private static void validateTable(String rule,List<TamTheSnapshot.Entry> entries) {
        int count=switch(rule) {case YEAR,LOVE->60;case CAREER11->51;case CAREER13,WEALTH->120;default->throw new KnowledgeDataException();};
        require(entries!=null && entries.size()==count);
        if (rule.equals(YEAR)) {
            var keys=new HashSet<String>();
            for (int i=0;i<60;i++) keys.add("STEM:"+STEMS.get(i%10)+"|BRANCH:"+BRANCHES.get(i%12));
            require(entries.stream().map(TamTheSnapshot.Entry::key).collect(Collectors.toSet()).equals(keys)
                    && entries.stream().allMatch(e->ELEMENTS.contains(e.resultCode())));
            return;
        }
        var expectedKeys=new HashSet<String>();
        boolean byElement=rule.equals(CAREER11)||rule.equals(LOVE);
        for (String value:byElement?ELEMENTS:STEMS) for(int m=1;m<=12;m++)
            if (!rule.equals(WEALTH) || m%2==(STEMS.indexOf(value)+1)%2)
                expectedKeys.add((byElement?"ELEMENT:":"STEM:")+value+"|MONTH:"+String.format(Locale.ROOT,"%02d",m));
        var grouped=entries.stream().collect(Collectors.groupingBy(TamTheSnapshot.Entry::key));
        if (rule.equals(CAREER11)) {
            require(expectedKeys.containsAll(grouped.keySet()) && entries.stream().allMatch(e->JOBS.contains(e.resultCode())));
        } else {
            require(grouped.keySet().equals(expectedKeys));
            require(grouped.values().stream().allMatch(group->group.size()==(rule.equals(WEALTH)?2:1)));
            // Each printed row must contain each column once, even where months repeat.
            var rows=entries.stream().collect(Collectors.groupingBy(e->e.key().split("\\|")[0]));
            for (var row:rows.values()) require(row.size()==12 && row.stream().map(TamTheSnapshot.Entry::resultCode).distinct().count()==12);
        }
    }

    public TamTheSnapshot.Entry year(String stem,String branch) {
        return matches(YEAR,"STEM:"+stem+"|BRANCH:"+branch).stream().findFirst().orElseThrow(KnowledgeDataException::new);
    }

    public List<TamTheSnapshot.Entry> matches(String rule,String key) {
        return tables.get(rule).stream().filter(e->e.key().equals(key)).sorted(Comparator.comparingInt(e ->
                rule.equals(CAREER11)?JOBS.indexOf(e.resultCode()):rule.equals(YEAR)?0:Integer.parseInt(e.resultCode().substring(e.resultCode().length()-2)))).toList();
    }

    public static InterpretationEntry view(TamTheSnapshot.Entry entry) {
        String title=entry.title();
        if (entry.contentHeading()!=null && !entry.tableLabel().equalsIgnoreCase(entry.contentHeading()))
            title += " (đoạn: "+entry.contentHeading()+")";
        // S11 contains an occupation table, not a prose prediction. Label this as a table summary.
        String content=entry.ruleCode().equals(CAREER11)?"Bảng Số 11 ghi nghề: "+entry.title()+".":entry.content();
        return new InterpretationEntry(entry.resultCode(),title,content,references(entry));
    }

    public static List<SourceReference> references(TamTheSnapshot.Entry e) {
        var refs=new LinkedHashSet<SourceReference>();refs.add(e.tableSource());
        if(e.firstContentSource()!=null) refs.add(e.firstContentSource());
        e.contentPages().forEach(page->refs.add(page.source()));
        return List.copyOf(refs);
    }

    private static int column(String code,String prefix) {
        require(code!=null && code.matches(prefix+"(0[1-9]|1[0-2])"));
        return Integer.parseInt(code.substring(prefix.length()));
    }
    private static String pageLabel(int page) {return "D02-TT-P"+String.format(Locale.ROOT,"%03d",page);}
    private static boolean text(String value) {return value!=null && !value.isBlank();}
    private static void require(boolean condition) {if(!condition)throw new KnowledgeDataException();}
}
