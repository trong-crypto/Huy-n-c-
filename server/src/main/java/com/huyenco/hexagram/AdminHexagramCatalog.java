package com.huyenco.hexagram;

import com.huyenco.common.dto.SourceReference;
import com.huyenco.knowledge.HexagramLookupSnapshot;
import com.huyenco.knowledge.HexagramRecord;
import com.huyenco.knowledge.JdbcKnowledgeRepository;
import com.huyenco.knowledge.SourceStatus;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("db")
public final class AdminHexagramCatalog {
    public enum GlossStatus {
        MISSING, DRAFT, SOURCE_LOCATED, SOURCE_AMBIGUOUS, BLOCKED_SOURCE_CONFLICT, VERIFIED
    }

    private final JdbcKnowledgeRepository repository;

    public AdminHexagramCatalog(JdbcKnowledgeRepository repository) {
        this.repository = repository;
    }

    public Page list(String q, String upper, String lower, SourceStatus nameStatus, GlossStatus glossStatus, int page, int size) {
        HexagramLookupService.validateList(q, upper, lower, page, size);
        var snapshot = HexagramLookupService.validated(repository.adminHexagramSnapshot());
        var glosses = new HashMap<String, HexagramLookupSnapshot.Gloss>();
        for (var gloss : snapshot.glosses()) glosses.put(gloss.code(), gloss);
        var items = HexagramLookupService.matching(snapshot, q, upper, lower).stream()
                .filter(record -> nameStatus == null || record.nameStatus() == nameStatus)
                .map(record -> item(record, glosses.get(record.code())))
                .filter(item -> glossStatus == null || item.glossStatus() == glossStatus).toList();
        long offset = (long) page * size;
        List<Item> rows = offset >= items.size() ? List.of()
                : items.subList((int) offset, (int) Math.min(offset + size, items.size()));
        return new Page(rows, page, size, items.size(), (items.size() + size - 1) / size);
    }

    public Detail detail(String code) {
        HexagramLookupService.validateCode(code);
        var snapshot = HexagramLookupService.validated(repository.adminHexagramSnapshot());
        var record = HexagramLookupService.find(snapshot, code);
        var gloss = snapshot.glosses().stream().filter(entry -> code.equals(entry.code())).findFirst().orElse(null);
        return new Detail(item(record, gloss), record.linesBottomUp(), link(record.sourceSectionId(), record.source()),
                gloss == null ? null : new NameGloss("NAME_GLOSS", gloss.content(), gloss.status(), gloss.sourceOrder(),
                        gloss.printedSourceLabel(), gloss.reviewer(), gloss.reviewedAt(), gloss.note(),
                        link(gloss.sourceSectionId(), gloss.source()), HexagramLookupService.publishable(gloss)));
    }

    private static Item item(HexagramRecord record, HexagramLookupSnapshot.Gloss gloss) {
        return new Item(record.code(), record.name(), record.nameKind(), record.nameStatus(),
                record.upperTrigramCode(), record.lowerTrigramCode(),
                gloss == null ? GlossStatus.MISSING : GlossStatus.valueOf(gloss.status().name()));
    }

    private static SourceLink link(Long id, SourceReference reference) {
        return id == null ? null : new SourceLink(id.toString(), reference);
    }

    public record Page(List<Item> items, int page, int size, int totalElements, int totalPages) {}
    public record Item(String code, String name, String nameKind, SourceStatus nameStatus, String upperTrigramCode,
                       String lowerTrigramCode, GlossStatus glossStatus) {}
    public record Detail(Item hexagram, List<Boolean> linesBottomUp, SourceLink nameSource, NameGloss nameGloss) {}
    public record SourceLink(String sectionId, SourceReference reference) {}
    public record NameGloss(String category, String content, SourceStatus verificationStatus, int sourceOrder,
                            String printedSourceLabel, String reviewer, Instant reviewedAt, String verificationNote,
                            SourceLink source, boolean publiclyVisible) {}
}
