package com.huyenco.knowledge;

import com.huyenco.common.dto.HexagramView;
import com.huyenco.common.dto.SourceReference;
import java.util.List;

/** Internal source record. Calculation output must use toCalculationView(). */
public record HexagramRecord(String code, String name, String upperTrigramCode, String lowerTrigramCode,
                             List<Boolean> linesBottomUp, String nameKind, SourceStatus nameStatus,
                             String reviewer, SourceReference source, Long sourceSectionId) {
    public HexagramRecord { linesBottomUp = List.copyOf(linesBottomUp); }

    public HexagramRecord(String code, String name, String upperTrigramCode, String lowerTrigramCode,
                          List<Boolean> linesBottomUp, String nameKind, SourceStatus nameStatus,
                          String reviewer, SourceReference source) {
        this(code, name, upperTrigramCode, lowerTrigramCode, linesBottomUp, nameKind, nameStatus, reviewer, source, null);
    }

    public HexagramView toCalculationView() {
        boolean approved = nameStatus == SourceStatus.VERIFIED && "CANONICAL_TITLE".equals(nameKind)
                && reviewer != null && !reviewer.isBlank() && source != null && source.hasTraceableLocation();
        return new HexagramView(code, approved ? name : null, nameStatus, linesBottomUp);
    }
}
