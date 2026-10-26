package com.huyenco.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.common.dto.ApiResponse;
import jakarta.annotation.PreDestroy;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.FutureTask;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** N01: bounded execution and an admission registry scoped to each live STOMP session. */
@Component
public final class CalculationDispatcher implements AutoCloseable {
    private final CalculationSessions sessions;
    private final ThreadPoolExecutor workers;
    private final long ttlNanos;
    private final int maxEntries;
    private final Object lock = new Object();
    private final Map<Key, Entry> entries = new LinkedHashMap<>();
    private boolean closing;

    @Autowired
    public CalculationDispatcher(CalculationSessions sessions,
            @Value("${huyenco.calculation-mode:bounded}") String mode,
            @Value("${huyenco.calculation-workers:4}") int threads,
            @Value("${huyenco.calculation-queue-capacity:100}") int capacity,
            @Value("${huyenco.idempotency-ttl-seconds:60}") int ttlSeconds,
            @Value("${huyenco.idempotency-max-entries:10000}") int maxEntries) {
        if (!mode.equals("direct") && !mode.equals("bounded"))
            throw new IllegalArgumentException("calculation-mode must be direct or bounded");
        if (threads < 1 || capacity < 1 || ttlSeconds < 1 || ttlSeconds > 86400 || maxEntries < 1)
            throw new IllegalArgumentException("N01 limits must be positive and TTL <= 86400 seconds");
        this.sessions = Objects.requireNonNull(sessions);
        this.ttlNanos = TimeUnit.SECONDS.toNanos(ttlSeconds);
        this.maxEntries = maxEntries;
        if (mode.equals("bounded")) {
            AtomicInteger count = new AtomicInteger();
            workers = new ThreadPoolExecutor(threads, threads, 0, TimeUnit.MILLISECONDS,
                    new ArrayBlockingQueue<>(capacity), task -> {
                        Thread thread = new Thread(task, "calculation-worker-" + count.incrementAndGet());
                        thread.setDaemon(true);
                        return thread;
                    }, new ThreadPoolExecutor.AbortPolicy());
        } else {
            workers = null;
        }
        sessions.onDisconnect(this::disconnect);
    }

    /** Existing controller unit tests use the synchronous baseline. Production uses injected configuration. */
    CalculationDispatcher(CalculationSessions sessions) {
        this(sessions, "direct", 4, 100, 60, 10000);
    }

    public void dispatch(String sessionId, String requestId, String type, JsonNode request,
            Consumer<CalculationSessions.Run> computation) {
        Key key = requestId == null ? null : new Key(sessionId, requestId.toLowerCase(java.util.Locale.ROOT));
        JsonNode canonical = request.deepCopy();
        if (canonical instanceof ObjectNode object) object.remove("requestId");
        Fingerprint fingerprint = new Fingerprint(type, canonical);
        Entry entry;
        ApiResponse replay = null;
        boolean conflict = false;
        boolean busy = false;
        synchronized (lock) {
            purgeExpired();
            Entry existing = key == null ? null : entries.get(key);
            if (existing != null) {
                conflict = !existing.fingerprint.equals(fingerprint);
                replay = existing.terminal;
                entry = null;
            } else if (closing || (key != null && entries.size() >= maxEntries)) {
                busy = true;
                entry = null;
            } else {
                CalculationSessions.Run run;
                try { run = sessions.start(sessionId, requestId, type); }
                catch (CalculationSessions.Busy rejected) { run = null; busy = true; }
                if (run == null) {
                    entry = null;
                    // A disconnected session must never receive another response.
                    if (!busy) return;
                } else {
                    entry = new Entry(key, fingerprint, run);
                    if (key != null) entries.put(key, entry);
                }
            }
        }
        if (conflict) {
            sessions.send(sessionId, "/queue/errors", ApiResponse.failed(requestId, type,
                    "INVALID_INPUT", "requestId đã được sử dụng với nội dung khác."));
            return;
        }
        if (replay != null) {
            sessions.send(sessionId, replay.error() == null ? "/queue/results" : "/queue/errors", replay);
            return;
        }
        if (entry == null) {
            if (busy) sessions.send(sessionId, "/queue/errors", ApiResponse.failed(requestId, type,
                    "SERVER_BUSY", "Server đang bận, vui lòng thử lại."));
            return; // Existing request is still running: share its original terminal event.
        }

        Entry admitted = entry;
        admitted.run.onTerminal(response -> terminated(admitted, response));
        FutureTask<Void> task = new FutureTask<>(() -> {
            try { computation.accept(admitted.run); }
            finally { admitted.run.cancel(); }
            return null;
        }) {
            @Override public void run() {
                try { super.run(); }
                finally { finished(admitted); }
            }
        };
        boolean executeDirect = false;
        boolean rejected = false;
        synchronized (lock) {
            admitted.task = task;
            if (admitted.cancelled || closing || (key != null && entries.get(key) != admitted)) {
                task.cancel(true);
                admitted.workerFinished = true; // Never enqueued.
            } else if (workers == null) {
                executeDirect = true;
            } else {
                try { workers.execute(task); }
                catch (RejectedExecutionException overload) { rejected = true; }
            }
        }
        if (rejected) {
            admitted.run.fail("SERVER_BUSY", "Server đang bận, vui lòng thử lại.");
            finished(admitted);
        } else if (executeDirect) {
            task.run();
        }
    }

