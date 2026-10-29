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

    @Test
    void rejectsIntegerOverflowInsteadOfTruncatingToValidInput() throws Exception {
        for (String payload : new String[] {
                "{\"method\":\"OBJECT_COUNT\",\"objectCount\":18446744073709551617,\"hourIndex\":8}",
                "{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":4294967297}",
                "{\"method\":\"LINES\",\"linesBottomUp\":[true,false,true,false,true,false],\"movingLine\":4294967297}"
        }) {
            assertEquals("INVALID_INPUT", assertThrows(ContractException.class,
                    () -> ContractValidator.validate(request(payload), "MAI_HOA")).code());
        }
    }

    @Test
    void validatesTamTheCategoriesAndCanonicalUuid() throws Exception {
        String base = "{\"requestId\":\"" + REQUEST_ID + "\",\"type\":\"TAM_THE\",\"payload\":{"
                + "\"birthDate\":\"2003-08-15\",\"birthTime\":\"08:30\",\"calendarType\":\"SOLAR\",\"isLeapMonth\":false";
        assertDoesNotThrow(() -> ContractValidator.validate(MAPPER.readTree(base + ",\"categories\":[\"CAREER\"]}}"), "TAM_THE"));
        for (String categories : new String[] {"[]", "[\"CAREER\",\"CAREER\"]", "[\"OTHER\"]", "null"}) {
            assertThrows(ContractException.class, () -> ContractValidator.validate(
                    MAPPER.readTree(base + ",\"categories\":" + categories + "}}"), "TAM_THE"));
        }
        JsonNode shortUuid = MAPPER.readTree("{\"requestId\":\"1-1-1-1-1\",\"type\":\"MAI_HOA\","
                + "\"payload\":{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":8}}");
        assertThrows(ContractException.class, () -> ContractValidator.validate(shortUuid, "MAI_HOA"));
    }

    @Test
    void rejectsClientSuppliedPolicyAndUnknownPayloadFields() throws Exception {
        assertThrows(ContractException.class, () -> ContractValidator.validate(request(
                "{\"method\":\"OBJECT_COUNT\",\"objectCount\":12,\"hourIndex\":8,\"executionPolicy\":\"TEAM_DECISION\"}"), "MAI_HOA"));
        assertThrows(ContractException.class, () -> ContractValidator.validate(request(
                "{\"method\":\"LINES\",\"linesBottomUp\":[true,false,true,false,true,false],\"movingLine\":2,\"question\":\"not allowed\"}"), "MAI_HOA"));
    }

    private static JsonNode request(String payload) throws Exception {
        return MAPPER.readTree("{\"requestId\":\"" + REQUEST_ID
                + "\",\"type\":\"MAI_HOA\",\"payload\":" + payload + "}");
    }
}
