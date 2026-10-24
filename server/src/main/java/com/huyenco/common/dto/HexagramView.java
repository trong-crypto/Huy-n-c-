package com.huyenco.common.dto;

import com.huyenco.knowledge.SourceStatus;
import java.util.List;

public record HexagramView(String code, String name, SourceStatus nameStatus, List<Boolean> linesBottomUp) {
    public HexagramView {
        if (linesBottomUp == null || linesBottomUp.size() != 6
                || linesBottomUp.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("A hexagram requires exactly six non-null lines");
        }
        linesBottomUp = List.copyOf(linesBottomUp);
        if (name != null && nameStatus != SourceStatus.VERIFIED) {
            throw new IllegalArgumentException("Calculation results only include reviewed names");
        }
    }
}
