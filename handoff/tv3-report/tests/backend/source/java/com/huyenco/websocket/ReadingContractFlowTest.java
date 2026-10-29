package com.huyenco.websocket;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.maihoa.MaiHoaService;
import com.huyenco.tamthe.TamTheService;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class ReadingContractFlowTest {
    JsonNode fixture(String name) throws Exception {
        return CalculationFlowTest.MAPPER.readTree(Path.of("../docs/examples/m02-"+name).toFile());
    }
    @Test void realServicesEmitUnavailableFixturesAfterValidationOnTheOwningSession() throws Exception {
        var capture=new CalculationFlowTest.Capture();
        try(var sessions=new CalculationSessions(new SimpMessagingTemplate(capture),60000,10,10,5);
            var dispatcher=new CalculationDispatcher(sessions)) {
            sessions.connect("A");sessions.connect("B");
            var app=new CalculationController(sessions,CalculationFlowTest.MAPPER,
                    new MaiHoaService(null,null,null,null),new TamTheService(null,null,null),dispatcher);
            for(String name:List.of("lines-reading","object-reading","time-reading","wealth-extended")) {
                var request=fixture(name+".request.json");
                var message=CalculationFlowTest.request(request.toString());
                if(request.get("type").asText().equals("MAI_HOA")) app.calculateMaiHoa(message,"A");
                else app.calculateTamThe(message,"A");
                assertEquals(fixture(name+"-unavailable.response.json"),
                        CalculationFlowTest.MAPPER.valueToTree(capture.terminal().get(capture.terminal().size()-1)));
            }
            assertEquals(4,capture.terminal().size());
            assertEquals(8,capture.progress().size()); // Accepted + validating only; no pretend calculation/lookup.
            assertTrue(capture.frames.stream().allMatch(m->"A".equals(m.getHeaders().get("simpSessionId"))));
            assertEquals(0,sessions.activeCount());
        }
    }
    @Test void fingerprintIncludesTopicContextPresenceAndWealthModeWithoutChangingN01() throws Exception {
        var capture=new CalculationFlowTest.Capture();var calls=new AtomicInteger();
        try(var sessions=new CalculationSessions(new SimpMessagingTemplate(capture),60000,10,10,5);
            var dispatcher=new CalculationDispatcher(sessions)) {
            sessions.connect("A");sessions.connect("B");
            var service=CalculationFlowTest.service((payload,progress)->{
                calls.incrementAndGet();throw new RuleNotAvailableException("MH-DETAILED-READING");
            });
            var app=new CalculationController(sessions,CalculationFlowTest.MAPPER,service,new TamTheService(null,null,null),dispatcher);
            var request=(ObjectNode)fixture("lines-reading.request.json");
            app.calculateMaiHoa(CalculationFlowTest.request(request.toString()),"A");
            app.calculateMaiHoa(CalculationFlowTest.request(request.toString()),"A");
            assertEquals(1,calls.get());assertEquals(capture.terminal().get(0),capture.terminal().get(1));
            var topic=request.deepCopy();((ObjectNode)topic.at("/payload/reading")).put("topic","CAREER");
            app.calculateMaiHoa(CalculationFlowTest.request(topic.toString()),"A");
            var context=request.deepCopy();((ObjectNode)context.at("/payload/reading/context")).put("datetime","2024-02-10T10:00:00+07:00");
            app.calculateMaiHoa(CalculationFlowTest.request(context.toString()),"A");
            var legacy=request.deepCopy();((ObjectNode)legacy.get("payload")).remove("reading");
            app.calculateMaiHoa(CalculationFlowTest.request(legacy.toString()),"A");
            assertEquals(1,calls.get());
            for(int i=2;i<5;i++) assertEquals("INVALID_INPUT",capture.terminal().get(i).error().code());
            app.calculateMaiHoa(CalculationFlowTest.request(request.toString()),"B");assertEquals(2,calls.get());
            var wealth=(ObjectNode)fixture("wealth-extended.request.json");
            app.calculateTamThe(CalculationFlowTest.request(wealth.toString()),"A");
            ((ObjectNode)wealth.get("payload")).put("wealthMode","LEGACY");
            app.calculateTamThe(CalculationFlowTest.request(wealth.toString()),"A");
            assertEquals("INVALID_INPUT",capture.terminal().get(7).error().code());
        }
    }
}