    private void terminated(Entry entry, ApiResponse response) {
        synchronized (lock) {
            if (response == null || (response.error() != null
                    && "SERVER_BUSY".equals(response.error().code()))) {
                entry.cancelled = true;
                if (entry.key != null) entries.remove(entry.key, entry);
            } else {
                entry.terminal = response;
                entry.terminalAt = System.nanoTime();
                if (response.error() != null && "PROCESSING_TIMEOUT".equals(response.error().code()))
                    entry.cancelled = true;
            }
            if (entry.cancelled && entry.task != null) {
                entry.task.cancel(true);
                if (workers != null && workers.remove(entry.task))
                    entry.workerFinished = true; // Cancelled while still in the queue.
            }
        }
    }

    private void finished(Entry entry) {
        synchronized (lock) { entry.workerFinished = true; }
    }

    private void purgeExpired() {
        long now = System.nanoTime();
        Iterator<Entry> iterator = entries.values().iterator();
        while (iterator.hasNext()) {
            Entry e = iterator.next();
            if (e.terminal != null && e.workerFinished && now - e.terminalAt >= ttlNanos)
                iterator.remove();
        }
    }

    private void disconnect(String sessionId) {
        synchronized (lock) {
            Iterator<Map.Entry<Key, Entry>> iterator = entries.entrySet().iterator();
            while (iterator.hasNext()) {
                Entry e = iterator.next().getValue();
                if (e.key.sessionId().equals(sessionId)) {
                    iterator.remove();
                    e.cancelled = true;
                    if (e.task != null) {
                        e.task.cancel(true);
                        if (workers != null) workers.remove(e.task);
                    }
                }
            }
        }
    }

    int registrySize() { synchronized (lock) { purgeExpired(); return entries.size(); } }
    int queueSize() { return workers == null ? 0 : workers.getQueue().size(); }

    @Override
    @PreDestroy
    public void close() {
        synchronized (lock) {
            closing = true;
            for (Entry e : entries.values()) {
                e.cancelled = true;
                if (e.task != null) e.task.cancel(true);
            }
            entries.clear();
        }
        if (workers != null) workers.shutdownNow();
    }

    private record Key(String sessionId, String requestId) {}
    private record Fingerprint(String routeType, JsonNode body) {}

    private static final class Entry {
        final Key key;
        final Fingerprint fingerprint;
        final CalculationSessions.Run run;
        FutureTask<?> task;
        ApiResponse terminal;
        long terminalAt;
        boolean cancelled;
        boolean workerFinished;

        Entry(Key key, Fingerprint fingerprint, CalculationSessions.Run run) {
            this.key = key;
            this.fingerprint = fingerprint;
            this.run = run;
        }
    }
}
