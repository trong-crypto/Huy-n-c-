package com.huyenco.common.validation;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.common.dto.*;
import com.huyenco.common.exception.*;
import com.huyenco.maihoa.MaiHoaService;
import com.huyenco.tamthe.TamTheService;
import java.nio.file.Path;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ReadingContractTest {
    static final ObjectMapper MAPPER = new ObjectMapper();
    static JsonNode fixture(String name) throws Exception {
        return MAPPER.readTree(Path.of("../docs/examples/" + name).toFile());
    }
    ObjectNode payload() throws Exception { return (ObjectNode)fixture("m02-lines-reading.request.json").get("payload"); }

    @ParameterizedTest
    @ValueSource(strings={"lines-reading","object-reading","time-reading","wealth-extended","wealth-legacy"})
    void newRequestsPassTheRealValidator(String name) throws Exception {
        var input=fixture("m02-"+name+".request.json");
        ContractValidator.validate(input,input.get("type").asText());
        if (input.get("payload").has("reading")) {
            var options=MAPPER.treeToValue(input.get("payload").get("reading"),MaiHoaReadingOptions.class);
            assertEquals(input.get("payload").get("reading"),MAPPER.valueToTree(options));
        }
    }

    record BadInput(String name, Consumer<ObjectNode> mutate, String code) { }
    @TestFactory Stream<DynamicTest> invalidReadingInputCannotOverrideServerPolicy() {
        return Stream.of(
            new BadInput("null reading",p->p.putNull("reading"),"INVALID_INPUT"),
            new BadInput("array reading",p->p.putArray("reading"),"INVALID_INPUT"),
            new BadInput("missing topic",p->((ObjectNode)p.get("reading")).remove("topic"),"INVALID_INPUT"),
            new BadInput("unknown topic",p->((ObjectNode)p.get("reading")).put("topic","HEALTH"),"INVALID_INPUT"),
            new BadInput("client basis",p->((ObjectNode)p.get("reading")).put("ruleBasis","SOURCE_VERIFIED"),"INVALID_INPUT"),
            new BadInput("client body",p->((ObjectNode)p.get("reading")).put("bodySide","LOWER"),"INVALID_INPUT"),
            new BadInput("null context",p->((ObjectNode)p.get("reading")).putNull("context"),"INVALID_INPUT"),
            new BadInput("empty context",p->((ObjectNode)p.get("reading")).set("context",MAPPER.createObjectNode()),"INVALID_INPUT"),
            new BadInput("extra context field",p->((ObjectNode)p.at("/reading/context")).put("season","SPRING"),"INVALID_INPUT"),
            new BadInput("no offset",p->((ObjectNode)p.at("/reading/context")).put("datetime","2024-02-10T09:00:00"),"INVALID_DATE"),
            new BadInput("invalid day",p->((ObjectNode)p.at("/reading/context")).put("datetime","2024-02-30T09:00:00+07:00"),"INVALID_DATE"),
            new BadInput("before UTC7 lower bound",p->((ObjectNode)p.at("/reading/context")).put("datetime","1899-12-31T16:59:59Z"),"INVALID_DATE"),
            new BadInput("after UTC7 upper bound",p->((ObjectNode)p.at("/reading/context")).put("datetime","2099-12-31T17:00:00Z"),"INVALID_DATE")
        ).map(test->DynamicTest.dynamicTest(test.name(),()->{
            var p=payload();test.mutate().accept(p);
            assertEquals(test.code(),assertThrows(ContractException.class,()->ContractValidator.validateMaiHoa(p)).code());
        }));
    }
    @Test void boundaryOffsetsAndMissingContextAreAcceptedWithoutGuessingAMachineTime() throws Exception {
        for(String value:List.of("1899-12-31T17:00:00Z","2099-12-31T16:59:59Z")) {
            var p=payload();((ObjectNode)p.at("/reading/context")).put("datetime",value);
            assertDoesNotThrow(()->ContractValidator.validateMaiHoa(p));
        }
        var p=payload();((ObjectNode)p.get("reading")).remove("context");
        assertDoesNotThrow(()->ContractValidator.validateMaiHoa(p));
    }
    @Test void timeRejectsASecondContextAndWealthModeMustBeExplicitAndApplicable() throws Exception {
        var time=(ObjectNode)fixture("m02-time-reading.request.json").get("payload");
        ((ObjectNode)time.get("reading")).putNull("context");
        assertThrows(ContractException.class,()->ContractValidator.validateMaiHoa(time));
        var p=(ObjectNode)fixture("m02-wealth-extended.request.json").get("payload");
        p.putArray("categories").add("CAREER");
        assertThrows(ContractException.class,()->ContractValidator.validateTamThe(p));
        p.remove("categories");assertDoesNotThrow(()->ContractValidator.validateTamThe(p));
        for(String mode:List.of("extended","UNKNOWN","")) {
            p.put("wealthMode",mode);assertThrows(ContractException.class,()->ContractValidator.validateTamThe(p));
        }
        p.putNull("wealthMode");assertThrows(ContractException.class,()->ContractValidator.validateTamThe(p));
    }
    @ParameterizedTest @ValueSource(strings={"detailed-no-season","detailed-season","wealth-matched","wealth-no-loc"})
    void schemaOnlyExamplesRoundTripWithoutBeingClaimedAsRuntimeResults(String name) throws Exception {
        var response=fixture("m02-"+name+".schema.response.json");var data=response.get("data");
        Object result=response.get("type").asText().equals("MAI_HOA")
                ? MAPPER.treeToValue(data,MaiHoaResult.class) : MAPPER.treeToValue(data,TamTheResult.class);
        assertEquals(data,MAPPER.valueToTree(result));
        if (result instanceof MaiHoaResult mh) {
            assertThrows(UnsupportedOperationException.class,()->mh.detailedReading().phases().clear());
        } else if (result instanceof TamTheResult tt) {
            assertThrows(UnsupportedOperationException.class,()->tt.categories().get(0).subreadings().clear());
        }
    }
    @Test void unsafeOrIncompleteOutputEvidenceIsRejectedByDtos() throws Exception {
        var original=(ObjectNode)fixture("m02-detailed-no-season.schema.response.json").get("data");
        for(Consumer<ObjectNode> mutate:List.<Consumer<ObjectNode>>of(
                d->((ObjectNode)d.at("/detailedReading/phases/0")).put("ruleBasis","TEAM_DECISION"),
                d->((ObjectNode)d.at("/detailedReading/phases/0")).put("sourceStatus","DRAFT"),
                d->((ObjectNode)d.at("/detailedReading/phases/0/sourceReferences/0")).put("sha256","bad"),
                d->((ObjectNode)d.at("/detailedReading/phases/0")).put("kind","FINAL_USE"),
                d->((ObjectNode)d.at("/detailedReading/calculationDecisions/0")).put("limitation",""),
                d->((ObjectNode)d.at("/detailedReading/season")).put("bodyStrength","VIGOROUS"))) {
            var data=original.deepCopy();mutate.accept(data);
            assertThrows(IllegalArgumentException.class,()->MAPPER.convertValue(data,MaiHoaResult.class));
        }
        var wealth=(ObjectNode)fixture("m02-wealth-no-loc.schema.response.json").get("data");
        for(Consumer<ObjectNode> mutate:List.<Consumer<ObjectNode>>of(
                d->d.remove("coverageMode"),d->d.remove("bundleId"),
                d->((ObjectNode)d.at("/categories/0/subreadings/1")).put("status","NO_SOURCE_MATCH"),
                d->((ObjectNode)d.at("/categories/0/entries/0")).put("content","hidden replacement"))) {
            var data=wealth.deepCopy();mutate.accept(data);
            assertThrows(IllegalArgumentException.class,()->MAPPER.convertValue(data,TamTheResult.class));
        }
    }
    @Test void serviceGatesDoNotReadDatabaseOrReturnLegacySuccessForOptIn() throws Exception {
        var mh=new MaiHoaService(null,null,null,null);
        var tt=new TamTheService(null,null,null);
        for(String name:List.of("lines-reading","object-reading","time-reading")) {
            var p=fixture("m02-"+name+".request.json").get("payload");
            var error=assertThrows(RuleNotAvailableException.class,()->mh.calculate(p));
            assertEquals("MH-DETAILED-READING",error.ruleCode());
            assertEquals(RuleUnavailableReason.IMPLEMENTATION_UNAVAILABLE,error.reason());
        }
        var p=fixture("m02-wealth-extended.request.json").get("payload");
        assertEquals("TT-WEALTH-EXTENDED",assertThrows(RuleNotAvailableException.class,()->tt.calculate(p)).ruleCode());
    }
}
