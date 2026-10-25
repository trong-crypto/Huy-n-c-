package com.huyenco.websocket;

import com.huyenco.common.dto.ApiResponse;
import com.huyenco.common.dto.CalculationProgress;
import com.huyenco.common.dto.ProgressEvent;
import com.huyenco.history.CompletedResults;
import com.huyenco.history.HistoryStore;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/** Session-scoped request lifecycle and deadline management. */
@Component
public class CalculationSessions implements AutoCloseable {
    private final SimpMessagingTemplate messages;
    private final ScheduledThreadPoolExecutor deadlines;
    private final long timeoutMillis;
    private final int maxSessions, maxActive, maxPerSession;
    private final Map<String, Set<Run>> sessions = new HashMap<>();
    private final Map<String, HistoryStore.Owner> owners = new HashMap<>();
    private CompletedResults completedResults;
    private volatile Consumer<String> disconnectListener = ignored -> {};
    private int active;
    private boolean closing;

    public CalculationSessions(SimpMessagingTemplate messages,
            @Value("${huyenco.processing-timeout-ms:10000}") long timeoutMillis,
            @Value("${huyenco.max-calculation-sessions:1024}") int maxSessions,
            @Value("${huyenco.max-active-calculations:1000}") int maxActive,
            @Value("${huyenco.max-active-per-session:16}") int maxPerSession) {
        if (timeoutMillis < 1 || maxSessions < 1 || maxActive < 1 || maxPerSession < 1)
            throw new IllegalArgumentException("Calculation limits must be positive");
        this.messages = messages;
        this.timeoutMillis = timeoutMillis;
        this.maxSessions = maxSessions;
        this.maxActive = maxActive;
        this.maxPerSession = maxPerSession;
        deadlines = new ScheduledThreadPoolExecutor(1, runnable -> {
            var thread = new Thread(runnable, "calculation-deadlines");
            thread.setDaemon(true);
            return thread;
        });
        deadlines.setRemoveOnCancelPolicy(true);
        deadlines.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
    }

    public synchronized boolean connect(String sessionId) {
        return connect(sessionId,null);
    }

    @Autowired
    public void historyResults(CompletedResults results) { this.completedResults=results; }

    public void onDisconnect(Consumer<String> listener) { this.disconnectListener = Objects.requireNonNull(listener); }

    public synchronized boolean connect(String sessionId,HistoryStore.Owner owner) {
        if (closing || sessionId == null) return false;
        if (sessions.containsKey(sessionId)) return true;
        if (sessions.size() >= maxSessions) return false;
        sessions.put(sessionId, new HashSet<>());
        if(owner!=null)owners.put(sessionId,owner);
        return true;
    }

    public synchronized Run start(String sessionId, String requestId, String type) {
        if (closing) return null;
        var runs = sessions.get(sessionId);
        if (runs == null) return null; // Already disconnected; never recreate a closed session.
        if (active >= maxActive || runs.size() >= maxPerSession) throw new Busy();
        var run = new Run(sessionId, requestId, type,owners.get(sessionId));
        runs.add(run);
        active++;
        run.deadline = deadlines.schedule(() -> run.fail("PROCESSING_TIMEOUT", "Yêu cầu vượt thời gian xử lý."),
                timeoutMillis, TimeUnit.MILLISECONDS);
        return run;
    }

    public void disconnect(String sessionId) {
        Set<Run> removed;
        synchronized (this) {
            removed = sessions.remove(sessionId);
            owners.remove(sessionId);
        }
        if (removed != null) removed.forEach(Run::cancel);
        disconnectListener.accept(sessionId);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) { disconnect(event.getSessionId()); }

    private synchronized void release(Run run) {
        var runs = sessions.get(run.sessionId);
        if (runs != null) runs.remove(run);
        active--;
    }

    public void send(String sessionId, String destination, Object body) {
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(sessionId);
        headers.setLeaveMutable(true);
        messages.convertAndSendToUser(sessionId, destination, body, headers.getMessageHeaders());
    }

    public synchronized int activeCount() { return active; }
    public synchronized int sessionCount() { return sessions.size(); }
    public int deadlineCount() { return deadlines.getQueue().size(); }

    @Override
    @PreDestroy
    public void close() {
        List<String> ids;
        synchronized (this) { closing = true; ids = List.copyOf(sessions.keySet()); }
        ids.forEach(this::disconnect);
        deadlines.shutdownNow();
    }

    public final class Run implements CalculationProgress {
        private final String sessionId, requestId, type;
        private final HistoryStore.Owner owner;
        private int sequence;
        private boolean terminal;
        private ApiResponse terminalResponse;
        private Consumer<ApiResponse> terminalListener;
        private ScheduledFuture<?> deadline;

        private Run(String sessionId, String requestId, String type,HistoryStore.Owner owner) {
            this.sessionId = sessionId;
            this.requestId = requestId;
            this.type = type;
            this.owner = owner;
        }

        /** Installed before dispatch; also reports a deadline that fired before registration. */
        public synchronized void onTerminal(Consumer<ApiResponse> listener) {
            if (terminalListener != null) throw new IllegalStateException("Listener already registered");
            terminalListener = Objects.requireNonNull(listener);
            if (terminal) listener.accept(terminalResponse);
        }

        @Override
        public synchronized void report(ProgressEvent.Step step, String message) {
            if (terminal) throw new Stopped();
            if (requestId != null) send(sessionId, "/queue/progress",
                    new ProgressEvent(requestId, type, ++sequence, step, message));
        }

        public synchronized void complete(Object data) {
            if(terminal)return;
            if(completedResults!=null)completedResults.capture(owner,requestId,type,data);
            finish("/queue/results", ApiResponse.completed(requestId, type, data));
        }

        public synchronized void fail(String code, String message) {
            fail(code, message, null, null);
        }

        public synchronized void fail(String code, String message, String ruleCode, String reason) {
            finish("/queue/errors", ApiResponse.failed(requestId, type, code, message, ruleCode, reason));
        }

        private void finish(String destination, ApiResponse response) {
            if (terminal) return;
            terminal = true;
            terminalResponse = response;
            if (deadline != null) deadline.cancel(false);
            try { send(sessionId, destination, response); }
            finally {
                release(this);
                if (terminalListener != null) terminalListener.accept(response);
            }
        }

        public synchronized void cancel() {
            if (terminal) return;
            terminal = true;
            if (deadline != null) deadline.cancel(false);
            release(this);
            if (terminalListener != null) terminalListener.accept(null);
        }
    }

    public static final class Stopped extends RuntimeException { }
    public static final class Busy extends RuntimeException { }
}
