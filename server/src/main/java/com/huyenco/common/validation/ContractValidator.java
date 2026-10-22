package com.huyenco.common.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.ContractException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;

public final class ContractValidator {
    private ContractValidator() {
    }

    public static void validate(JsonNode request, String expectedType) {
        if (request == null || !request.isObject() || request.toString().length() > 16_000) {
            throw invalidInput("JSON không hợp lệ hoặc quá dài.");
        }
        String requestId = text(request, "requestId");
        try {
            UUID.fromString(requestId);
        } catch (IllegalArgumentException ex) {
            throw invalidInput("requestId phải là UUID.");
        }
        if (!expectedType.equals(text(request, "type"))) {
            throw invalidInput("type không khớp đường dẫn yêu cầu.");
        }
        JsonNode payload = request.get("payload");
        if (payload == null || !payload.isObject()) {
            throw invalidInput("Thiếu payload.");
        }
        if ("MAI_HOA".equals(expectedType)) {
            validateMaiHoa(payload);
        } else {
            validateTamThe(payload);
        }
    }

    private static void validateMaiHoa(JsonNode payload) {
        String method = text(payload, "method");
        if ("TIME".equals(method)) {
            try {
                OffsetDateTime.parse(text(payload, "datetime"));
            } catch (DateTimeParseException ex) {
                throw new ContractException("INVALID_DATE", "datetime phải là ISO 8601 có offset.");
            }
        } else if ("OBJECT_COUNT".equals(method)) {
            JsonNode objectCount = payload.get("objectCount");
            JsonNode hourIndex = payload.get("hourIndex");
            if (objectCount == null || !objectCount.isIntegralNumber()
                    || objectCount.asLong() < 1 || objectCount.asLong() > 999_999) {
                throw invalidInput("objectCount phải là số nguyên từ 1 đến 999999.");
            }
            if (hourIndex == null || !hourIndex.isIntegralNumber()
                    || hourIndex.asInt() < 1 || hourIndex.asInt() > 12) {
                throw invalidInput("hourIndex phải là số nguyên từ 1 đến 12.");
            }
        } else if ("LINES".equals(method)) {
            JsonNode lines = payload.get("linesBottomUp");
            JsonNode movingLine = payload.get("movingLine");
            if (lines == null || !lines.isArray() || lines.size() != 6) {
                throw invalidInput("linesBottomUp phải có đúng sáu hào.");
            }
            for (JsonNode line : lines) {
                if (!line.isBoolean()) {
                    throw invalidInput("Mỗi hào phải là boolean.");
                }
            }
            if (movingLine == null || !movingLine.isIntegralNumber()
                    || movingLine.asInt() < 1 || movingLine.asInt() > 6) {
                throw invalidInput("movingLine phải là số nguyên từ 1 đến 6.");
            }
        } else {
            throw new ContractException("INVALID_METHOD", "method chỉ nhận TIME, OBJECT_COUNT hoặc LINES.");
        }
        JsonNode question = payload.get("question");
        if (question != null && (!question.isTextual() || question.asText().length() > 500)) {
            throw invalidInput("question phải là chuỗi tối đa 500 ký tự.");
        }
    }

    private static void validateTamThe(JsonNode payload) {
        String date = text(payload, "birthDate");
        String time = text(payload, "birthTime");
        String calendarType = text(payload, "calendarType");
        JsonNode leapMonth = payload.get("isLeapMonth");
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}") || !time.matches("\\d{2}:\\d{2}")) {
            throw new ContractException("INVALID_DATE", "Ngày hoặc giờ sinh sai định dạng.");
        }
        try {
            LocalTime.parse(time);
            if ("SOLAR".equals(calendarType)) {
                LocalDate.parse(date);
            } else if ("LUNAR".equals(calendarType)) {
                int month = Integer.parseInt(date.substring(5, 7));
                int day = Integer.parseInt(date.substring(8, 10));
                if (month < 1 || month > 12 || day < 1 || day > 30) {
                    throw new ContractException("INVALID_DATE", "Ngày Âm lịch nằm ngoài phạm vi cơ bản.");
                }
            } else {
                throw invalidInput("calendarType chỉ nhận SOLAR hoặc LUNAR.");
            }
        } catch (DateTimeParseException ex) {
            throw new ContractException("INVALID_DATE", "Ngày hoặc giờ sinh không hợp lệ.");
        }
        if (leapMonth == null || !leapMonth.isBoolean()
                || ("SOLAR".equals(calendarType) && leapMonth.asBoolean())) {
            throw invalidInput("isLeapMonth phải là boolean và là false với SOLAR.");
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw invalidInput("Thiếu hoặc sai trường " + field + ".");
        }
        return value.asText();
    }

    private static ContractException invalidInput(String message) {
        return new ContractException("INVALID_INPUT", message);
    }
}

