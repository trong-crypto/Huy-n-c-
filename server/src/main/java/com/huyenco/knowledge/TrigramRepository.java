package com.huyenco.knowledge;

import java.util.List;

@FunctionalInterface
public interface TrigramRepository {
    List<TrigramRecord> trigrams();
}
