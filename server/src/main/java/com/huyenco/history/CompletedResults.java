package com.huyenco.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.MaiHoaResult;
import com.huyenco.common.dto.TamTheResult;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Bounded, owner-scoped, short-lived successful result cache. Never retains request payloads. */
@Component
public class CompletedResults {
    public record Result(String type, String basis, String json) { }
    private record Key(UUID owner, UUID request) { }
    private record Entry(Result result, Instant expires, int bytes, boolean conflict) { }
    private final LinkedHashMap<Key, Entry> entries = new LinkedHashMap<>();
    private final Clock clock;
    private final ObjectMapper mapper;
    private final int maxEntries, maxBytes;
    private final Duration ttl;
    private int bytes;

    public CompletedResults(ObjectMapper mapper, Clock clock,
            @Value("${huyenco.history-result-ttl-seconds:900}") long ttlSeconds,
            @Value("${huyenco.history-result-max-entries:10000}") int maxEntries,
            @Value("${huyenco.history-result-max-bytes:33554432}") int maxBytes) {
        if (ttlSeconds < 1 || maxEntries < 1 || maxBytes < 1) throw new IllegalArgumentException("Invalid result cache limits");
        this.mapper=mapper; this.clock=clock; this.ttl=Duration.ofSeconds(ttlSeconds);
        this.maxEntries=maxEntries; this.maxBytes=maxBytes;
    }

    public synchronized void capture(HistoryStore.Owner owner, String requestId, String type, Object value) {
        prune();
        if (owner == null || !owner.expiresAt().isAfter(clock.instant()) || requestId == null) return;
        if (!(value instanceof MaiHoaResult && "MAI_HOA".equals(type)) &&
                !(value instanceof TamTheResult && "TAM_THE".equals(type))) return;
        var tree=mapper.valueToTree(value);
        String json=tree.toString();
        int length=json.getBytes(StandardCharsets.UTF_8).length;
        if (length > 131072 || length > maxBytes) return;
        UUID id;
        try { id=UUID.fromString(requestId); } catch (IllegalArgumentException failure) { return; }
        var key=new Key(owner.id(),id);
        var result=new Result(type,tree.path("ruleBasis").asText(),json);
        var old=entries.get(key);
        if (old != null) {
            if (!old.result().equals(result)) entries.put(key,new Entry(old.result(),old.expires(),old.bytes(),true));
            return;
        }
        while (entries.size() >= maxEntries || bytes+length > maxBytes) remove(entries.keySet().iterator().next());
        Instant expiry=clock.instant().plus(ttl);
        if (owner.expiresAt().isBefore(expiry)) expiry=owner.expiresAt();
        entries.put(key,new Entry(result,expiry,length,false)); bytes+=length;
    }

    public synchronized Optional<Result> find(UUID owner, UUID request) {
        prune(); var entry=entries.get(new Key(owner,request));
        if (entry != null && entry.conflict()) throw SessionService.invalid("requestId đã có nhiều kết quả khác nhau; hãy tính lại với ID mới.");
        return entry == null ? Optional.empty() : Optional.of(entry.result());
    }
    public synchronized int size() { prune(); return entries.size(); }
    private void remove(Key key) { bytes-=entries.remove(key).bytes(); }
    private void prune() {
        var iterator=entries.entrySet().iterator();
        while(iterator.hasNext()) {
            var entry=iterator.next().getValue();
            if (!entry.expires().isAfter(clock.instant())) { bytes-=entry.bytes(); iterator.remove(); }
        }
    }
}
