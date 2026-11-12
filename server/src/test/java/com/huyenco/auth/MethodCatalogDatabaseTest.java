package com.huyenco.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
        "huyenco.auth.enabled=true",
        "huyenco.auth.csrf-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "huyenco.allowed-origins=http://127.0.0.1:3173"
})
@AutoConfigureMockMvc
@ActiveProfiles("db")
@EnabledIfEnvironmentVariable(named = "HUYENCO_CHAT_ROOM_TEST_DB_URL",
        matches = "jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/huyenco_chat_room_test(?:_[a-z0-9]+)?")
@Transactional
class MethodCatalogDatabaseTest {
    private static final String ADMIN = "/api/v1/admin/methods";
    private static final String PUBLIC = "/api/v1/methods";
    private static final String CODE = "CATALOG_TEST";
    private static final String ENTRY = ADMIN + "/" + CODE;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @Autowired AccountAuthService accounts;

    @Test
    void usesRealAdminSessionAndCsrfForEveryMutation() throws Exception {
        mvc.perform(get(ADMIN)).andExpect(status().isUnauthorized());
        for (String role : new String[]{"USER", "CONSULTANT"}) {
            var customer = signIn(role);
            mvc.perform(get(ADMIN).cookie(customer.cookie())).andExpect(status().isUnauthorized());
            mvc.perform(customer.send(post(ADMIN), metadata("OTHER", false).put("code", CODE)))
                    .andExpect(status().isUnauthorized());
            mvc.perform(customer.send(put(ENTRY), metadata("OTHER", false).put("expectedVersion", 1)))
                    .andExpect(status().isUnauthorized());
            mvc.perform(customer.send(delete(ENTRY), version(1))).andExpect(status().isUnauthorized());
        }
        var admin = signIn("ADMIN");
        mvc.perform(get(ADMIN).cookie(admin.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.code=='TRUONG_XICH')]").isNotEmpty());
        mvc.perform(post(ADMIN).cookie(admin.cookie()).header("Origin", "http://127.0.0.1:3173")
                        .header("X-HuyenCo-Request", "1").contentType(MediaType.APPLICATION_JSON)
                        .content(metadata("OTHER", false).put("code", CODE).toString()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
    }

    @Test
    void storesFiltersAndDeletesUnusedMetadataWithPersistentAudit() throws Exception {
        var admin = signIn("ADMIN");
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", false).put("code", "bad-code")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.reason").value("code"));
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", true).put("code", CODE)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("METHOD_UNAVAILABLE"));
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", false).put("code", CODE)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.method.state").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.method.version").value(1));
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", false).put("code", CODE)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("METHOD_EXISTS"));
        mvc.perform(get(ADMIN).param("q", "catalog_test").param("group", "OTHER").param("state", "UNAVAILABLE")
                        .cookie(admin.cookie()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        mvc.perform(get(ENTRY).cookie(admin.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.instructions").value("Bước 1\nBước 2"));
        mvc.perform(admin.send(put(ENTRY), metadata("MAI_HOA", false).put("expectedVersion", 1).put("name", "Đã sửa")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.method.name").value("Đã sửa"))
                .andExpect(jsonPath("$.data.method.version").value(2));
        mvc.perform(admin.send(put(ENTRY), metadata("OTHER", true).put("expectedVersion", 2)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("METHOD_UNAVAILABLE"));
        mvc.perform(admin.send(delete(ENTRY), version(1)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("VERSION_CONFLICT"));
        mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.method.code=='CATALOG_TEST')]").isEmpty());
        mvc.perform(admin.send(delete(ENTRY), version(2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.deleted").value(true));
        mvc.perform(get(ENTRY).cookie(admin.cookie())).andExpect(status().isNotFound());
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", false).put("code", CODE)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("METHOD_EXISTS"));
        mvc.perform(get("/api/v1/admin/audit").param("targetType", "METHOD_CATALOG").param("targetId", CODE)
                        .cookie(admin.cookie()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.items[0].action").value("DELETE_METHOD"))
                .andExpect(jsonPath("$.data.items[1].action").value("UPDATE_METHOD"))
                .andExpect(jsonPath("$.data.items[2].action").value("CREATE_METHOD"));
    }

    @Test
    void protectsCoreCodesAndKeepsTheExistingGuideWorkflowWhenHidden() throws Exception {
        var admin = signIn("ADMIN");
        var time = ADMIN + "/TIME";
        mvc.perform(admin.send(delete(time), version(1))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("METHOD_PROTECTED"));
        mvc.perform(admin.send(put(time), metadata("OTHER", true).put("expectedVersion", 1)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("METHOD_PROTECTED"));
        mvc.perform(admin.send(put(time), metadata("MAI_HOA", false).put("expectedVersion", 1).put("code", "NEW_TIME")))
                .andExpect(status().isBadRequest());
        var guidePath = "/api/v1/admin/method-guides";
        mvc.perform(admin.send(post(guidePath), json.createObjectNode().put("methodCode", "TIME")
                        .put("title", "Hướng dẫn gốc").put("body", "Các bước hướng dẫn.")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.published.title").value("Hướng dẫn gốc"));
        mvc.perform(admin.send(put(time), metadata("MAI_HOA", false).put("expectedVersion", 1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.method.state").value("HIDDEN"));
        mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.method.code=='TIME')]").isEmpty())
                .andExpect(jsonPath("$.data.items[?(@.method.code=='TAM_THE')]").isNotEmpty());
        mvc.perform(admin.send(put(guidePath + "/TIME/draft"), version(1).put("title", "Hướng dẫn đã sửa")
                        .put("body", "Nội dung hướng dẫn tiếp tục chỉnh sửa.")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.published.title").value("Hướng dẫn đã sửa"));
        mvc.perform(admin.send(put(time), metadata("MAI_HOA", true).put("expectedVersion", 2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.method.state").value("LISTED"));
        mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.method.code=='TIME')]").isNotEmpty());
    }

    @Test
    void refusesToDeleteACodeReferencedByHistoryAndPreservesItsSnapshot() throws Exception {
        var admin = signIn("ADMIN");
        var owner = signIn("USER");
        UUID history = UUID.randomUUID();
        mvc.perform(admin.send(post(ADMIN), metadata("OTHER", false).put("code", CODE))).andExpect(status().isCreated());
        db.update("""
                INSERT INTO account_history(id,owner_id,calculation_request_id,calculation_type,title,created_at,rule_basis,result_snapshot)
                VALUES (?,?,?,'MAI_HOA','TEST',clock_timestamp(),'SOURCE_VERIFIED',?::jsonb)
                """, history, owner.id(), UUID.randomUUID(), json.createObjectNode().put("method", CODE).toString());
        mvc.perform(admin.send(delete(ENTRY), version(1))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("METHOD_IN_USE"));
        assertEquals(CODE, db.queryForObject("SELECT result_snapshot->>'method' FROM account_history WHERE id=?",
                String.class, history));
        mvc.perform(get(ENTRY).cookie(admin.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.method.version").value(1));
    }

    private ObjectNode metadata(String group, boolean listed) {
        return json.createObjectNode().put("group", group).put("listed", listed).put("name", "Phương pháp kiểm thử")
                .put("summary", "Mô tả ngắn").put("introduction", "Giới thiệu").put("instructions", "Bước 1\nBước 2")
                .put("requiredInput", "Dữ kiện kiểm thử");
    }

    private ObjectNode version(int version) {
        return json.createObjectNode().put("expectedVersion", version);
    }

    private Session signIn(String role) {
        String identifier = "method-" + UUID.randomUUID();
        String password = UUID.randomUUID().toString();
        UUID id = accounts.register("Catalog TEST", identifier, password, null).account().id();
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
