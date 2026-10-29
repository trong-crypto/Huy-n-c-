package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class MaiHoaLinesTest {
    static Stream<Arguments> patternsAndMovingLines() {
        return IntStream.range(0, 64).boxed().flatMap(pattern -> IntStream.rangeClosed(1, 6)
                .mapToObj(movingLine -> Arguments.of(pattern, movingLine)));
    }

    static List<Boolean> lines(int bits) {
        return IntStream.range(0, 6).mapToObj(i -> (bits & (1 << i)) != 0).toList();
    }

    static int bits(List<Boolean> lines) {
        return IntStream.range(0, lines.size()).map(i -> lines.get(i) ? 1 << i : 0).sum();
    }

    @ParameterizedTest(name = "pattern={0}, movingLine={1}")
    @MethodSource("patternsAndMovingLines")
    void all64PatternsAnd6MovingLinesMatchBitwiseOracle(int pattern, int movingLine) {
        var input = new ArrayList<>(lines(pattern));
        var result = MaiHoaLines.calculate(input, movingLine);
        // Independent integer/bit-window representation of positions 2-4 and 3-5.
        int expectedMutual = ((pattern >> 1) & 7) | (((pattern >> 2) & 7) << 3);
        int expectedChanged = pattern ^ (1 << (movingLine - 1));
        assertEquals(pattern, bits(result.primary()));
        assertEquals(expectedMutual, bits(result.mutual()));
        assertEquals(expectedChanged, bits(result.changed()));
        assertEquals(1, Integer.bitCount(pattern ^ bits(result.changed())));
        assertEquals(pattern, bits(input), "Caller input must stay unchanged");
        assertEquals(movingLine, result.movingLine());
    }

    @Test
    void explicitAsymmetricExampleKeepsBottomToTopOrder() {
        var result = MaiHoaLines.calculate(List.of(true, false, true, false, true, false), 2);
        assertEquals(List.of(false, true, false, true, false, true), result.mutual());
        assertEquals(List.of(true, true, true, false, true, false), result.changed());
    }

    @Test
    void outputDoesNotAliasCallerAndCannotBeMutated() {
        var input = new ArrayList<>(lines(0));
        var result = MaiHoaLines.calculate(input, 1);
        input.set(0, true);
        assertFalse(result.primary().get(0));
        assertThrows(UnsupportedOperationException.class, () -> result.changed().set(1, true));
    }

    @Test
    void rejectsInvalidShapeAndMovingLine() {
        assertThrows(IllegalArgumentException.class, () -> MaiHoaLines.calculate(null, 1));
        assertThrows(IllegalArgumentException.class, () -> MaiHoaLines.calculate(List.of(true), 1));
        assertThrows(IllegalArgumentException.class, () -> MaiHoaLines.calculate(Arrays.asList(true, false, null, false, true, false), 1));
        assertThrows(IllegalArgumentException.class, () -> MaiHoaLines.calculate(lines(0), 0));
        assertThrows(IllegalArgumentException.class, () -> MaiHoaLines.calculate(lines(0), 7));
    }
}
