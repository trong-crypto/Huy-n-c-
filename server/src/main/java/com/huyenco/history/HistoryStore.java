package com.huyenco.history;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;

public interface HistoryStore {
    record Owner(UUID id, Instant expiresAt, UUID accountSessionId) {
        public Owner(UUID id, Instant expiresAt) { this(id, expiresAt, null); }
        public boolean account() { return accountSessionId != null; }
    }
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
    default Optional<Detail> byRequest(Owner owner, UUID request) { return byRequest(owner.id(), request); }
    default Page list(Owner owner, String query, String type, int page, int size) { return list(owner.id(), query, type, page, size); }
    default Optional<Detail> detail(Owner owner, UUID id) { return detail(owner.id(), id); }
    default boolean delete(Owner owner, UUID id) { return delete(owner.id(), id); }
}
