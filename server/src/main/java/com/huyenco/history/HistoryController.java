package com.huyenco.history;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.KnowledgeAccessException;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value="/api/v1",produces="application/json")
public class HistoryController {
    private final SessionService sessions;
    private final HistoryStore store;
    private final CompletedResults results;
    private final RequestGuards guards;
    private final ObjectReader reader;
    private final Clock clock;
    private final int maxHistory;
    private final boolean secureCookie;
    public HistoryController(SessionService sessions,HistoryStore store,CompletedResults results,RequestGuards guards,
            ObjectMapper mapper,Clock clock,@Value("${huyenco.history-max-per-owner:1000}") int limit,
            @Value("${huyenco.session-secure-cookie:false}") boolean secureCookie) {
        if(limit<1)throw new IllegalArgumentException("Invalid history limit");
        this.sessions=sessions;this.store=store;this.results=results;this.guards=guards;this.clock=clock;
        this.maxHistory=limit;this.secureCookie=secureCookie;
        reader=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readerFor(JsonNode.class)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @PostMapping("/session")
    public ResponseEntity<Envelope> bootstrap(HttpServletRequest request,@RequestParam MultiValueMap<String,String> query) {
        return handle(()->{
            fields(query,Set.of());guards.mutation(request);body(request,Set.of());
            var session=sessions.bootstrap(request);
            var headers=HttpHeaders.EMPTY;
            if(session.created()) {
                headers=new HttpHeaders();
                headers.add(HttpHeaders.SET_COOKIE,ResponseCookie.from(SessionService.COOKIE,session.token())
                        .httpOnly(true).secure(secureCookie||request.isSecure()).sameSite("Lax").path("/")
                        .maxAge(SessionService.LIFETIME).build().toString());
            }
            return response(200,new SessionResult(session.owner().expiresAt().toString(),session.csrfToken()),headers);
        });
    }

    @PostMapping("/history")
    public ResponseEntity<Envelope> save(HttpServletRequest request,@RequestParam MultiValueMap<String,String> query) {
        return handle(()->{
            fields(query,Set.of());guards.mutation(request);
            var owner=sessions.require(request);sessions.checkCsrf(request);
            var json=body(request,Set.of("calculationRequestId","title"));
            if(!json.path("calculationRequestId").isTextual())throw invalid();
            UUID requestId=uuid(json.get("calculationRequestId").textValue());
            String title=null;
            if(json.has("title")) {
                if(!json.get("title").isTextual())throw invalid();
                title=json.get("title").textValue().strip();
                if(title.isEmpty()||title.length()>100||title.codePoints().anyMatch(Character::isISOControl))throw invalid();
            }
            var pending=results.find(owner.id(),requestId);
            var existing=store.byRequest(owner.id(),requestId);
            if(existing.isPresent())return response(201,existing.get(),HttpHeaders.EMPTY);
            var result=pending.orElseThrow(SessionService::missing);
            if(title==null)title=result.type().equals("MAI_HOA")?"Kết quả Mai Hoa":"Luận giải Tam Thế";
            return response(201,store.save(owner,requestId,result,title,clock.instant(),maxHistory),HttpHeaders.EMPTY);
        });
    }

    @GetMapping("/history")
    public ResponseEntity<Envelope> list(HttpServletRequest request,@RequestParam MultiValueMap<String,String> query) {
        return handle(()->{
            guards.origin(request);var owner=sessions.require(request);
            fields(query,Set.of("q","type","page","size"));
            String q=query.getFirst("q"),type=query.getFirst("type");if(q==null)q="";
            if(q.length()>100 || (type!=null&&!Set.of("MAI_HOA","TAM_THE").contains(type)))throw invalid();
            int page=number(query.getFirst("page"),0),size=number(query.getFirst("size"),20);
            if(size<1||size>100)throw invalid();
            return response(200,store.list(owner.id(),q.strip(),type,page,size),HttpHeaders.EMPTY);
        });
    }
    @GetMapping("/history/{id}")
    public ResponseEntity<Envelope> detail(@PathVariable String id,HttpServletRequest request,@RequestParam MultiValueMap<String,String> query) {
        return handle(()->{
            guards.origin(request);var owner=sessions.require(request);fields(query,Set.of());
            return response(200,store.detail(owner.id(),uuid(id)).orElseThrow(SessionService::missing),HttpHeaders.EMPTY);
        });
    }
    @DeleteMapping("/history/{id}")
    public ResponseEntity<Envelope> delete(@PathVariable String id,HttpServletRequest request,@RequestParam MultiValueMap<String,String> query) {
        return handle(()->{
            guards.mutation(request);var owner=sessions.require(request);sessions.checkCsrf(request);fields(query,Set.of());
            if(!store.delete(owner.id(),uuid(id)))throw SessionService.missing();
            return response(200,Map.of("deleted",true),HttpHeaders.EMPTY);
        });
    }

    private JsonNode body(HttpServletRequest request,Set<String> fields) {
        try {
            if(request.getContentType()==null || !MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(request.getContentType())))throw invalid();
            byte[] bytes=request.getInputStream().readNBytes(16001);
            if(bytes.length==0||bytes.length>16000)throw invalid();
            JsonNode json=reader.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
            if(json==null||!json.isObject())throw invalid();
            json.fieldNames().forEachRemaining(key->{if(!fields.contains(key))throw invalid();});
            return json;
        } catch(Exception failure){throw invalid();}
    }
    private static UUID uuid(String value) {
        try {var id=UUID.fromString(value);if(!id.toString().equalsIgnoreCase(value))throw invalid();return id;}
        catch(RuntimeException failure){throw invalid();}
    }
    private static int number(String value,int defaultValue) {
        if(value==null)return defaultValue;
        if(!value.matches("[0-9]{1,10}"))throw invalid();
        try{return Integer.parseInt(value);}catch(NumberFormatException failure){throw invalid();}
    }
    private static void fields(MultiValueMap<String,String> query,Set<String> allowed) {
        if(!allowed.containsAll(query.keySet())||query.values().stream().anyMatch(v->v.size()!=1))throw invalid();
    }
    private static ContractException invalid(){return SessionService.invalid("Dữ liệu phiên/lịch sử không hợp lệ.");}
    private static ResponseEntity<Envelope> response(int http,Object data,HttpHeaders headers) {
        return ResponseEntity.status(http).headers(headers).cacheControl(CacheControl.noStore())
                .body(new Envelope(UUID.randomUUID().toString(),"COMPLETED",data,null));
    }
    private static ResponseEntity<Envelope> handle(Supplier<ResponseEntity<Envelope>> action) {
        try{return action.get();}
        catch(ContractException failure) {
            int http=switch(failure.code()){case "INVALID_SESSION"->401;case "CSRF_REJECTED"->403;case "NOT_FOUND"->404;default->400;};
            return failed(http,failure.code(),failure.getMessage());
        } catch(KnowledgeAccessException failure){return failed(503,"DATABASE_UNAVAILABLE","Không thể truy cập kho phiên/lịch sử.");}
        catch(RuntimeException failure){return failed(500,"INTERNAL_ERROR","Không thể xử lý yêu cầu phiên/lịch sử.");}
    }
    private static ResponseEntity<Envelope> failed(int http,String code,String message) {
        return ResponseEntity.status(http).cacheControl(CacheControl.noStore()).body(new Envelope(UUID.randomUUID().toString(),
                "FAILED",null,new ApiError(code,message,null,null)));
    }
    public record Envelope(String requestId,String status,Object data,ApiError error) { }
    public record SessionResult(String expiresAt,String csrfToken) { }
}
