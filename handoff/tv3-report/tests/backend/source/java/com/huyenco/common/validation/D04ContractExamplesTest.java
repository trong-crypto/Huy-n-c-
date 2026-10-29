package com.huyenco.common.validation;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.dto.*;
import com.huyenco.knowledge.*;
import java.nio.file.Path;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class D04ContractExamplesTest {
    final ObjectMapper mapper=new ObjectMapper();
    @ParameterizedTest @ValueSource(strings={"wealth-matched","wealth-no-loc","label-aliases","leap-lunar","solar-equivalent"})
    void realCapturedServiceResultsPreserveContractAndReviewedSupplementText(String name) throws Exception {
        var request=mapper.readTree(Path.of("../docs/examples/d04-"+name+".request.json").toFile());
        ContractValidator.validate(request,"TAM_THE");
        var response=mapper.readTree(Path.of("../docs/examples/d04-"+name+".response.json").toFile());
        assertEquals(request.get("requestId"),response.get("requestId"));assertEquals("COMPLETED",response.path("status").asText());
        var data=response.get("data");var result=mapper.treeToValue(data,TamTheResult.class);
        assertEquals(data,mapper.valueToTree(result));assertEquals(TamTheResult.WealthMode.EXTENDED,result.coverageMode());
        var document=ReadingTestFixtures.snapshot().bundle().document();
        var wealth=result.categories().stream().filter(c->c.category()==TamTheCategory.WEALTH).findFirst().orElseThrow();
        assertEquals(wealth.entries(),wealth.subreadings().stream().flatMap(s->s.entries().stream()).toList());
        for(var sub:wealth.subreadings().subList(1,3)) {
            var entry=sub.entries().get(0);var source=document.path("tamTheResults").valueStream()
                    .filter(row->row.path("code").asText().equals(entry.resultCode())).findFirst().orElseThrow();
            assertEquals(source.path("title").asText(),entry.title());assertEquals(source.path("content").asText(),entry.content());
            assertEquals(source.path("decisionIds").valueStream().map(row->row.asText()).toList(),sub.decisionReferences().stream().map(ReadingDecision::decisionId).toList());
            assertTrue(result.editorialDecisions().containsAll(sub.decisionReferences()));
        }
    }
}
