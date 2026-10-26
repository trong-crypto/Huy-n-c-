package com.huyenco.knowledge;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/** A complete eight-trigram snapshot, with numbering and line orientation checked. */
public final class TrigramIndex {
    private final Map<Integer, TrigramRecord> byNumber;
    private final Map<String, TrigramRecord> byCode;

    public TrigramIndex(List<TrigramRecord> records) {
        if (records == null || records.size() != 8) throw new KnowledgeDataException();
        var numbers = new HashMap<Integer, TrigramRecord>();
        var codes = new HashMap<String, TrigramRecord>();
        var patterns = new HashSet<List<Boolean>>();
        for (var r : records) {
            if (r == null || r.code() == null || r.code().isBlank() || r.name() == null || r.name().isBlank()
                    || r.heavenNumber() < 1 || r.heavenNumber() > 8 || r.element() == null
                    || !List.of("KIM", "MOC", "THUY", "HOA", "THO").contains(r.element())
                    || r.linesBottomUp().size() != 3
                    || numbers.putIfAbsent(r.heavenNumber(), r) != null
                    || codes.putIfAbsent(r.code(), r) != null || !patterns.add(r.linesBottomUp())) {
                throw new KnowledgeDataException();
            }
        }
        byNumber = Map.copyOf(numbers);
        byCode = Map.copyOf(codes);
    }

    public TrigramRecord find(int number) {
        var record = byNumber.get(number);
        if (record == null) throw new KnowledgeDataException();
        return record;
    }

    public TrigramRecord find(List<Boolean> linesBottomUp) {
        return byNumber.values().stream().filter(r->r.linesBottomUp().equals(linesBottomUp)).findFirst()
                .orElseThrow(KnowledgeDataException::new);
    }

    public void validateHexagrams(List<HexagramRecord> records) {
        for (var r : records) {
            var lower = byCode.get(r.lowerTrigramCode());
            var upper = byCode.get(r.upperTrigramCode());
            if (lower == null || upper == null
                    || !r.linesBottomUp().subList(0, 3).equals(lower.linesBottomUp())
                    || !r.linesBottomUp().subList(3, 6).equals(upper.linesBottomUp())) {
                throw new KnowledgeDataException();
            }
        }
    }
}
