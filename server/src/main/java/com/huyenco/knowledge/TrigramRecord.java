package com.huyenco.knowledge;

import java.util.List;

public record TrigramRecord(String code, String name, int heavenNumber, String element,
                            List<Boolean> linesBottomUp) {
    public TrigramRecord { linesBottomUp = List.copyOf(linesBottomUp); }
}
