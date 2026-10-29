package com.huyenco.history;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import com.huyenco.common.dto.*;
import com.huyenco.websocket.CalculationSessions;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HistorySecurityTest {
    static final ObjectMapper MAPPER=new ObjectMapper().findAndRegisterModules();
    static class Time extends Clock {
        Instant now=Instant.parse("2026-10-25T00:00:00Z");
        public java.time.ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return this;}
        public Instant instant(){return now;}
    }
    final Time time=new Time();
    HistoryStore store;
    SessionService sessions;
    CompletedResults cache;
    MockMvc mvc;
    final Map<String,HistoryStore.Owner> owners=new HashMap<>();
    @BeforeEach void setup() {
        store=mock(HistoryStore.class);
        when(store.create(anyString(),any(),any())).thenAnswer(a->{var owner=new HistoryStore.Owner(UUID.randomUUID(),a.getArgument(2));owners.put(a.getArgument(0),owner);return owner;});
        when(store.owner(anyString(),any())).thenAnswer(a->{var owner=owners.get(a.getArgument(0));return owner!=null&&owner.expiresAt().isAfter(a.getArgument(1))?Optional.of(owner):Optional.empty();});
        when(store.byRequest(any(),any())).thenReturn(Optional.empty());
        sessions=new SessionService(store,time);cache=new CompletedResults(MAPPER,time,900,10,1000000);
        mvc=MockMvcBuilders.standaloneSetup(new HistoryController(sessions,store,cache,new RequestGuards("http://localhost:3000"),MAPPER,time,1000,false)).build();
    }
    SessionService.Session session() {return sessions.bootstrap(new MockHttpServletRequest());}
    static MaiHoaResult result() throws Exception {
        return MAPPER.treeToValue(MAPPER.readTree(Path.of("../docs/examples/mai-hoa-lines.response.json").toFile()).get("data"),MaiHoaResult.class);
    }
    static String saveBody(UUID id){return "{\"calculationRequestId\":\""+id+"\"}";}
    static Cookie cookie(SessionService.Session s){return new Cookie(SessionService.COOKIE,s.token());}

    @Test void bootstrapCreatesOpaqueHttpOnlyCookieAndKeepsStableCsrfWithoutLeakingOwner()throws Exception {
        var response=mvc.perform(post("/api/v1/session").header("X-HuyenCo-Request","1").contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.data.ownerId").doesNotExist()).andExpect(jsonPath("$.data.token").doesNotExist()).andReturn().getResponse();
        String setCookie=response.getHeader("Set-Cookie");assertNotNull(setCookie);
        assertTrue(setCookie.contains("HttpOnly"));assertTrue(setCookie.contains("SameSite=Lax"));assertTrue(setCookie.contains("Path=/"));
        String raw=setCookie.split(";",2)[0].split("=",2)[1];assertEquals(43,raw.length());
        assertTrue(owners.containsKey(SessionService.hash(raw)));assertFalse(owners.containsKey(raw));
        String csrf=MAPPER.readTree(response.getContentAsByteArray()).path("data").path("csrfToken").asText();
        mvc.perform(post("/api/v1/session").header("X-HuyenCo-Request","1").cookie(new Cookie(SessionService.COOKIE,raw))
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.csrfToken").value(csrf));
        time.now=time.now.plus(Duration.ofDays(30));
        mvc.perform(get("/api/v1/history").cookie(new Cookie(SessionService.COOKIE,raw))).andExpect(status().isUnauthorized());
    }

    @Test void missingForgedDuplicateCookiesAndBadOriginsAreRejected()throws Exception {
        var own=session();
        mvc.perform(get("/api/v1/history")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/history").cookie(new Cookie(SessionService.COOKIE,"A".repeat(43)))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/history").cookie(cookie(own),cookie(own))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/session").contentType("application/json").content("{}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/session").header("X-HuyenCo-Request","1").header("Origin","https://evil.example").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/history").cookie(cookie(own)).header("X-HuyenCo-Request","1").contentType("application/json").content(saveBody(UUID.randomUUID())))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/history/"+UUID.randomUUID()).cookie(cookie(own)).header("X-HuyenCo-Request","1").header("X-CSRF-Token","wrong"))
                .andExpect(status().isForbidden());
    }

    @Test void strictJsonAndNoCallerChosenOwnerOrSnapshot()throws Exception {
        for(String json:List.of("[]","{}{}","{\"a\":1}","{\"x\":1,\"x\":2}","x".repeat(16001)))
            mvc.perform(post("/api/v1/session").header("X-HuyenCo-Request","1").contentType("application/json").content(json)).andExpect(status().isBadRequest());
        var own=session();
        for(String json:List.of("{}","{\"calculationRequestId\":null}","{\"ownerId\":\"spoof\"}","{\"result\":{}}",saveBody(UUID.randomUUID()).replace("}",",\"title\":null}")))
            mvc.perform(post("/api/v1/history").cookie(cookie(own)).header("X-HuyenCo-Request","1").header("X-CSRF-Token",own.csrfToken())
                    .contentType("application/json").content(json)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/history").cookie(cookie(own)).header("X-HuyenCo-Request","1").header("X-CSRF-Token",own.csrfToken())
                .contentType("application/json").content(saveBody(UUID.randomUUID()))).andExpect(status().isNotFound());
    }

    @Test void completedResultScopeExpiryBoundsAndConflict()throws Exception {
        var a=session();var b=session();UUID id=UUID.randomUUID();
        cache.capture(a.owner(),id.toString(),"MAI_HOA",result());
        assertTrue(cache.find(a.owner().id(),id).isPresent());assertTrue(cache.find(b.owner().id(),id).isEmpty());
        assertFalse(cache.find(a.owner().id(),id).orElseThrow().json().contains("question"));
        assertFalse(cache.find(a.owner().id(),id).orElseThrow().json().contains("birthDate"));
        time.now=time.now.plusSeconds(900);assertTrue(cache.find(a.owner().id(),id).isEmpty());
        var bounded=new CompletedResults(MAPPER,time,900,1,1000000);
        bounded.capture(a.owner(),id.toString(),"MAI_HOA",result());UUID second=UUID.randomUUID();
        bounded.capture(a.owner(),second.toString(),"MAI_HOA",result());assertEquals(1,bounded.size());assertTrue(bounded.find(a.owner().id(),id).isEmpty());
        var changed=MAPPER.valueToTree(result());((com.fasterxml.jackson.databind.node.ObjectNode)changed).put("movingLine",3);
        bounded.capture(a.owner(),second.toString(),"MAI_HOA",MAPPER.treeToValue(changed,MaiHoaResult.class));
        assertThrows(com.huyenco.common.exception.ContractException.class,()->bounded.find(a.owner().id(),second));
    }

    @Test void resultCapturedOnlyForSuccessfulOwnedTerminalAndSurvivesDisconnect()throws Exception {
        var a=session();UUID good=UUID.randomUUID(),bad=UUID.randomUUID();
        try(var runs=new CalculationSessions(mock(SimpMessagingTemplate.class),10000,10,10,10)) {
            runs.historyResults(cache);runs.connect("A",a.owner());
            runs.start("A",good.toString(),"MAI_HOA").complete(result());
            var failed=runs.start("A",bad.toString(),"MAI_HOA");failed.fail("INVALID_INPUT","bad");failed.complete(result());
            runs.disconnect("A");
            assertTrue(cache.find(a.owner().id(),good).isPresent());assertTrue(cache.find(a.owner().id(),bad).isEmpty());
        }
    }

    @Test void parametersAndCrossOwnerMissUseSafeEnvelope()throws Exception {
        var own=session();
        for(String query:List.of("size=0","size=101","page=-1","page=2147483648","type=BAD","q="+"a".repeat(101),"ownerId=spoof","page=1&page=2"))
            mvc.perform(get("/api/v1/history?"+query).cookie(cookie(own))).andExpect(status().isBadRequest());
        when(store.detail(any(),any())).thenReturn(Optional.empty());
        mvc.perform(get("/api/v1/history/"+UUID.randomUUID()).cookie(cookie(own))).andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        when(store.detail(any(),any())).thenThrow(new com.huyenco.knowledge.KnowledgeAccessException());
        mvc.perform(get("/api/v1/history/"+UUID.randomUUID()).cookie(cookie(own))).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("DATABASE_UNAVAILABLE"));
    }

    @Test void handshakeOwnershipOnlyComesFromValidatedCookie()throws Exception {
        var own=session();
        var handshake=new HistoryHandshakeInterceptor(sessions,new RequestGuards("http://localhost:3000"));
        var request=new MockHttpServletRequest();request.setCookies(cookie(own));request.addHeader("Origin","http://localhost:3000");
        var attributes=new HashMap<String,Object>();
        var response=new org.springframework.mock.web.MockHttpServletResponse();
        assertTrue(handshake.beforeHandshake(new org.springframework.http.server.ServletServerHttpRequest(request),
                new org.springframework.http.server.ServletServerHttpResponse(response),new org.springframework.web.socket.handler.TextWebSocketHandler(),attributes));
        assertEquals(own.owner(),attributes.get(SessionService.WS_OWNER));
        request.setCookies(new Cookie(SessionService.COOKIE,"A".repeat(43)));attributes.clear();
        assertFalse(handshake.beforeHandshake(new org.springframework.http.server.ServletServerHttpRequest(request),
                new org.springframework.http.server.ServletServerHttpResponse(response),new org.springframework.web.socket.handler.TextWebSocketHandler(),attributes));
        assertEquals(401,response.getStatus());assertTrue(attributes.isEmpty());
    }
}
