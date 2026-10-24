package com.huyenco.knowledge;

/** Never put JDBC diagnostics, database identifiers or credentials in public errors. */
public final class KnowledgeAccessException extends RuntimeException {
    public KnowledgeAccessException() {
        super("Không thể truy cập dữ liệu tri thức.");
    }
}
