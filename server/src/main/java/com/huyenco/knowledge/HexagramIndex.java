package com.huyenco.knowledge;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/** Validates a single repository snapshot before any calculation can be returned. */
public final class HexagramIndex {
    private final Map<List<Boolean>, HexagramRecord> byLines;

    public HexagramIndex(List<HexagramRecord> records) {
        if (records == null || records.size() != 64) throw new KnowledgeDataException();
        var index = new HashMap<List<Boolean>, HexagramRecord>();
        var trigrams = new HashMap<String, List<Boolean>>();
        var codes = new HashSet<String>();
        for (var record : records) {
            if (record == null || record.code() == null || record.upperTrigramCode() == null
                    || record.lowerTrigramCode() == null || record.upperTrigramCode().isBlank()
                    || record.lowerTrigramCode().isBlank() || record.linesBottomUp().size() != 6
                    || record.linesBottomUp().stream().anyMatch(java.util.Objects::isNull)
                    || !record.code().equals("H_" + record.upperTrigramCode() + "_" + record.lowerTrigramCode())
                    || !codes.add(record.code()) || index.putIfAbsent(record.linesBottomUp(), record) != null) {
                throw new KnowledgeDataException();
            }
            checkTrigram(trigrams, record.lowerTrigramCode(), record.linesBottomUp().subList(0, 3));
            checkTrigram(trigrams, record.upperTrigramCode(), record.linesBottomUp().subList(3, 6));
        }
        if (trigrams.size() != 8 || new HashSet<>(trigrams.values()).size() != 8) {
            throw new KnowledgeDataException();
        }
        byLines = Map.copyOf(index);
    }

    private static void checkTrigram(Map<String, List<Boolean>> trigrams, String code, List<Boolean> lines) {
        var previous = trigrams.putIfAbsent(code, List.copyOf(lines));
        if (previous != null && !previous.equals(lines)) throw new KnowledgeDataException();
    }

    public HexagramRecord find(List<Boolean> lines) {
        var record = byLines.get(lines);
        if (record == null) throw new KnowledgeDataException();
        return record;
    }
}
