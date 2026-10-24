package com.huyenco.common.dto;

import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonIgnore;

public record DecisionReference(String decisionId, String decidedAt, String document, String description) {
    @JsonIgnore
    public boolean isComplete() {
        if (decisionId == null || decisionId.isBlank() || document == null || document.isBlank()
                || description == null || description.isBlank() || decidedAt == null) {
            return false;
        }
        try {
            LocalDate.parse(decidedAt);
            return true;
        } catch (java.time.format.DateTimeParseException ex) {
            return false;
        }
    }
}
