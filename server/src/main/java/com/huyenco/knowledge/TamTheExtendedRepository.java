package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;

/** Base rules and supplementary knowledge must share one repeatable-read snapshot. */
public interface TamTheExtendedRepository {
    Snapshot extended(Set<String> baseRules);

    record Snapshot(TamTheSnapshot base, MaiHoaReadingRepository.Bundle bundle,
                    List<Result> results, List<Mapping> mappings) {
        public Snapshot { results=List.copyOf(results); mappings=List.copyOf(mappings); }
    }
    record Result(String code, String bundleId, String ruleCode, int column, String title,
                  String tableLabel, String contentHeading, String content, String textKind,
                  JsonNode sourceRecord, String bookSha, int bookPages, String bookTitle) { }
    record Mapping(String ruleCode, String lookupKey, String bundleId, String resultCode,
                   int tableRow, int tableColumn) { }
}
