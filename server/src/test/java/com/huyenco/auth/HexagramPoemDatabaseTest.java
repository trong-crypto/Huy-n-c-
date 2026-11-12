package com.huyenco.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "spring.datasource.url=${HUYENCO_CHAT_ROOM_TEST_DB_URL}",
        "spring.datasource.username=${HUYENCO_CHAT_ROOM_TEST_DB_USERNAME}",
        "spring.datasource.password=${HUYENCO_CHAT_ROOM_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=false",
        "huyenco.hexagram.interpretation.enabled=true",
        "huyenco.auth.enabled=true",
        "huyenco.auth.csrf-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "huyenco.allowed-origins=http://127.0.0.1:3173"
})
@AutoConfigureMockMvc
@ActiveProfiles("db")
@EnabledIfEnvironmentVariable(named = "HUYENCO_CHAT_ROOM_TEST_DB_URL",
        matches = "jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/huyenco_chat_room_test(?:_[a-z0-9]+)?")
@Transactional
class HexagramPoemDatabaseTest {
    private static final String CODE = "H_CAN_CAN";
    private static final String ADMIN = "/api/v1/admin/hexagrams/" + CODE + "/interpretation";
    private static final String PUBLIC = "/api/v1/hexagrams/" + CODE + "/interpretation";
    private static final String SOURCE = "POEM-WORKFLOW-TEST";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Autowired AccountAuthService accounts;

