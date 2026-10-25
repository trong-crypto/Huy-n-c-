package com.huyenco.calendar;

import static org.junit.jupiter.api.Assertions.*;
import com.huyenco.common.dto.LunarDate;
import com.huyenco.common.exception.ContractException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.LocalTime;
import net.time4j.PlainDate;
import net.time4j.calendar.VietnameseCalendar;
import org.junit.jupiter.api.Test;

class VietnameseLunarCalendarTest {
    private final VietnameseLunarCalendar calendar = new VietnameseLunarCalendar();

    @Test
    void allSupportedDaysRoundTripWithoutGapsAndDatesAreReal() {
        int days = 0;
        for (LocalDate day = VietnameseLunarCalendar.MIN; !day.isAfter(VietnameseLunarCalendar.MAX); day = day.plusDays(1)) {
            LunarDate lunar = calendar.toLunar(day);
            assertEquals(day, calendar.toSolar(lunar), day.toString());
            assertTrue(lunar.day() >= 1 && lunar.day() <= 30);
            days++;
        }
        assertEquals(73049, days);
    }

    @Test
    void modernRangeMatchesTime4jCalendarCrossCheck() {
        int checked = 0;
        var mismatches = new java.util.ArrayList<String>();
        for (LocalDate day = LocalDate.of(1968, 1, 1); !day.isAfter(VietnameseLunarCalendar.MAX); day = day.plusDays(1)) {
            var reference = PlainDate.of(day.getYear(), day.getMonthValue(), day.getDayOfMonth()).transform(VietnameseCalendar.class);
            var actual = calendar.toLunar(day);
            if (actual.month() != reference.getMonth().getNumber() || actual.day() != reference.getDayOfMonth()
                    || actual.isLeapMonth() != reference.getMonth().isLeap()
                    || Math.floorMod(actual.year() - 4, 60) + 1 != reference.getYear().getNumber())
                mismatches.add(day + ": " + actual + " vs " + reference);
            checked++;
        }
        assertTrue(mismatches.isEmpty(), () -> "Calendar cross-check differences (" + mismatches.size() + "): " + mismatches.stream().limit(20).toList());
        assertEquals(48213, checked);
    }

    @Test
    void pinnedTableIsReproducibleFromReviewedAstronomyAndRules() throws Exception {
        String bundled = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/calendar/vn-fixed7-year-codes.csv")).replace("\r\n", "\n");
        assertEquals(bundled, CalendarTableGenerator.generate());
    }

    @Test
    void independentlyPublishedHkoControlsMatchInBothDirections() throws Exception {
        var rows = java.nio.file.Files.readAllLines(java.nio.file.Path.of("..", "data", "c01_control_dates.csv"));
        assertEquals(17, rows.size());
        for (String row : rows.subList(1, rows.size())) {
            String[] fields = row.split(",");
            var lunar = new LunarDate(Integer.parseInt(fields[1]), Integer.parseInt(fields[2]), Integer.parseInt(fields[3]), Boolean.parseBoolean(fields[4]));
            var solar = LocalDate.parse(fields[0]);
            assertTrue(fields[5].startsWith("https://www.hko.gov.hk/"));
            assertEquals(lunar, calendar.toLunar(solar), row);
            assertEquals(solar, calendar.toSolar(lunar), row);
        }
    }

    @Test
    void invalidDatesLeapFlagsAndRangeAreRejected() {
        for (LunarDate date : java.util.List.of(new LunarDate(2023, 1, 1, true), new LunarDate(2024, 2, 1, true),
                new LunarDate(2023, 2, 30, true), new LunarDate(2023, 13, 1, false),
                new LunarDate(1899, 1, 1, false), new LunarDate(2099, 12, 30, false))) {
            assertEquals("INVALID_DATE", assertThrows(ContractException.class, () -> calendar.toSolar(date)).code());
        }
        assertThrows(ContractException.class, () -> calendar.toLunar(LocalDate.of(2100, 1, 1)));
        assertThrows(ContractException.class, () -> calendar.toLunar(LocalDate.of(1899, 12, 31)));
    }

    @Test
    void controlDatesIncludeLeapMonthTetAndVietnamChinaDifference() {
        // HKO 2023 table: 22 Jan regular month 1; 22 Mar repeats month 2; 20 Apr month 3.
        assertEquals(new LunarDate(2023, 1, 1, false), calendar.toLunar(LocalDate.of(2023, 1, 22)));
        assertEquals(new LunarDate(2023, 2, 1, true), calendar.toLunar(LocalDate.of(2023, 3, 22)));
        assertEquals(new LunarDate(2023, 3, 1, false), calendar.toLunar(LocalDate.of(2023, 4, 20)));
        // Vietnam UTC+7, not HKO UTC+8: Tet 1968 is Jan 29, not Jan 30.
        assertEquals(new LunarDate(1968, 1, 1, false), calendar.toLunar(LocalDate.of(1968, 1, 29)));
        assertEquals(new LunarDate(2004, 2, 1, true), calendar.toLunar(LocalDate.of(2004, 3, 21)));
        assertEquals(new LunarDate(1984, 1, 1, false), calendar.toLunar(LocalDate.of(1984, 2, 2)));
        // HKO 2054 + Espenak almanac: new moon May 7 around 17:00 UTC -> May 8 UTC+7.
        assertEquals(new LunarDate(2054, 3, 30, false), calendar.toLunar(LocalDate.of(2054, 5, 7)));
        assertEquals(new LunarDate(2054, 4, 1, false), calendar.toLunar(LocalDate.of(2054, 5, 8)));
    }

    @Test
    void offsetNormalizationUsesFixedSevenHoursAndDayChangesAtMidnight() {
        assertEquals(LocalDate.of(2024, 2, 10), calendar.localDate(OffsetDateTime.parse("2024-02-09T17:00:00Z")));
        assertEquals(calendar.localDate(OffsetDateTime.parse("2024-02-09T17:00:00Z")),
                calendar.localDate(OffsetDateTime.parse("2024-02-10T01:00:00+08:00")));
        assertEquals(0, VietnameseLunarCalendar.hourBranchIndex(LocalTime.of(23, 0)));
        assertEquals(0, VietnameseLunarCalendar.hourBranchIndex(LocalTime.of(0, 59)));
        assertEquals(1, VietnameseLunarCalendar.hourBranchIndex(LocalTime.of(1, 0)));
        assertEquals(11, VietnameseLunarCalendar.hourBranchIndex(LocalTime.of(22, 59)));
    }
}
