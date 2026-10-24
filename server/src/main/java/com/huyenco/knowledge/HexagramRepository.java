package com.huyenco.knowledge;

import java.util.List;

@FunctionalInterface
public interface HexagramRepository {
    List<HexagramRecord> hexagrams();
}
