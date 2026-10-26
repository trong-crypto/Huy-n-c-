package com.huyenco.common.dto;

import java.util.List;

/** Shape/evidence requirements only. Source authorization remains the knowledge service's job. */
final class ReadingContracts {
    private ReadingContracts() { }
    static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
    static boolean text(String value) { return value != null && !value.isBlank(); }
    static List<SourceReference> sources(List<SourceReference> references) {
        require(references != null && !references.isEmpty()
                && references.stream().allMatch(s -> s != null && s.hasTraceableLocation()), "Traceable reading sources required");
        return List.copyOf(references);
    }
}
