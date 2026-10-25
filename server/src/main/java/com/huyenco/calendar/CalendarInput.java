package com.huyenco.calendar;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.ContractException;
import java.util.Set;

public record CalendarInput(String calendarType, int year, int month, int day, boolean isLeapMonth) {
    public static CalendarInput parse(JsonNode node) {
        fields(node, Set.of("calendarType", "year", "month", "day", "isLeapMonth"));
        if (!node.hasNonNull("calendarType") || !node.get("calendarType").isTextual()
                || !Set.of("SOLAR", "LUNAR").contains(node.get("calendarType").textValue())) throw invalid();
        for (String name : Set.of("year", "month", "day")) {
            if (!node.hasNonNull(name) || !node.get(name).isIntegralNumber() || !node.get(name).canConvertToInt()) throw invalid();
        }
        if (!node.hasNonNull("isLeapMonth") || !node.get("isLeapMonth").isBoolean()) throw invalid();
        CalendarInput input = new CalendarInput(node.get("calendarType").textValue(), node.get("year").intValue(),
                node.get("month").intValue(), node.get("day").intValue(), node.get("isLeapMonth").booleanValue());
        input.validate();
        return input;
    }

    public void validate() {
        if (!Set.of("SOLAR", "LUNAR").contains(calendarType == null ? "" : calendarType)
                || ("SOLAR".equals(calendarType) && isLeapMonth)) throw invalid();
        if (year < 1899 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31)
            throw VietnameseLunarCalendar.invalidDate();
    }

    static void fields(JsonNode node, Set<String> allowed) {
        if (node == null || !node.isObject()) throw invalid();
        node.fieldNames().forEachRemaining(name -> { if (!allowed.contains(name)) throw invalid(); });
    }

    static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Đầu vào lịch sai cấu trúc, kiểu dữ liệu hoặc có trường không được hỗ trợ.");
    }
}
