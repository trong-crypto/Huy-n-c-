package com.huyenco.maihoa;

/** Số quái và hào động theo quy ước triển khai đã chốt; chưa xác nhận toàn tuyến sách. */
public final class MaiHoaNumbers {
    private MaiHoaNumbers() {
    }

    public record ObjectCountNumbers(int upperTrigram, int lowerTrigram, int movingLine) {
    }

    public static ObjectCountNumbers fromObjectCount(int objectCount, int hourIndex) {
        if (objectCount < 1 || objectCount > 999_999 || hourIndex < 1 || hourIndex > 12) {
            throw new IllegalArgumentException("objectCount hoặc hourIndex ngoài phạm vi.");
        }
        return new ObjectCountNumbers(
                nonZeroRemainder(objectCount, 8),
                nonZeroRemainder(hourIndex, 8),
                nonZeroRemainder(objectCount + hourIndex, 6));
    }

    public static int movingLineFromTimeSum(int yearBranchIndex, int lunarMonth,
                                             int lunarDay, int hourIndex) {
        if (yearBranchIndex < 1 || yearBranchIndex > 12 || lunarMonth < 1 || lunarMonth > 12
                || lunarDay < 1 || lunarDay > 30 || hourIndex < 1 || hourIndex > 12) {
            throw new IllegalArgumentException("Thành phần ngày giờ Âm lịch ngoài phạm vi.");
        }
        return nonZeroRemainder(yearBranchIndex + lunarMonth + lunarDay + hourIndex, 6);
    }

    private static int nonZeroRemainder(int value, int divisor) {
        int remainder = value % divisor;
        return remainder == 0 ? divisor : remainder;
    }
}
