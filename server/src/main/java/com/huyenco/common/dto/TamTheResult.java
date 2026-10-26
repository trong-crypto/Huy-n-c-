package com.huyenco.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record TamTheResult(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                           List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                           List<DecisionReference> decisionReferences, List<CategoryResult> categories,
                           @JsonInclude(JsonInclude.Include.NON_NULL) WealthMode coverageMode,
                           @JsonInclude(JsonInclude.Include.NON_NULL) String bundleId,
                           @JsonInclude(JsonInclude.Include.NON_NULL) List<ReadingDecision> editorialDecisions) {
    public enum WealthMode { LEGACY, EXTENDED }
    public TamTheResult(String ruleVersion, RuleBasis ruleBasis, SourceStatus sourceStatus,
                        List<RuleEvidence> rules, List<SourceReference> sourceReferences,
                        List<DecisionReference> decisionReferences, List<CategoryResult> categories) {
        this(ruleVersion, ruleBasis, sourceStatus, rules, sourceReferences, decisionReferences, categories, null, null, null);
    }
    public TamTheResult {
        if (ruleBasis != RuleBasis.SOURCE_VERIFIED || sourceStatus != SourceStatus.VERIFIED
                || rules == null || rules.isEmpty() || categories == null || categories.isEmpty()
                || rules.stream().anyMatch(rule -> rule.ruleBasis() != RuleBasis.SOURCE_VERIFIED
                    || rule.sourceStatus() != SourceStatus.VERIFIED)) {
            throw new IllegalArgumentException("Interpretations require verified source evidence");
        }
        rules = List.copyOf(rules);
        sourceReferences = List.copyOf(sourceReferences);
        decisionReferences = List.copyOf(decisionReferences);
        categories = List.copyOf(categories);
        if (coverageMode == WealthMode.EXTENDED) {
            ReadingContracts.require(ReadingContracts.text(bundleId) && editorialDecisions != null
                    && categories.stream().anyMatch(c -> c.category() == TamTheCategory.WEALTH), "Extended wealth requires a reviewed bundle");
            editorialDecisions = List.copyOf(editorialDecisions);
            for (var category : categories) {
                if (category.category() != TamTheCategory.WEALTH) continue;
                var subs = category.subreadings();
                ReadingContracts.require(subs != null && subs.size() == 3, "Extended wealth needs three subreadings");
                for (int i = 0; i < 3; i++) ReadingContracts.require(subs.get(i).code() == WealthSubreading.Code.values()[i], "Wrong wealth subreading order");
                ReadingContracts.require(category.entries().equals(subs.stream().flatMap(s -> s.entries().stream()).toList()), "Flattened entries must preserve all subreadings");
                for (var sub : subs) ReadingContracts.require(editorialDecisions.containsAll(sub.decisionReferences()), "Editorial links must be visible in result metadata");
            }
        } else {
            ReadingContracts.require(bundleId == null && editorialDecisions == null
                    && categories.stream().allMatch(c -> c.subreadings() == null
                        && c.entries().stream().allMatch(e -> e.subreadingCode() == null)), "Legacy results cannot hide extended metadata");
        }
    }
    public record CategoryResult(TamTheCategory category, List<InterpretationEntry> entries,
                                 @JsonInclude(JsonInclude.Include.NON_NULL) List<WealthSubreading> subreadings) {
        public CategoryResult(TamTheCategory category, List<InterpretationEntry> entries) { this(category, entries, null); }
        public CategoryResult {
            if (category == null || entries == null || entries.isEmpty()) {
                throw new IllegalArgumentException("Requested category must have verified content");
            }
            entries = List.copyOf(entries);
            if (subreadings != null) {
                ReadingContracts.require(category == TamTheCategory.WEALTH, "Only WEALTH has these subreadings");
                subreadings = List.copyOf(subreadings);
            }
        }
    }

    public record InterpretationEntry(String resultCode, String title, String content,
                                       List<SourceReference> sourceReferences,
                                       @JsonInclude(JsonInclude.Include.NON_NULL) WealthSubreading.Code subreadingCode) {
        public InterpretationEntry(String resultCode, String title, String content, List<SourceReference> sources) {
            this(resultCode, title, content, sources, null);
        }
        public InterpretationEntry {
            if (resultCode == null || resultCode.isBlank() || title == null || title.isBlank()
                    || content == null || content.isBlank() || sourceReferences == null || sourceReferences.isEmpty()
                    || sourceReferences.stream().anyMatch(source -> !source.hasTraceableLocation())) {
                throw new IllegalArgumentException("Interpretation content requires traceable sources");
            }
            sourceReferences = List.copyOf(sourceReferences);
        }
    }
}
