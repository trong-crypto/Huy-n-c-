package com.huyenco.common.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.ContractException;

public final class CmsInput {
    private CmsInput() {}

    public static String text(JsonNode json, String field, int limit, boolean multiline, boolean optional) {
        if (optional && !json.has(field)) return null;
        JsonNode node = json.path(field);
        if (!node.isTextual()) throw invalid(field);
        String raw = node.textValue();
        if (raw.codePoints().anyMatch(point ->
                point >= Character.MIN_SURROGATE && point <= Character.MAX_SURROGATE
                || Character.isISOControl(point) && !(multiline && (point == '\n' || point == '\r' || point == '\t')))) {
            throw invalid(field);
        }
        String value = raw.strip();
        if (optional && value.isEmpty()) return null;
        if (value.isEmpty() || value.codePointCount(0, value.length()) > limit) throw invalid(field);
        return value;
    }

    public static int expectedVersion(JsonNode json) {
        JsonNode version = json.path("expectedVersion");
        if (!version.isIntegralNumber() || !version.canConvertToInt() || version.intValue() < 1) {
            throw invalid("expectedVersion");
        }
        return version.intValue();
    }

    public static FieldFailure invalid(String field) {
        return new FieldFailure("INVALID_INPUT", "Dữ liệu yêu cầu không hợp lệ.", field);
    }

    public static final class FieldFailure extends ContractException {
        private final String field;

        public FieldFailure(String code, String message, String field) {
            super(code, message);
            this.field = field;
        }

        public String field() {
            return field;
        }
    }
}
