package com.huyenco.hexagram;

import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.*;
import java.text.Normalizer;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class HexagramLookupService {
    public static final Set<String> TRIGRAMS = Set.of("CAN", "DOAI", "LY", "CHAN", "TON", "KHAM", "CAN2", "KHON");
    private final HexagramLookupRepository repository;

    public HexagramLookupService(HexagramLookupRepository repository) { this.repository = repository; }

    public Page list(String q, String upper, String lower, int page, int size) {
        if (q == null || q.length() > 100 || page < 0 || size < 1 || size > 100 ||
                (upper != null && !TRIGRAMS.contains(upper)) || (lower != null && !TRIGRAMS.contains(lower)))
            throw invalid();
        String query = normalized(q.strip());
        boolean accents = !query.equals(fold(query));
        var matches = validated().hexagrams().stream()
                .filter(h -> upper == null || upper.equals(h.upperTrigramCode()))
                .filter(h -> lower == null || lower.equals(h.lowerTrigramCode()))
                .filter(h -> (accents ? normalized(h.name()) : fold(h.name())).contains(query) ||
                        (query.startsWith("h_") && normalized(h.code()).contains(query)))
                .sorted(Comparator.comparing(HexagramRecord::code)).toList();
        long start = (long) page * size;
        List<Item> items = start >= matches.size() ? List.of() : matches.subList((int) start,
                (int) Math.min(start + size, matches.size())).stream().map(HexagramLookupService::item).toList();
        return new Page(items, page, size, matches.size(), (matches.size() + size - 1) / size);
    }

    public Detail detail(String code) {
        if (code == null || code.length() > 64 || !code.matches("H_[A-Z0-9]+_[A-Z0-9]+")) throw invalid();
        var snapshot = validated();
        var hexagram = snapshot.hexagrams().stream().filter(h -> h.code().equals(code)).findFirst()
                .orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy quẻ."));
        var glosses = snapshot.glosses().stream().filter(g -> code.equals(g.code()) && publishable(g))
                .map(g -> new Interpretation("NAME_GLOSS", "Nghĩa tên quẻ " + hexagram.name(), g.content(),
                        List.of(g.source()), SourceStatus.VERIFIED, "NAME_GLOSS", g.sourceOrder(),
                        g.printedSourceLabel(), g.note())).toList();
        return new Detail(hexagram.code(), hexagram.name(), hexagram.nameKind(), hexagram.nameStatus(),
                hexagram.upperTrigramCode(), hexagram.lowerTrigramCode(), hexagram.linesBottomUp(),
                references(hexagram), glosses);
    }

    private HexagramLookupSnapshot validated() {
        var snapshot = repository.lookupSnapshot();
        var codes = new HashSet<String>();
        if (snapshot.hexagrams().size() != 64 || snapshot.glosses().size() > 64) throw new KnowledgeDataException();
        for (var h : snapshot.hexagrams()) {
            if (!codes.add(h.code()) || !TRIGRAMS.contains(h.upperTrigramCode()) ||
                    !TRIGRAMS.contains(h.lowerTrigramCode()) ||
                    !h.code().equals("H_" + h.upperTrigramCode() + "_" + h.lowerTrigramCode()) ||
                    h.linesBottomUp().size() != 6 || h.name() == null || h.name().isBlank() || h.nameStatus() == null ||
                    !Set.of("CANONICAL_TITLE", "STRUCTURAL_LABEL").contains(h.nameKind()) ||
                    (h.nameStatus() == SourceStatus.VERIFIED && h.toCalculationView().name() == null))
                throw new KnowledgeDataException();
        }
        var glossCodes = new HashSet<String>();
        for (var g : snapshot.glosses()) {
            if (!codes.contains(g.code()) || !glossCodes.add(g.code())) throw new KnowledgeDataException();
        }
        return snapshot;
    }

    private static boolean publishable(HexagramLookupSnapshot.Gloss g) {
        return g.status() == SourceStatus.VERIFIED && g.reviewer() != null && !g.reviewer().isBlank() &&
                g.reviewedAt() != null && g.note() != null && !g.note().isBlank() &&
                g.sourceOrder() >= 1 && g.sourceOrder() <= 64 && g.printedSourceLabel() != null &&
                !g.printedSourceLabel().isBlank() && g.content() != null && !g.content().isBlank() &&
                g.source() != null && g.source().hasTraceableLocation();
    }

    private static String normalized(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }
    private static String fold(String value) {
        return Normalizer.normalize(normalized(value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd');
    }
    private static List<SourceReference> references(HexagramRecord h) {
        return h.source() == null ? List.of() : List.of(h.source());
    }
    private static Item item(HexagramRecord h) {
        return new Item(h.code(), h.name(), h.nameKind(), h.nameStatus(), h.upperTrigramCode(),
                h.lowerTrigramCode(), h.linesBottomUp(), references(h));
    }
    public static ContractException invalid() {
        return new ContractException("INVALID_INPUT", "Tham số tra cứu quẻ không hợp lệ.");
    }
    public record Page(List<Item> items, int page, int size, int totalElements, int totalPages) { }
    public record Item(String code, String name, String nameKind, SourceStatus verificationStatus,
                       String upperTrigramCode, String lowerTrigramCode, List<Boolean> linesBottomUp,
                       List<SourceReference> sourceReferences) { }
    public record Detail(String code, String name, String nameKind, SourceStatus verificationStatus,
                         String upperTrigramCode, String lowerTrigramCode, List<Boolean> linesBottomUp,
                         List<SourceReference> sourceReferences, List<Interpretation> interpretations) { }
    public record Interpretation(String resultCode, String title, String content, List<SourceReference> sourceReferences,
                                 SourceStatus verificationStatus, String category, int sourceOrder,
                                 String printedSourceLabel, String verificationNote) { }
}
