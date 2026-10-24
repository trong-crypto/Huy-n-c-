package com.huyenco.common.dto;

@FunctionalInterface
public interface CalculationProgress {
    CalculationProgress NONE = (step, message) -> { };
    void report(ProgressEvent.Step step, String message);
}
