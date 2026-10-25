package com.huyenco.hexagram;

import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.KnowledgeAccessException;
import com.huyenco.knowledge.KnowledgeDataException;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value="/api/v1/hexagrams", produces="application/json")
public class HexagramController {
    private final HexagramLookupService service;
    public HexagramController(HexagramLookupService service) { this.service = service; }

    @GetMapping
    public ResponseEntity<Result> list(@RequestParam MultiValueMap<String, String> query) {
        return handle(() -> {
            validate(query, Set.of("q", "upperTrigramCode", "lowerTrigramCode", "page", "size"));
            return service.list(query.getFirst("q") == null ? "" : query.getFirst("q"),
                    query.getFirst("upperTrigramCode"), query.getFirst("lowerTrigramCode"),
                    number(query.getFirst("page"), 0), number(query.getFirst("size"), 20));
        });
    }

    @GetMapping("/{code}")
    public ResponseEntity<Result> detail(@PathVariable String code, @RequestParam MultiValueMap<String, String> query) {
        return handle(() -> { validate(query, Set.of()); return service.detail(code); });
    }

    private static void validate(MultiValueMap<String, String> query, Set<String> fields) {
        if (!fields.containsAll(query.keySet()) || query.values().stream().anyMatch(v -> v.size() != 1))
            throw HexagramLookupService.invalid();
    }
    private static int number(String value, int fallback) {
        if (value == null) return fallback;
        if (!value.matches("[0-9]{1,10}")) throw HexagramLookupService.invalid();
        try { return Integer.parseInt(value); }
        catch (NumberFormatException failure) { throw HexagramLookupService.invalid(); }
    }
    private static ResponseEntity<Result> handle(Supplier<Object> action) {
        String id = UUID.randomUUID().toString();
        try { return ResponseEntity.ok(new Result(id, "COMPLETED", action.get(), null)); }
        catch (ContractException failure) {
            return fail(id, "NOT_FOUND".equals(failure.code()) ? 404 : 400, failure.code(), failure.getMessage());
        } catch (KnowledgeAccessException failure) {
            return fail(id, 503, "DATABASE_UNAVAILABLE", "Kho dữ liệu tạm thời không truy cập được.");
        } catch (KnowledgeDataException failure) {
            return fail(id, 503, "KNOWLEDGE_DATA_INCOMPLETE", "Dữ liệu tra cứu quẻ chưa đầy đủ hoặc không nhất quán.");
        } catch (RuntimeException failure) {
            return fail(id, 500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu tra cứu quẻ.");
        }
    }
    private static ResponseEntity<Result> fail(String id, int http, String code, String message) {
        return ResponseEntity.status(http).body(new Result(id, "FAILED", null, new ApiError(code, message, null, null)));
    }
    public record Result(String requestId, String status, Object data, ApiError error) { }
}
