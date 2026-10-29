package com.huyenco.common.validation;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.*;
import com.huyenco.knowledge.*;
import java.nio.file.Path;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class M03ContractExamplesTest {
    final ObjectMapper mapper=new ObjectMapper();
    @ParameterizedTest @ValueSource(strings={"lines-reading","object-reading","time-reading","lines-season"})
    void realCapturedRequestsAndResponsesFollowJavaContractAndPinnedText(String name) throws Exception {
        var request=mapper.readTree(Path.of("../docs/examples/m03-"+name+".request.json").toFile());
        ContractValidator.validate(request,"MAI_HOA");
        var response=mapper.readTree(Path.of("../docs/examples/m03-"+name+".response.json").toFile());
        assertEquals(request.get("requestId"),response.get("requestId"));
        var data=response.get("data");var result=mapper.treeToValue(data,MaiHoaResult.class);
        assertEquals(data,mapper.valueToTree(result));
        assertEquals(RuleBasis.TEAM_DECISION,result.ruleBasis());assertEquals(SourceStatus.SOURCE_AMBIGUOUS,result.sourceStatus());
        var rows=ReadingTestFixtures.snapshot().templates();
        for(var phase:result.detailedReading().phases()) assertEquals(
                rows.stream().filter(r->r.code().equals(phase.templateCode())).findFirst().orElseThrow().content(),phase.content());
        assertTrue(result.calculationSteps().stream().anyMatch(s->s.code().equals("READING_BODY_USE")));
        assertTrue(result.detailedReading().sourceReferences().stream().allMatch(SourceReference::hasTraceableLocation));
    }
}
