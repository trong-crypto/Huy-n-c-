package com.huyenco.maihoa;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.RuleNotAvailableException;
import org.springframework.stereotype.Service;

@Service
public class MaiHoaService {
    public Object calculate(JsonNode payload) {
        // TV2 chỉ triển khai sau khi quy tắc trong docs/04-MAIHOA-RULES.md đạt VERIFIED.
        String method = payload.path("method").asText();
        throw new RuleNotAvailableException(switch (method) {
            case "TIME" -> "MH-TIME";
            case "OBJECT_COUNT" -> "MH-OBJECT-COUNT";
            case "LINES" -> "MH-MUTUAL";
            default -> "MH-UNKNOWN";
        });
    }
}

