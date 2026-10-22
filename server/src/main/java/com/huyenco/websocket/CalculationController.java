package com.huyenco.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.dto.ApiResponse;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.maihoa.MaiHoaService;
import com.huyenco.tamthe.TamTheService;
import java.util.function.Supplier;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class CalculationController {
    private final SimpMessagingTemplate messages;
    private final MaiHoaService maiHoa;
    private final TamTheService tamThe;

    public CalculationController(SimpMessagingTemplate messages, MaiHoaService maiHoa, TamTheService tamThe) {
        this.messages = messages;
        this.maiHoa = maiHoa;
        this.tamThe = tamThe;
    }

    @MessageMapping("/mai-hoa/calculate")
    public void calculateMaiHoa(@Payload JsonNode request, @Header("simpSessionId") String sessionId) {
        process(request, sessionId, "MAI_HOA", () -> maiHoa.calculate(request.get("payload")));
    }

    @MessageMapping("/tam-the/calculate")
    public void calculateTamThe(@Payload JsonNode request, @Header("simpSessionId") String sessionId) {
        process(request, sessionId, "TAM_THE", () -> tamThe.calculate(request.get("payload")));
    }

    private void process(JsonNode request, String sessionId, String type, Supplier<Object> calculation) {
        String requestId = request != null && request.path("requestId").isTextual()
                ? request.path("requestId").asText() : null;
        try {
            ContractValidator.validate(request, type);
            send(sessionId, "/queue/results", ApiResponse.completed(requestId, type, calculation.get()));
        } catch (ContractException ex) {
            send(sessionId, "/queue/errors", ApiResponse.failed(requestId, type, ex.code(), ex.getMessage()));
        } catch (RuleNotAvailableException ex) {
            send(sessionId, "/queue/errors", ApiResponse.failed(requestId, type, "RULE_NOT_AVAILABLE", ex.getMessage(), ex.ruleCode()));
        } catch (Exception ex) {
            send(sessionId, "/queue/errors", ApiResponse.failed(requestId, type, "INTERNAL_ERROR", "Không thể xử lý yêu cầu."));
        }
    }

    private void send(String sessionId, String destination, ApiResponse response) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(sessionId);
        headers.setLeaveMutable(true);
        messages.convertAndSendToUser(sessionId, destination, response, headers.getMessageHeaders());
    }
}

