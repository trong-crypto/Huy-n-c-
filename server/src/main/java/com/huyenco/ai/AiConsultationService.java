package com.huyenco.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.admin.HexagramInterpretations;
import com.huyenco.common.exception.ContractException;
import com.huyenco.history.CompletedResults;
import com.huyenco.history.HistoryStore;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AiConsultationService {
    static final String TRANSFORMATION_RULE = "Quẻ chủ giữ nguyên như kết quả ban đầu. "
            + "Quẻ biến được lập riêng bằng cách đảo âm/dương tại hào động.";
    private static final Pattern GENERATED_REFERENCE = Pattern.compile("(?iu)\\bH_[\\p{L}\\p{N}_]+|https?://");
    private static final Pattern GENERATED_METADATA = Pattern.compile(
            "(?imU)^\\h*[-*>#]*\\h*(?:"
                    + "server\\h+(?:cung\\h+cấp|ghi\\h+nhận|liệt\\h+kê)\\h+(?:các\\h+)?nguồn\\b"
                    + "|(?:dữ\\h+kiện\\h+từ\\h+server|tên\\h+nguồn\\h+do\\h+server\\h+ghi\\h+nhận)\\h*[:：]"
                    + "|(?:các\\h+)?(?:nguồn|tài\\h+liệu\\h+tham\\h+khảo)"
                    + "(?:\\h*[:：]|\\h+là\\b|\\h+(?:được|do|đối\\h+chiếu|tham\\h+khảo|trích\\h+dẫn|gồm)\\b[^\\r\\n]*[:：]))");
    private static final Pattern GENERATED_EXPLANATION = Pattern.compile("(?imU)^\\h*[-*>#]*\\h*diễn\\h+giải\\h+của\\h+ai\\h*[:：]\\h*\\**");
    private static final Pattern HEXAGRAM_COMPARISON = Pattern.compile("(?iu)khác nhau|phân biệt|so sánh|ghi đè");
    private static final Pattern REQUESTED_LINE = Pattern.compile("(?iU)\\b(?:lời|giải nghĩa|đoạn giải)\\h+hào\\h+([1-6])\\b");
    private final HistoryStore history;
    private final CompletedResults results;
    private final ObjectMapper mapper;
    private final AiProvider provider;
    private final Optional<HexagramInterpretations> library;
    private final Semaphore requests = new Semaphore(4);

    AiConsultationService(HistoryStore history, CompletedResults results, ObjectMapper mapper, AiProvider provider,
                          Optional<HexagramInterpretations> library) {
        this.history = history;
        this.results = results;
        this.mapper = mapper;
        this.provider = provider;
        this.library = library;
    }

    String mode() { return provider.mode(); }

    Answer ask(HistoryStore.Owner owner, UUID readingId, UUID requestId, String question, List<Turn> turns) {
        if (!requests.tryAcquire()) throw new ContractException("TOO_MANY_REQUESTS", "Trợ lý AI đang bận. Vui lòng thử lại.");
        try {
            Reading reading = readingId == null && requestId == null ? null : context(owner, readingId, requestId);
            String mode = provider.mode();
            var maiHoa = reading != null && reading.facts() instanceof ReadingFacts facts && "live".equals(mode) ? facts : null;
            String clarification = maiHoa == null ? "" : serverClarification(question, maiHoa);
            String answer = clarification.isEmpty() ? provider.answer(new Prompt(question, turns, reading)) : clarification;
            if (maiHoa != null) {
                var facts = maiHoa;
                String serverFacts = "Dữ kiện từ Server: quẻ chủ %s, quẻ hỗ %s, quẻ biến %s, hào động %d."
                        .formatted(label(facts.primary()), label(facts.mutual()), label(facts.changed()), facts.movingLine());
                serverFacts += "\n" + TRANSFORMATION_RULE;
                if (!reading.sources().isEmpty()) {
                    var titles = reading.sources().stream().map(Source::title).distinct().toList();
                    serverFacts += "\nTên nguồn do Server ghi nhận: " + String.join(" · ", titles) + ".";
                }
                if (reading.library().size() < 3) {
                    serverFacts += "\nThư viện chưa có bài luận giải đã công bố cho một hoặc nhiều quẻ trong kết quả này.";
                }
                if (clarification.isEmpty()) {
                    if (GENERATED_REFERENCE.matcher(answer).find()) {
                        throw new ContractException("AI_UNAVAILABLE", "Mô hình đưa ra tham chiếu chưa kiểm chứng. Hãy thử hỏi lại.");
                    }
                    answer = explanation(answer);
                    answer = answer.isEmpty()
                            ? serverFacts + "\n\nMô hình chưa đưa ra diễn giải phù hợp cho câu hỏi này. Xem chi tiết ở mục nguồn đi kèm kết quả từ Server."
                            : serverFacts + "\n\nDiễn giải của AI:\n" + answer;
                } else {
                    answer = serverFacts + "\n\n" + clarification;
                }
            } else if (reading != null && reading.facts() instanceof TamTheFacts && "live".equals(mode)) {
                if (GENERATED_REFERENCE.matcher(answer).find()) {
                    throw new ContractException("AI_UNAVAILABLE", "Mô hình đưa ra tham chiếu chưa kiểm chứng. Hãy thử hỏi lại.");
                }
                answer = explanation(answer);
                if (answer.isEmpty()) throw new ContractException("AI_UNAVAILABLE", "Mô hình chưa trả về diễn giải phù hợp.");
            }
            return new Answer(answer, mode,
                    reading == null ? List.of() : reading.sources(), reading == null ? null : reading.facts());
        } finally {
            requests.release();
        }
    }

    private static String serverClarification(String question, ReadingFacts facts) {
        var line = REQUESTED_LINE.matcher(question);
        if (line.find()) {
            int requested = Integer.parseInt(line.group(1));
            if (requested != facts.movingLine()) {
                return "Kết quả này có hào động %d. Luồng giải thích hào động không dùng lời hào %d."
                        .formatted(facts.movingLine(), requested);
            }
            return "";
        }
        String text = question.toLowerCase(Locale.ROOT);
        if (text.contains("quẻ chủ") && text.contains("quẻ biến") && HEXAGRAM_COMPARISON.matcher(text).find()) {
            return "Trong kết quả này, %s là quẻ chủ và %s là quẻ biến sau khi đảo hào %d."
                    .formatted(label(facts.primary()), label(facts.changed()), facts.movingLine());
        }
        return "";
    }

    private static String explanation(String answer) {
        var metadata = GENERATED_METADATA.matcher(answer);
        if (metadata.lookingAt()) {
            var heading = GENERATED_EXPLANATION.matcher(answer);
            if (!heading.find()) return "";
            answer = answer.substring(heading.end()).strip();
        }
        metadata = GENERATED_METADATA.matcher(answer);
        return metadata.find() ? answer.substring(0, metadata.start()).strip() : answer;
    }

    private static String label(Hexagram hexagram) {
        return hexagram.name().isEmpty() ? hexagram.code() : hexagram.name();
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

    private Reading context(String type, JsonNode node) {
        if (node == null) throw missing();
        if ("TAM_THE".equals(type)) return tamTheContext(node);
        if (!"MAI_HOA".equals(type)) throw missing();
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
        var excerpts = new ArrayList<LibraryExcerpt>();
        library.ifPresent(catalog -> {
            excerpt(catalog, excerpts, sources, facts.primary(), "Quẻ chủ", line);
            excerpt(catalog, excerpts, sources, facts.mutual(), "Quẻ hỗ", 0);
            excerpt(catalog, excerpts, sources, facts.changed(), "Quẻ biến", 0);
        });
        sources(sources, detailed.path("sourceReferences"));
        sources(sources, node.path("sourceReferences"));
        var decisions = new ArrayList<String>();
        for (JsonNode decision : detailed.path("calculationDecisions")) {
            add(decisions, value(decision, "description", 400));
            add(decisions, value(decision, "limitation", 400));
        }
        node.path("decisionReferences").elements().forEachRemaining(ref -> add(decisions, value(ref, "description", 400)));
        return new Reading(facts, value(detailed, "topic", 40), List.copyOf(passages), List.copyOf(decisions),
                List.copyOf(sources), List.copyOf(excerpts));
    }

    private Reading tamTheContext(JsonNode node) {
        var categories = new ArrayList<String>();
        var passages = new ArrayList<String>();
        var sources = new ArrayList<Source>();
        for (JsonNode category : node.path("categories")) {
            String label = switch (category.path("category").asText()) {
                case "CAREER" -> "Công danh";
                case "WEALTH" -> "Tài lộc";
                case "LOVE" -> "Tình duyên";
                default -> throw missing();
            };
            categories.add(label);
            tamTheEntries(category.path("entries"), label, passages, sources);
            for (JsonNode subreading : category.path("subreadings")) {
                String sublabel = switch (subreading.path("code").asText()) {
                    case "LOC" -> "Lộc";
                    case "SANG_HEN" -> "Sang hèn";
                    case "DIEN_SAN" -> "Điền sản";
                    default -> throw missing();
                };
                if ("NO_SOURCE_MATCH".equals(subreading.path("status").asText())) {
                    passages.add(sublabel + ": Chưa có lời luận tương ứng trong nguồn.");
                } else {
                    tamTheEntries(subreading.path("entries"), sublabel, passages, sources);
                }
                sources(sources, subreading.path("sourceReferences"));
            }
        }
        if (categories.isEmpty() || passages.isEmpty()) throw missing();
        sources(sources, node.path("sourceReferences"));
        return new Reading(new TamTheFacts("TAM_THE", List.copyOf(categories), value(node, "sourceStatus", 40),
                value(node, "ruleBasis", 40)), "", List.copyOf(passages), List.of(), List.copyOf(sources), List.of());
    }

    private static void tamTheEntries(JsonNode entries, String label, List<String> passages, List<Source> sources) {
        for (JsonNode entry : entries) {
            String text = value(entry, "content", 600);
            if (!text.isEmpty() && passages.size() < 10) passages.add(label + " · " + value(entry, "title", 120) + ": " + text);
            sources(sources, entry.path("sourceReferences"));
        }
    }

    private static void excerpt(HexagramInterpretations catalog, List<LibraryExcerpt> excerpts, List<Source> sources,
                                Hexagram hexagram, String role, int movingLine) {
        var publication = catalog.published(hexagram.code()).publication();
        if (publication == null || publication.sources().isEmpty()) return;
        var approved = new ArrayList<Source>();
        for (JsonNode source : publication.sources()) {
            if (!"VERIFIED".equals(source.path("reviewStatus").asText())) return;
            String title = value(source, "title", 200);
            String locator = value(source, "locator", 240);
            String url = value(source, "url", 1000);
            if (title.isEmpty() || locator.isEmpty() || !https(url)) return;
            approved.add(new Source(title, hexagram.code() + " · " + locator + " · v" + publication.version(), "", null, url));
        }
        JsonNode content = publication.content();
        String lineText = movingLine == 0 ? "" : excerptText(content.path("lines").path(movingLine - 1), 320);
        excerpts.add(new LibraryExcerpt(role, hexagram.code(), value(content, "overview", 450), lineText));
        for (Source source : approved) {
            if (sources.size() < 12 && !sources.contains(source)) sources.add(source);
        }
    }

    private static boolean https(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException invalid) {
            return false;
        }
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
            var source = new Source(title, section, value(item, "printedPage", 40), page > 0 ? page : null, null);
            if (!target.contains(source)) target.add(source);
        }
    }

    private static void add(List<String> items, String text) {
        if (items.size() < 5 && !text.isEmpty()) items.add(text);
    }

    private static String value(JsonNode node, String key, int max) {
        return excerptText(node.path(key), max);
    }

    private static String excerptText(JsonNode field, int max) {
        if (!field.isTextual()) return "";
        String text = field.textValue().strip();
        return text.substring(0, text.offsetByCodePoints(0, Math.min(max, text.codePointCount(0, text.length()))));
    }

    private static ContractException missing() {
        return new ContractException("NOT_FOUND", "Kết quả không còn khả dụng trong tài khoản hoặc phiên này.");
    }

    record Turn(String question, String answer) {}
    record Source(String title, String section, String printedPage, Integer pdfPage, String url) {}
    record Hexagram(String code, String name, String nameStatus) {}
    sealed interface Facts permits ReadingFacts, TamTheFacts {}
    record ReadingFacts(String method, Hexagram primary, Hexagram mutual, Hexagram changed, int movingLine,
                        String sourceStatus, String ruleBasis) implements Facts {}
    record TamTheFacts(String type, List<String> categories, String sourceStatus, String ruleBasis) implements Facts {}
    record LibraryExcerpt(String role, String code, String overview, String movingLineText) {}
    record Reading(Facts facts, String topic, List<String> passages, List<String> decisions, List<Source> sources,
                   List<LibraryExcerpt> library) {}
    record Prompt(String question, List<Turn> turns, Reading reading) {}
    record Answer(String answer, String mode, List<Source> sources, Facts reading) {}
}