    @Test
    void preservesOldInterpretationAndPublishesOnlyReviewedPoemRevisions() throws Exception {
        var editor = signIn("ADMIN");
        var reviewer = signIn("ADMIN");
        assertEquals(64, db.queryForObject("SELECT count(*) FROM hexagrams", Integer.class));
        assertEquals(384, db.queryForObject("SELECT count(*) FROM hexagram_lines", Integer.class));
        var catalogBefore = catalogFingerprint();
        db.update("""
                INSERT INTO cms_hexagram_interpretation_sources(id,hexagram_code,title,edition,locator,url,reuse_note,review_status)
                VALUES (?,?,'TEST','TEST','TEST','https://example.org/fixture','TEST only','VERIFIED')
                """, SOURCE, CODE);

        var initial = adminState(editor);
        if (initial.path("status").asText().equals("PENDING_REVIEW")) {
            initial = workflow(reviewer, initial.path("version").asInt(), "RETURN");
        }
        var oldPublication = publicReading().path("publication");
        var oldContent = initial.at("/latest/content");
        ObjectNode document = oldContent.isObject() ? (ObjectNode) oldContent.deepCopy() : sampleContent();
        document.remove("poem");

        String verses = "  Dòng đầu\r\n\r\nDòng sau\n";
        ObjectNode poem = json.createObjectNode().put("title", "TEST: Bài thơ").put("body", verses)
                .put("author", "Nhóm TEST").put("source", "Ghi chú nguồn TEST");
        var withPoem = document.deepCopy();
        withPoem.set("poem", poem);
        int expected = initial.path("version").asInt();

        mvc.perform(put(ADMIN).contentType(MediaType.APPLICATION_JSON).content(saveBody(expected, withPoem).toString()))
                .andExpect(status().isUnauthorized());
        mvc.perform(signIn("USER").send(put(ADMIN), saveBody(expected, withPoem))).andExpect(status().isUnauthorized());
        mvc.perform(put(ADMIN).cookie(editor.cookie()).header("Origin", "http://127.0.0.1:3173")
                        .header("X-HuyenCo-Request", "1").contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody(expected, withPoem).toString()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        for (String invalid : new String[]{"  \n", "a".repeat(8001), "Dòng có ký tự " + (char) 0}) {
            var bad = document.deepCopy();
            bad.set("poem", poem.deepCopy().put("body", invalid));
            mvc.perform(editor.send(put(ADMIN), saveBody(expected, bad))).andExpect(status().isBadRequest());
        }

        var draft = save(editor, expected, withPoem);
        assertEquals(withPoem, draft.at("/latest/content"));
        assertEquals(oldPublication, publicReading().path("publication"));
        var legacySave = save(editor, draft.path("version").asInt(), document);
        assertEquals(withPoem, legacySave.at("/latest/content"));
        var pending = workflow(editor, legacySave.path("version").asInt(), "SUBMIT");
        mvc.perform(editor.send(post(ADMIN + "/workflow"), action(pending.path("version").asInt(), "PUBLISH")))
                .andExpect(status().isForbidden());
        assertEquals(oldPublication, publicReading().path("publication"));
        var published = workflow(reviewer, pending.path("version").asInt(), "PUBLISH");
        int firstVersion = published.path("publishedVersion").asInt();
        assertEquals(withPoem, publicReading().at("/publication/content"));

        var amended = withPoem.deepCopy();
        var revisedPoem = poem.deepCopy().put("body", "Thơ đã sửa\nDòng hai");
        revisedPoem.remove("source");
        amended.set("poem", revisedPoem);
        var edited = save(editor, published.path("version").asInt(), amended);
        assertEquals(withPoem, publicReading().at("/publication/content"));
        var editPending = workflow(editor, edited.path("version").asInt(), "SUBMIT");
        var returned = workflow(reviewer, editPending.path("version").asInt(), "RETURN");
        var resubmitted = workflow(editor, returned.path("version").asInt(), "SUBMIT");
        var second = workflow(reviewer, resubmitted.path("version").asInt(), "PUBLISH");
        assertEquals(amended, publicReading().at("/publication/content"));

        var removal = save(editor, second.path("version").asInt(), document.deepCopy().putNull("poem"));
        assertEquals(document, removal.at("/latest/content"));
        assertEquals(amended, publicReading().at("/publication/content"));
        var removalPending = workflow(editor, removal.path("version").asInt(), "SUBMIT");
        workflow(reviewer, removalPending.path("version").asInt(), "PUBLISH");
        var finalContent = publicReading().at("/publication/content");
        assertFalse(finalContent.has("poem"));
        assertEquals(document, finalContent);
        assertEquals(withPoem, data(get(ADMIN + "/revisions/" + firstVersion).cookie(editor.cookie())).path("content"));
        assertEquals(editor.id(), db.queryForObject("""
                SELECT created_by FROM cms_hexagram_interpretation_revisions WHERE hexagram_code=? AND version=?
                """, UUID.class, CODE, firstVersion));
        assertEquals(reviewer.id(), db.queryForObject("""
                SELECT actor_id FROM cms_hexagram_interpretation_events WHERE hexagram_code=? AND revision=? AND action='PUBLISH'
                """, UUID.class, CODE, firstVersion));
        assertEquals(catalogBefore, catalogFingerprint());
    }

    private ObjectNode sampleContent() {
        var content = json.createObjectNode().put("overview", "TEST tổng quan").put("image", "TEST hình tượng")
                .put("original", "元亨利貞").put("paraphrase", "TEST diễn nghĩa").put("application", "TEST ứng dụng");
        var lines = content.putArray("lines");
        for (int i = 1; i <= 6; i++) lines.add("TEST hào " + i);
        return content;
    }

    private String catalogFingerprint() {
        return db.queryForObject("""
                SELECT
                  (SELECT md5(string_agg(to_jsonb(h)::text, '|' ORDER BY h.code)) FROM hexagrams h)
                  || ':' ||
                  (SELECT md5(string_agg(to_jsonb(l)::text, '|' ORDER BY l.hexagram_code,l.line_number)) FROM hexagram_lines l)
                """, String.class);
    }

    private JsonNode adminState(Session session) throws Exception {
        return data(get(ADMIN).cookie(session.cookie()));
    }

    private JsonNode publicReading() throws Exception {
        return data(get(PUBLIC));
    }

    private ObjectNode saveBody(int version, ObjectNode content) {
        var body = json.createObjectNode().put("expectedVersion", version);
        body.set("content", content);
        body.putArray("sourceIds").add(SOURCE);
        return body;
    }

    private ObjectNode action(int version, String action) {
        var body = json.createObjectNode().put("expectedVersion", version).put("action", action);
        if (!action.equals("SUBMIT")) body.put("reviewNote", "Kiểm thử workflow");
        return body;
    }

    private JsonNode save(Session session, int version, ObjectNode content) throws Exception {
        return data(session.send(put(ADMIN), saveBody(version, content)));
    }

    private JsonNode workflow(Session session, int version, String action) throws Exception {
        return data(session.send(post(ADMIN + "/workflow"), action(version, action)));
    }

    private JsonNode data(MockHttpServletRequestBuilder request) throws Exception {
        return json.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsByteArray()).path("data");
    }

    private Session signIn(String role) {
        String identifier = "poem-" + UUID.randomUUID();
        String password = UUID.randomUUID().toString();
        UUID id = accounts.register("Poem TEST", identifier, password, null).account().id();
        db.update("UPDATE accounts SET role=? WHERE id=?", role, id);
        var realm = "ADMIN".equals(role) ? AccountAuthService.Realm.ADMIN : AccountAuthService.Realm.CUSTOMER;
        var issued = accounts.login(realm, identifier, password, null);
        return new Session(id, new Cookie(realm.cookie, issued.token()), issued.session().csrfToken());
    }

    private record Session(UUID id, Cookie cookie, String csrf) {
        MockHttpServletRequestBuilder send(MockHttpServletRequestBuilder request, ObjectNode body) {
            return request.cookie(cookie).header("Origin", "http://127.0.0.1:3173").header("X-HuyenCo-Request", "1")
                    .header("X-CSRF-Token", csrf).contentType(MediaType.APPLICATION_JSON).content(body.toString());
        }
    }
}
