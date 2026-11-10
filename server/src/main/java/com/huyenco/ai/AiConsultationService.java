package com.huyenco.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.exception.ContractException;
import com.huyenco.history.CompletedResults;
import com.huyenco.history.HistoryStore;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AiConsultationService {
    private final HistoryStore history;
    private final CompletedResults results;
    private final ObjectMapper mapper;
    private final AiProvider provider;
    private final Semaphore requests = new Semaphore(4);

    AiConsultationService(HistoryStore history, CompletedResults results, ObjectMapper mapper, AiProvider provider) {
        this.history = history;
        this.results = results;
        this.mapper = mapper;
        this.provider = provider;
    }

    String mode() { return provider.mode(); }

    Answer ask(HistoryStore.Owner owner, UUID readingId, UUID requestId, String question, List<Turn> turns) {
        if (!requests.tryAcquire()) throw new ContractException("TOO_MANY_REQUESTS", "Trợ lý AI đang bận. Vui lòng thử lại.");
        try {
            Reading reading = readingId == null && requestId == null ? null : context(owner, readingId, requestId);
            return new Answer(provider.answer(new Prompt(question, turns, reading)), provider.mode(),
                    reading == null ? List.of() : reading.sources(), reading == null ? null : reading.facts());
        } finally {
            requests.release();
        }
    }

    private Reading context(HistoryStore.Owner owner, UUID readingId, UUID requestId) {
        var saved = readingId == null ? history.byRequest(owner, requestId) : history.detail(owner, readingId);
        if (saved.isPresent()) {
            var detail = saved.get();
            return context(detail.type(), detail.result());
        }
        if (readingId != null) throw missing();
        var cached = results.find(owner, requestId).orElseThrow(AiConsultationService::missing);
        try {
            return context(cached.type(), mapper.readTree(cached.json()));
        } catch (JsonProcessingException error) {
            throw missing();
        }
    }

    private static Reading context(String type, JsonNode node) {
        if (!"MAI_HOA".equals(type) || node == null) throw missing();
        int line = node.path("movingLine").isIntegralNumber() ? node.path("movingLine").asInt() : 0;
        String method = value(node, "method", 40);
        if (line < 1 || line > 6 || !Set.of("TIME", "OBJECT_COUNT", "LINES", "TRUONG_XICH").contains(method)) throw missing();
        var facts = new ReadingFacts(method, hexagram(node.path("primaryHexagram")), hexagram(node.path("mutualHexagram")),
                hexagram(node.path("changedHexagram")), line, value(node, "sourceStatus", 40), value(node, "ruleBasis", 40));
        JsonNode detailed = node.path("detailedReading");
        var passages = new ArrayList<String>();
        add(passages, value(detailed, "summary", 900));
        detailed.path("phases").elements().forEachRemaining(phase -> add(passages, value(phase, "content", 600)));
        var sources = new ArrayList<Source>();
        sources(sources, detailed.path("sourceReferences"));
        sources(sources, node.path("sourceReferences"));
        var decisions = new ArrayList<String>();
        for (JsonNode decision : detailed.path("calculationDecisions")) {
            add(decisions, value(decision, "description", 400));
            add(decisions, value(decision, "limitation", 400));
        }
        node.path("decisionReferences").elements().forEachRemaining(ref -> add(decisions, value(ref, "description", 400)));
        return new Reading(facts, value(detailed, "topic", 40), List.copyOf(passages), List.copyOf(decisions), List.copyOf(sources));
    }

    private static Hexagram hexagram(JsonNode node) {
        String code = value(node, "code", 40);
        if (code.isEmpty()) throw missing();
        String status = value(node, "nameStatus", 40);
        return new Hexagram(code, "VERIFIED".equals(status) ? value(node, "name", 120) : "", status);
    }

    private static void sources(List<Source> target, JsonNode list) {
        for (JsonNode item : list) {
            if (target.size() >= 12) break;
            String title = value(item, "title", 200), section = value(item, "section", 240);
            if (title.isEmpty() || section.isEmpty()) continue;
            int page = item.path("pdfPage").asInt(0);
            var source = new Source(title, section, value(item, "printedPage", 40), page > 0 ? page : null);
            if (!target.contains(source)) target.add(source);
        }
    }

    private static void add(List<String> items, String text) {
        if (items.size() < 5 && !text.isEmpty()) items.add(text);
    }

    private static String value(JsonNode node, String key, int max) {
        JsonNode field = node.path(key);
        if (!field.isTextual()) return "";
        String text = field.textValue().strip();
        return text.substring(0, text.offsetByCodePoints(0, Math.min(max, text.codePointCount(0, text.length()))));
    }

    private static ContractException missing() {
        return new ContractException("NOT_FOUND", "Kết quả Mai Hoa không còn khả dụng trong tài khoản hoặc phiên này.");
    }

    record Turn(String question, String answer) {}
    record Source(String title, String section, String printedPage, Integer pdfPage) {}
    record Hexagram(String code, String name, String nameStatus) {}
    record ReadingFacts(String method, Hexagram primary, Hexagram mutual, Hexagram changed, int movingLine,
                        String sourceStatus, String ruleBasis) {}
    record Reading(ReadingFacts facts, String topic, List<String> passages, List<String> decisions, List<Source> sources) {}
    record Prompt(String question, List<Turn> turns, Reading reading) {}
    record Answer(String answer, String mode, List<Source> sources, ReadingFacts reading) {}
}
