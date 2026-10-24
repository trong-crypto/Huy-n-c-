package com.huyenco.maihoa;

import java.util.ArrayList;
import java.util.List;

/** Six lines, bottom first. Pure structural transformations, without calendar or interpretations. */
public final class MaiHoaLines {
    private MaiHoaLines() { }

    public static Calculation calculate(List<Boolean> linesBottomUp, int movingLine) {
        if (linesBottomUp == null || linesBottomUp.size() != 6
                || linesBottomUp.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("Exactly six non-null lines are required");
        }
        if (movingLine < 1 || movingLine > 6) {
            throw new IllegalArgumentException("movingLine must be in 1..6");
        }
        List<Boolean> primary = List.copyOf(linesBottomUp);
        List<Boolean> mutual = List.of(primary.get(1), primary.get(2), primary.get(3),
                primary.get(2), primary.get(3), primary.get(4));
        var changed = new ArrayList<>(primary);
        changed.set(movingLine - 1, !primary.get(movingLine - 1));
        return new Calculation(primary, mutual, changed, movingLine);
    }

    public record Calculation(List<Boolean> primary, List<Boolean> mutual, List<Boolean> changed, int movingLine) {
        public Calculation {
            primary = List.copyOf(primary);
            mutual = List.copyOf(mutual);
            changed = List.copyOf(changed);
        }
    }
}
