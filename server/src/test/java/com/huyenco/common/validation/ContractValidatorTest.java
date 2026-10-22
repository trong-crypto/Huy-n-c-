package com.huyenco.common.validation;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.exception.ContractException;
import org.junit.jupiter.api.Test;

class ContractValidatorTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String REQUEST_ID = "550e8400-e29b-41d4-a716-446655440002";

    @Test
    void acceptsObjectCountContract() throws Exception {
        assertDoesNotThrow(() -> ContractValidator.validate(request(
                "{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":8}"), "MAI_HOA"));
    }

    @Test
    void rejectsOldNumberMethodAndOutOfRangeHour() throws Exception {
        ContractException oldMethod = assertThrows(ContractException.class,
                () -> ContractValidator.validate(request(
                        "{\"method\":\"NUMBER\",\"numbers\":[12,25]}"), "MAI_HOA"));
        assertEquals("INVALID_METHOD", oldMethod.code());

        ContractException hour = assertThrows(ContractException.class,
                () -> ContractValidator.validate(request(
                        "{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":13}"), "MAI_HOA"));
        assertEquals("INVALID_INPUT", hour.code());
    }

    private static JsonNode request(String payload) throws Exception {
        return MAPPER.readTree("{\"requestId\":\"" + REQUEST_ID
                + "\",\"type\":\"MAI_HOA\",\"payload\":" + payload + "}");
    }
}
