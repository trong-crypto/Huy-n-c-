package com.huyenco.maihoa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class MaiHoaNumbersTest {
    @Test
    void objectCountExampleUsesChosenOriginalCount() {
        assertEquals(new MaiHoaNumbers.ObjectCountNumbers(4, 8, 2),
                MaiHoaNumbers.fromObjectCount(12, 8));
    }

    @Test
    void zeroRemaindersMapToLastTrigramAndLine() {
        assertEquals(new MaiHoaNumbers.ObjectCountNumbers(8, 4, 2),
                MaiHoaNumbers.fromObjectCount(8, 12));
        assertEquals(new MaiHoaNumbers.ObjectCountNumbers(4, 6, 6),
                MaiHoaNumbers.fromObjectCount(12, 6));
        assertEquals(6, MaiHoaNumbers.movingLineFromTimeSum(1, 1, 1, 3));
    }

    @Test
    void rejectsOutOfRangeHourAndCount() {
        assertThrows(IllegalArgumentException.class, () -> MaiHoaNumbers.fromObjectCount(0, 8));
        assertThrows(IllegalArgumentException.class, () -> MaiHoaNumbers.fromObjectCount(12, 13));
    }
}
