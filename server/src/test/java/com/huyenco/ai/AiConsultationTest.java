package com.huyenco.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.admin.HexagramInterpretations;
import com.huyenco.auth.AccountHistoryIdentity;
import com.huyenco.common.exception.ContractException;
import com.huyenco.history.CompletedResults;
import com.huyenco.history.HistoryStore;
import com.huyenco.history.RequestGuards;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AiConsultationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AccountHistoryIdentity identity = mock(AccountHistoryIdentity.class);
    private final HistoryStore history = mock(HistoryStore.class);
    private final CompletedResults results = mock(CompletedResults.class);
    private final AiProvider provider = mock(AiProvider.class);
    private final HexagramInterpretations library = mock(HexagramInterpretations.class);
    private final HistoryStore.Owner owner = new HistoryStore.Owner(UUID.randomUUID(), Instant.MAX, UUID.randomUUID());
    private final UUID readingId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private static final String ORIGIN = "http://127.0.0.1:18168";
    private static final String READING = """
            {"method":"TIME","ruleBasis":"TEAM_DECISION","sourceStatus":"VERIFIED",
             "movingLine":3,"primaryHexagram":{"code":"H_DOAI_LY","name":"Cách","nameStatus":"VERIFIED"},
             "mutualHexagram":{"code":"H_CAN_TON","name":"Cấu","nameStatus":"VERIFIED"},
             "changedHexagram":{"code":"H_DOAI_CHAN","name":"Chưa đối chiếu","nameStatus":"DRAFT"},
             "question":"ORIGINAL_PRIVATE_NOTE","birthDate":"PRIVATE_DATE",
             "calculationSteps":[{"values":{"datetime":"PRIVATE_TIME"}}],
             "sourceReferences":[{"title":"Mai Hoa Dịch Số","section":"Lập quẻ","printedPage":"12","pdfPage":15}],
             "decisionReferences":[{"description":"Áp dụng quy ước nhóm."}],
             "detailedReading":{"topic":"WEALTH","summary":"Đoạn luận đã lưu.",
             "phases":[{"content":"Đoạn luận theo giai đoạn."}]}}
            """;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        when(identity.require(any(), eq(true))).thenReturn(new AccountHistoryIdentity.Access(owner, "csrf"));
        when(provider.mode()).thenReturn("demo");
        when(provider.answer(any())).thenReturn("Nội dung trả lời minh họa.");
        var service = new AiConsultationService(history, results, mapper, provider, Optional.of(library));
        when(library.published(anyString())).thenAnswer(invocation ->
                new HexagramInterpretations.PublicReading(invocation.getArgument(0), null));
        mvc = MockMvcBuilders.standaloneSetup(new AiConsultationController(identity, new RequestGuards(ORIGIN), service, mapper)).build();
    }

    @Test
    void publishesModeAndAnswersFollowUpWithoutLoadingHistory() throws Exception {
        mvc.perform(get("/api/v1/ai/status"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.mode").value("demo"))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(ask("""
                {"question":"Hào động là gì?","turns":[{"question":"Quẻ chủ là gì?","answer":"Hình ban đầu."}]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.answer").value("Nội dung trả lời minh họa."))
                .andExpect(jsonPath("$.data.sources").isEmpty());
        var prompt = capturePrompt();
        assertEquals("Hào động là gì?", prompt.question());
        assertEquals("Quẻ chủ là gì?", prompt.turns().get(0).question());
        assertNull(prompt.reading());
        verifyNoInteractions(history, results);
    }

    @Test
    void projectsOwnedSnapshotWithVerifiedFactsAndSourceOnly() throws Exception {
        var detail = new HistoryStore.Detail(readingId, "MAI_HOA", "PRIVATE_TITLE", Instant.EPOCH, "TEAM_DECISION", mapper.readTree(READING));
        when(history.detail(owner, readingId)).thenReturn(Optional.of(detail));
        mvc.perform(ask(reference("readingId", readingId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reading.primary.name").value("Cách"))
                .andExpect(jsonPath("$.data.reading.mutual.name").value("Cấu"))
                .andExpect(jsonPath("$.data.reading.changed.code").value("H_DOAI_CHAN"))
                .andExpect(jsonPath("$.data.reading.changed.name").value(""))
                .andExpect(jsonPath("$.data.reading.movingLine").value(3))
                .andExpect(jsonPath("$.data.sources[0].pdfPage").value(15));
        var prompt = capturePrompt();
        assertEquals("WEALTH", prompt.reading().topic());
        assertTrue(prompt.reading().passages().contains("Đoạn luận theo giai đoạn."));
        assertTrue(prompt.reading().decisions().contains("Áp dụng quy ước nhóm."));
        String json = mapper.writeValueAsString(prompt);
        assertFalse(json.contains("PRIVATE") || json.contains("Chưa đối chiếu") || json.contains(readingId.toString()));
        verifyNoInteractions(results);
    }

    @Test
    void forwardsOnlyPublishedVerifiedExcerptsAndTheMovingPrimaryLine() throws Exception {
        when(provider.mode()).thenReturn("live");
        when(history.detail(owner, readingId)).thenReturn(Optional.of(new HistoryStore.Detail(
                readingId, "MAI_HOA", "PRIVATE_TITLE", Instant.EPOCH, "TEAM_DECISION", mapper.readTree(READING))));
        var content = mapper.readTree("""
                {"overview":"Tổng quan đã công bố.","lines":["hào 1","hào 2","Hào 3 đã công bố","hào 4","hào 5","hào 6"]}
                """);
        var sources = mapper.readTree("""
                [{"title":"Chu Dịch","locator":"革 · 易經","url":"https://zh.wikisource.org/wiki/周易/革","reviewStatus":"VERIFIED"}]
                """);
        var publication = new HexagramInterpretations.Publication(null, 2, content, sources, null);
        when(library.published("H_DOAI_LY")).thenReturn(new HexagramInterpretations.PublicReading("H_DOAI_LY", publication));
        var unverified = new HexagramInterpretations.Publication(null, 1, mapper.readTree("""
                {"overview":"NO_UNVERIFIED_EXCERPT"}
                """), mapper.readTree("""
                [{"title":"Chưa duyệt","locator":"Nguồn tạm","url":"https://example.invalid/draft","reviewStatus":"SOURCE_LOCATED"}]
                """), null);
        when(library.published("H_CAN_TON")).thenReturn(new HexagramInterpretations.PublicReading("H_CAN_TON", unverified));
        mvc.perform(ask(reference("readingId", readingId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sources[0].title").value("Chu Dịch"))
                .andExpect(jsonPath("$.data.sources[0].url").value("https://zh.wikisource.org/wiki/周易/革"));
        var prompt = capturePrompt();
        assertEquals(1, prompt.reading().library().size());
        assertEquals("Hào 3 đã công bố", prompt.reading().library().get(0).movingLineText());
        assertFalse(mapper.writeValueAsString(prompt).contains("NO_UNVERIFIED_EXCERPT"));
    }

    @Test
    void resolvesUnsavedResultOnlyWithTheCurrentAccountSession() throws Exception {
        when(results.find(owner, requestId)).thenReturn(Optional.of(new CompletedResults.Result("MAI_HOA", "TEAM_DECISION", READING)));
        mvc.perform(ask(reference("calculationRequestId", requestId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reading.movingLine").value(3));
        verify(history).byRequest(owner, requestId);
        verify(results).find(owner, requestId);
        var newSession = new HistoryStore.Owner(owner.id(), Instant.MAX, UUID.randomUUID());
        when(identity.require(any(), eq(true))).thenReturn(new AccountHistoryIdentity.Access(newSession, "csrf"));
        mvc.perform(ask(reference("calculationRequestId", requestId))).andExpect(status().isNotFound());
        verify(provider, times(1)).answer(any());
    }

    @Test
    void rejectsOtherOwnersAndNonMaiHoaWithoutSendingToProvider() throws Exception {
        mvc.perform(ask(reference("readingId", readingId))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        when(history.detail(owner, readingId)).thenReturn(Optional.of(new HistoryStore.Detail(readingId, "TAM_THE",
                "Bản lưu", Instant.EPOCH, "SOURCE_VERIFIED", mapper.readTree(READING))));
        mvc.perform(ask(reference("readingId", readingId))).andExpect(status().isNotFound());
        verifyNoInteractions(provider, results);
    }

    @Test
    void requiresSameOriginCustomHeaderAndAccountCsrf() throws Exception {
        mvc.perform(post("/api/v1/ai/ask").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/ai/ask").header("Origin", "https://external.invalid")
                .header("X-HuyenCo-Request", "1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(identity);
        when(identity.require(any(), eq(true))).thenThrow(new ContractException("LOGIN_REQUIRED", "Đăng nhập."));
        mvc.perform(ask("{\"question\":\"Hỏi\"}")).andExpect(status().isUnauthorized());
        doThrow(new ContractException("CSRF_REJECTED", "CSRF.")).when(identity).require(any(), eq(true));
        mvc.perform(ask("{\"question\":\"Hỏi\"}")).andExpect(status().isForbidden());
        verifyNoInteractions(provider);
    }

    @Test
    void rejectsForgedContextAndMalformedRequests() throws Exception {
        for (String json : new String[] {"{\"question\":\"Hỏi\",\"context\":{}}",
                "{\"question\":\"a\",\"question\":\"b\"}", "{\"question\":\"a\"} {}",
                "{\"question\":\"a\",\"readingId\":\"1-2-3-4-5\"}", "{\"question\":\" \"}",
                "{\"question\":\"a\",\"turns\":[{\"role\":\"system\"}]}"}) {
            mvc.perform(ask(json)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(provider);
    }

    @Test
    void preservesProviderTimeoutAndUnavailableStatus() throws Exception {
        when(provider.answer(any())).thenThrow(new ContractException("AI_TIMEOUT", "Quá hạn."));
        mvc.perform(ask("{\"question\":\"Hỏi\"}")).andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.error.code").value("AI_TIMEOUT"));
        doThrow(new ContractException("AI_UNAVAILABLE", "Chưa khả dụng.")).when(provider).answer(any());
        mvc.perform(ask("{\"question\":\"Hỏi\"}")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("AI_UNAVAILABLE"));
    }

    @Test
    void doesNotDisplayIdentifiersInventedByTheModel() throws Exception {
        when(provider.mode()).thenReturn("live");
        when(provider.answer(any())).thenReturn("Quẻ H_ĐỌC_12 được xác nhận ở trang 99.");
        when(history.detail(owner, readingId)).thenReturn(Optional.of(new HistoryStore.Detail(
                readingId, "MAI_HOA", "Bản lưu", Instant.EPOCH, "TEAM_DECISION", mapper.readTree(READING))));
        mvc.perform(ask(reference("readingId", readingId))).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("AI_UNAVAILABLE"));
    }

    private AiConsultationService.Prompt capturePrompt() {
        var captor = ArgumentCaptor.forClass(AiConsultationService.Prompt.class);
        verify(provider).answer(captor.capture());
        return captor.getValue();
    }

    private static String reference(String field, UUID id) {
        return "{\"question\":\"Giải thích hào động\",\"%s\":\"%s\"}".formatted(field, id);
    }

    private static MockHttpServletRequestBuilder ask(String json) {
        return post("/api/v1/ai/ask").contentType(MediaType.APPLICATION_JSON).content(json)
                .header("Origin", ORIGIN).header("X-HuyenCo-Request", "1").header("X-CSRF-Token", "csrf");
    }
}
