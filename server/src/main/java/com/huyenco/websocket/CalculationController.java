package com.huyenco.websocket;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.common.dto.ApiResponse;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.maihoa.MaiHoaService;
import com.huyenco.tamthe.TamTheService;
import com.huyenco.knowledge.KnowledgeAccessException;
import com.huyenco.knowledge.KnowledgeDataException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class CalculationController {
    private final CalculationSessions sessions;
    private final CalculationDispatcher dispatcher;
    private final ObjectReader json;
    private final MaiHoaService maiHoa;
    private final TamTheService tamThe;

    @Autowired
    public CalculationController(CalculationSessions sessions, ObjectMapper mapper, MaiHoaService maiHoa,
            TamTheService tamThe, CalculationDispatcher dispatcher) {
        this.sessions = sessions;
        this.dispatcher = dispatcher;
        this.json = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        this.maiHoa = maiHoa;
        this.tamThe = tamThe;
    }

    /** Compatibility constructor for direct-mode controller tests. */
    CalculationController(CalculationSessions sessions, ObjectMapper mapper, MaiHoaService maiHoa, TamTheService tamThe) {
        this(sessions, mapper, maiHoa, tamThe, new CalculationDispatcher(sessions));
    }

    @MessageMapping("/mai-hoa/calculate")
    public void calculateMaiHoa(Message<byte[]> request, @Header("simpSessionId") String sessionId) {
        process(request.getPayload(), sessionId, "MAI_HOA");
    }

    @MessageMapping("/tam-the/calculate")
    public void calculateTamThe(Message<byte[]> request, @Header("simpSessionId") String sessionId) {
        process(request.getPayload(), sessionId, "TAM_THE");
    }

    private void process(byte[] bytes, String sessionId, String type) {
        JsonNode request;
        try {
            if (bytes.length > 16_000) throw new IOException("Input limit");
            // Decode strictly as the UTF-8 wire contract; Jackson's byte parser also accepts UTF-16/32.
            request = json.readValue(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString());
        } catch (IOException | RuntimeException failure) {
            sessions.send(sessionId, "/queue/errors", ApiResponse.failed(null, type, "INVALID_INPUT", "JSON không hợp lệ hoặc quá dài."));
            return;
        }
        String requestId = correlationId(request);
        dispatcher.dispatch(sessionId, requestId, type, request, run -> calculate(request, type, run));
    }

    private void calculate(JsonNode request, String type, CalculationSessions.Run run) {
        try {
            run.report(Step.ACCEPTED, "Server đã nhận yêu cầu.");
            run.report(Step.VALIDATING, "Đang kiểm tra đầu vào và điều kiện nguồn.");
            ContractValidator.validate(request, type);
            Object result = "MAI_HOA".equals(type) ? maiHoa.calculate(request.get("payload"), run)
                    : tamThe.calculate(request.get("payload"), run);
            run.complete(result);
        } catch (CalculationSessions.Stopped ignored) {
            // The deadline/disconnect already ended this request. Never send another terminal result.
        } catch (ContractException ex) {
            run.fail(ex.code(), ex.getMessage());
        } catch (RuleNotAvailableException ex) {
            run.fail("RULE_NOT_AVAILABLE", ex.getMessage(), ex.ruleCode(), ex.reason().name());
        } catch (KnowledgeDataException ex) {
            run.fail("KNOWLEDGE_DATA_INCOMPLETE", ex.getMessage());
        } catch (KnowledgeAccessException ex) {
            run.fail("DATABASE_UNAVAILABLE", "Không thể truy cập dữ liệu tri thức.");
        } catch (Exception ex) {
            run.fail("INTERNAL_ERROR", "Không thể xử lý yêu cầu.");
        } finally {
            run.cancel();
        }
    }

    private static String correlationId(JsonNode request) {
        if (request == null || !request.path("requestId").isTextual()) return null;
        String id = request.path("requestId").textValue();
        try { return UUID.fromString(id).toString().equalsIgnoreCase(id) ? id : null; }
        catch (IllegalArgumentException failure) { return null; }
    }
}

