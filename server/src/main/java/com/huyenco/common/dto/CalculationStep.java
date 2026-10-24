package com.huyenco.common.dto;

import java.util.Map;

public record CalculationStep(String code, String message, Map<String, Object> values) {
    public CalculationStep {
        values = values == null ? Map.of() : Map.copyOf(values);
    }
}
