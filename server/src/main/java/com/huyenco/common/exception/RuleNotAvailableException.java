package com.huyenco.common.exception;

public class RuleNotAvailableException extends RuntimeException {
    private final String ruleCode;
    private final RuleUnavailableReason reason;

    public RuleNotAvailableException(String ruleCode) {
        this(ruleCode, RuleUnavailableReason.IMPLEMENTATION_UNAVAILABLE);
    }

    public RuleNotAvailableException(String ruleCode, RuleUnavailableReason reason) {
        super("Quy tắc hoặc dữ liệu chưa sẵn sàng để xử lý yêu cầu.");
        this.ruleCode = ruleCode;
        this.reason = reason;
    }

    public String ruleCode() {
        return ruleCode;
    }

    public RuleUnavailableReason reason() {
        return reason;
    }
}

