package com.huyenco.common.dto;

public record ProgressEvent(String requestId, String type, int sequence, Step step, String message) {
    public ProgressEvent {
        if (requestId == null || type == null || step == null || message == null || sequence < 1) {
            throw new IllegalArgumentException("Incomplete progress event");
        }
    }

    public enum Step {
        ACCEPTED, VALIDATING, CALCULATING, LOOKUP
    }
}
