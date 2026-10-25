package com.huyenco.calendar;

import com.huyenco.common.dto.LunarDate;
import com.huyenco.common.exception.ContractException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Fixed UTC+7 calendar generated using Time4J 5.9.4 astronomy. Packed format/decoder
 * adapted from Ho Ngoc Duc 0.8;
 * original non-commercial copyright grant is in THIRD_PARTY_NOTICES.md. */
@Component
public final class VietnameseLunarCalendar {
    public static final LocalDate MIN = LocalDate.of(1900, 1, 1);
    public static final LocalDate MAX = LocalDate.of(2099, 12, 31);
    public static final ZoneOffset OFFSET = ZoneOffset.ofHours(7);
    public static final String ZONE_LABEL = "Asia/Ho_Chi_Minh";
    public static final String SOURCE_ID = "C01-VN-FIXED7";
    public static final String SOURCE_URL = "https://javadoc.io/static/net.time4j/time4j-base/5.9.4/net/time4j/calendar/astro/MoonPhase.html";
    public static final String SOURCE_VERSION = "C01-1.0 / Time4J 5.9.4";
    // Hash of LF-normalized resource, populated from the pinned upstream snapshot.
    public static final String DATA_SHA = "48d0e58f613fe6151961ceb776b5bffd704c6edadb390e050b93bce33bb653f6";
    private final Map<Integer, List<Month>> years;

    public VietnameseLunarCalendar() {
        try (var in = new ClassPathResource("calendar/vn-fixed7-year-codes.csv").getInputStream()) {
            String data = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8)));
            if (!DATA_SHA.equals(hash)) throw new IllegalStateException("Calendar source hash differs from C01 review");
            Map<Integer, List<Month>> decoded = new LinkedHashMap<>();
            for (String row : data.lines().skip(1).toList()) {
                String[] fields = row.split(",");
                int year = Integer.parseInt(fields[0]);
                if (year != 1899 + decoded.size()) throw new IllegalStateException("Calendar year gap");
                decoded.put(year, decode(year, Integer.decode(fields[1])));
            }
            if (decoded.size() != 201) throw new IllegalStateException("Calendar coverage missing");
            for (int year = 1899; year < 2099; year++) {
                List<Month> months = decoded.get(year);
                Month last = months.get(months.size() - 1);
                if (!last.start().plusDays(last.length()).equals(decoded.get(year + 1).get(0).start()))
                    throw new IllegalStateException("Calendar year discontinuity");
            }
            years = Map.copyOf(decoded);
        } catch (IOException | java.security.NoSuchAlgorithmException failure) {
            throw new IllegalStateException("Calendar source cannot be loaded", failure);
        }
    }

    private static List<Month> decode(int year, int code) {
        int leap = code & 15;
        if (leap > 12) throw new IllegalStateException("Invalid leap month in source");
        LocalDate start = LocalDate.of(year, 1, 1).plusDays(code >> 17);
        List<Month> result = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            int length = 29 + ((code >> (16 - month)) & 1);
            result.add(new Month(month, false, start, length));
            start = start.plusDays(length);
            if (month == leap) {
                int leapLength = 29 + ((code >> 16) & 1);
                result.add(new Month(month, true, start, leapLength));
                start = start.plusDays(leapLength);
            }
        }
        return List.copyOf(result);
    }

    public LunarDate toLunar(LocalDate solar) {
        requireRange(solar);
        int year = solar.getYear();
        if (solar.isBefore(years.get(year).get(0).start())) year--;
        for (Month month : years.get(year)) {
            if (!solar.isBefore(month.start()) && solar.isBefore(month.start().plusDays(month.length())))
                return new LunarDate(year, month.number(), (int)(solar.toEpochDay() - month.start().toEpochDay()) + 1, month.leap());
        }
        throw new IllegalStateException("Calendar source interval missing");
    }

    public LocalDate toSolar(LunarDate lunar) {
        if (lunar == null || lunar.year() < 1899 || lunar.year() > 2099
                || lunar.month() < 1 || lunar.month() > 12 || lunar.day() < 1 || lunar.day() > 30)
            throw invalidDate();
        Month month = years.get(lunar.year()).stream()
                .filter(m -> m.number() == lunar.month() && m.leap() == lunar.isLeapMonth()).findFirst().orElseThrow(VietnameseLunarCalendar::invalidDate);
        if (lunar.day() > month.length()) throw invalidDate();
        LocalDate solar = month.start().plusDays(lunar.day() - 1);
        requireRange(solar);
        return solar;
    }

    public LocalDate localDate(OffsetDateTime instant) {
        if (instant == null) throw invalidDate();
        LocalDate date = instant.withOffsetSameInstant(OFFSET).toLocalDate();
        requireRange(date);
        return date;
    }

    public static int hourBranchIndex(java.time.LocalTime time) {
        return ((time.getHour() + 1) / 2) % 12; // TY=0; 23:00 and 00:00 share TY, date changes at 00:00.
    }

    public static void requireRange(LocalDate solar) {
        if (solar == null || solar.isBefore(MIN) || solar.isAfter(MAX)) throw invalidDate();
    }

    static ContractException invalidDate() {
        return new ContractException("INVALID_DATE", "NgÃƒÂ y khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i hoÃ¡ÂºÂ·c ngoÃƒÂ i phÃ¡ÂºÂ¡m vi DÃ†Â°Ã†Â¡ng lÃ¡Â»â€¹ch 1900-01-01 Ã„â€˜Ã¡ÂºÂ¿n 2099-12-31.");
    }

    private record Month(int number, boolean leap, LocalDate start, int length) { }
}
