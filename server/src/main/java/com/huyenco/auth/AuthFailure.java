package com.huyenco.auth;

final class AuthFailure extends RuntimeException {
    final int status;
    final String code;
    final long retryAfter;

    AuthFailure(int status, String code, String message) {
        this(status, code, message, 0);
    }

    private AuthFailure(int status, String code, String message, long retryAfter) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
    }

    static AuthFailure invalid() {
        return new AuthFailure(400, "INVALID_INPUT", "Dữ liệu xác thực không hợp lệ.");
    }

    static AuthFailure session() {
        return new AuthFailure(401, "INVALID_SESSION", "Phiên không hợp lệ hoặc đã hết hạn.");
    }

    static AuthFailure csrf() {
        return new AuthFailure(403, "CSRF_REJECTED", "Yêu cầu không vượt qua kiểm tra Origin hoặc CSRF.");
    }

    static AuthFailure limited(long retryAfter) {
        return new AuthFailure(429, "TOO_MANY_REQUESTS", "Vui lòng thử lại sau.", retryAfter);
    }
}
