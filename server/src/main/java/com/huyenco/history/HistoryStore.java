package com.huyenco.history;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;

public interface HistoryStore {
    record Owner(UUID id, Instant expiresAt) { }
    record Item(UUID id, String type, String title, Instant createdAt, String ruleBasis) { }
    record Detail(UUID id, String type, String title, Instant createdAt, String ruleBasis, JsonNode result) { }
    record Page(List<Item> items, int page, int size, long totalElements, long totalPages) { }
    Owner create(String tokenHash, Instant created, Instant expires);
    Optional<Owner> owner(String tokenHash, Instant now);
    Optional<Detail> byRequest(UUID owner, UUID request);
    Detail save(Owner owner, UUID request, CompletedResults.Result result, String title, Instant now, int limit);
    Page list(UUID owner, String query, String type, int page, int size);
    Optional<Detail> detail(UUID owner, UUID id);
    boolean delete(UUID owner, UUID id);
}
