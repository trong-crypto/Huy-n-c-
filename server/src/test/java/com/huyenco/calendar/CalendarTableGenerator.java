package com.huyenco.calendar;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import net.time4j.Moment;
import net.time4j.calendar.SolarTerm;
import net.time4j.calendar.astro.AstronomicalSeason;
import net.time4j.calendar.astro.MoonPhase;

/** Reproducible build-time astronomy, not executed in HTTP requests.
 * Vietnamese calendar rules: new-moon civil day; month 11 contains winter solstice;
 * first month without a major term in a 13-month solstice interval is leap.
 * All civil-day boundaries use fixed UTC+7, including years before 1968. */
public final class CalendarTableGenerator {
    record Month(int year, int number, boolean leap, LocalDate start, int days) { }
    private static final ZoneOffset OFFSET = ZoneOffset.ofHours(7);

    public static String generate() {
        Map<Integer, List<Month>> years = new TreeMap<>();
        for (int year = 1898; year <= 2099; year++) {
            LocalDate a = month11(year), b = month11(year + 1);
            List<LocalDate> starts = new ArrayList<>();
            starts.add(a);
            while (starts.get(starts.size() - 1).isBefore(b)) {
                LocalDate start = starts.get(starts.size() - 1);
                Moment moon = MoonPhase.NEW_MOON.atOrAfter(midnight(start));
                LocalDate next = date(MoonPhase.NEW_MOON.after(Moment.from(moon.toTemporalAccessor().plusSeconds(1))));
                if (!next.isAfter(start) || next.isAfter(b)) throw new IllegalStateException("New-moon interval error");
                starts.add(next);
            }
            int months = starts.size() - 1;
            if (months != 12 && months != 13) throw new IllegalStateException("Solstice interval length");
            int leapIndex = -1;
            if (months == 13) {
                for (int i = 1; i < months; i++) {
                    if (sector(starts.get(i)) == sector(starts.get(i + 1))) { leapIndex = i; break; }
                }
                if (leapIndex < 0) throw new IllegalStateException("Leap interval without leap month");
            }
            int number = 10;
            for (int i = 0; i < months; i++) {
                boolean leap = i == leapIndex;
                if (!leap) number = number % 12 + 1;
                int lunarYear = number >= 11 ? year : year + 1;
                int days = (int)(starts.get(i + 1).toEpochDay() - starts.get(i).toEpochDay());
                if (days != 29 && days != 30) throw new IllegalStateException("Lunar month length");
                years.computeIfAbsent(lunarYear, key -> new ArrayList<>()).add(new Month(lunarYear, number, leap, starts.get(i), days));
            }
        }
        StringBuilder csv = new StringBuilder("year,code_hex\n");
        for (int year = 1899; year <= 2099; year++) {
            List<Month> months = years.get(year);
            if (months.size() != 12 && months.size() != 13) throw new IllegalStateException("Incomplete lunar year");
            int code = (int)(months.get(0).start().toEpochDay() - LocalDate.of(year, 1, 1).toEpochDay()) << 17;
            for (Month month : months) {
                if (month.leap()) code |= month.number() | ((month.days() - 29) << 16);
                else code |= (month.days() - 29) << (16 - month.number());
            }
            csv.append(String.format(Locale.ROOT, "%d,0x%06x\n", year, code));
        }
        return csv.toString();
    }

    private static LocalDate month11(int year) {
        LocalDate solstice = date(AstronomicalSeason.WINTER_SOLSTICE.inYear(year));
        return date(MoonPhase.NEW_MOON.before(midnight(solstice.plusDays(1))));
    }

    private static int sector(LocalDate date) { return SolarTerm.of(midnight(date)).getSolarLongitude() / 30; }
    private static Moment midnight(LocalDate date) { return Moment.from(date.atStartOfDay().toInstant(OFFSET)); }
    private static LocalDate date(Moment moment) { return moment.toTemporalAccessor().atOffset(OFFSET).toLocalDate(); }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass an output CSV path for review");
        Files.writeString(Path.of(args[0]), generate(), java.nio.charset.StandardCharsets.UTF_8);
    }
}
