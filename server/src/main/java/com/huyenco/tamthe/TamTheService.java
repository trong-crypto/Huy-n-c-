package com.huyenco.tamthe;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.RuleNotAvailableException;
import org.springframework.stereotype.Service;

@Service
public class TamTheService {
    public Object calculate(JsonNode payload) {
        // TV3 chỉ triển khai sau khi quy tắc trong docs/05-TAMTHE-RULES.md đạt VERIFIED.
        throw new RuleNotAvailableException("TT-NGU-HANH");
    }
}

