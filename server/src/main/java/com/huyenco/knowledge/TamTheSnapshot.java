package com.huyenco.knowledge;

import com.huyenco.common.dto.SourceReference;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record TamTheSnapshot(Map<String, RuleState> rules, List<Entry> entries) {
    public TamTheSnapshot {
        rules = Map.copyOf(rules);
        entries = List.copyOf(entries);
    }
    public record Page(int order, SourceReference source) { }
    public record Entry(String ruleCode, String ruleVersion, String key, String resultCode,
                        String title, String content, SourceStatus status, String reviewer,
                        Instant reviewedAt, String verificationNote, SourceReference tableSource,
                        SourceReference firstContentSource, String tableLabel, String contentHeading,
                        List<Page> contentPages) {
        public Entry { contentPages = List.copyOf(contentPages); }
    }
}
