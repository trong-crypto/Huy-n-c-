package com.huyenco.common.exception;

public class RuleNotAvailableException extends RuntimeException {
    private final String ruleCode;

    public RuleNotAvailableException(String ruleCode) {
        super("Quy tắc chưa được xác minh theo ấn bản sách.");
        this.ruleCode = ruleCode;
    }

    public String ruleCode() {
        return ruleCode;
    }
}

