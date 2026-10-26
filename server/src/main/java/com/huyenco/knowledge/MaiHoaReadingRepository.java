package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;

/** The DB attestation and its twenty templates must be read in one consistent snapshot. */
public interface MaiHoaReadingRepository {
    Snapshot readingSnapshot();
    record Bundle(String id, String sha256, JsonNode document, String editor, String reviewer,
                  Instant reviewedAt, String reviewMethod, String status) { }
    record Template(String code, String bundleId, String topic, String relation, String content,
                    String textKind, JsonNode sourceRecord, String bookSha256, int bookPages, String bookTitle) { }
    record Snapshot(Bundle bundle, List<Template> templates) {
        public Snapshot { templates = List.copyOf(templates); }
    }
}
