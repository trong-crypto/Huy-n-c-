package com.huyenco.knowledge;

import com.huyenco.common.dto.SourceReference;
import java.time.Instant;
import java.util.List;

/** One consistent read of the fixed 64-hexagram reference dataset. */
public record HexagramLookupSnapshot(List<HexagramRecord> hexagrams, List<Gloss> glosses) {
    public HexagramLookupSnapshot {
        hexagrams = List.copyOf(hexagrams);
        glosses = List.copyOf(glosses);
    }

    public record Gloss(String code, String content, SourceStatus status, String reviewer,
                        Instant reviewedAt, String note, int sourceOrder, String printedSourceLabel,
                        SourceReference source) { }
}
