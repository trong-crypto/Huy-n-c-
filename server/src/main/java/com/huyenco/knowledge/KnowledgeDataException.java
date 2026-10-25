package com.huyenco.knowledge;

/** Incomplete/inconsistent knowledge is different from losing the database connection. */
public final class KnowledgeDataException extends RuntimeException {
    public KnowledgeDataException() {
        super("Dữ liệu tri thức chưa đầy đủ hoặc không nhất quán.");
    }
}
