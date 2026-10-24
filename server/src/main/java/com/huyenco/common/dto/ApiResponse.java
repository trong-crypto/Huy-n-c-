package com.huyenco.common.dto;

public record ApiResponse(String requestId, String type, String status, Object data, ApiError error) {
    public static ApiResponse completed(String requestId, String type, Object data) {
        return new ApiResponse(requestId, type, "COMPLETED", data, null);
    }

    public static ApiResponse failed(String requestId, String type, String code, String message) {
        return failed(requestId, type, code, message, null);
    }

    public static ApiResponse failed(String requestId, String type, String code, String message, String ruleCode) {
        return failed(requestId, type, code, message, ruleCode, null);
    }

    public static ApiResponse failed(String requestId, String type, String code, String message,
                                     String ruleCode, String reason) {
        return new ApiResponse(requestId, type, "FAILED", null, new ApiError(code, message, ruleCode, reason));
    }
}

