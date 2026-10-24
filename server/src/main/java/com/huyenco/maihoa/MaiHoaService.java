package com.huyenco.maihoa;

import com.fasterxml.jackson.databind.JsonNode;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.common.dto.CalculationStep;
import com.huyenco.common.dto.CalculationProgress;
import com.huyenco.common.dto.ProgressEvent.Step;
import com.huyenco.common.dto.EvidenceSummary;
import com.huyenco.common.dto.MaiHoaResult;
import com.huyenco.common.validation.ContractValidator;
import com.huyenco.knowledge.HexagramIndex;
import com.huyenco.knowledge.HexagramRepository;
import com.huyenco.knowledge.TrigramRepository;
import com.huyenco.knowledge.TrigramIndex;
import com.huyenco.knowledge.RulePurpose;
import com.huyenco.knowledge.RuleRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class MaiHoaService {
    private final RuleRegistry registry;
    private final HexagramRepository hexagrams;
    private final TrigramRepository trigrams;

    public MaiHoaService(RuleRegistry registry, HexagramRepository hexagrams) {
        this(registry, hexagrams, java.util.List::of);
    }

    @Autowired
    public MaiHoaService(RuleRegistry registry, HexagramRepository hexagrams, TrigramRepository trigrams) {
        this.registry = registry;
        this.hexagrams = hexagrams;
        this.trigrams = trigrams;
    }

    public MaiHoaResult calculate(JsonNode payload) {
        return calculate(payload, CalculationProgress.NONE);
    }

    public MaiHoaResult calculate(JsonNode payload, CalculationProgress progress) {
        ContractValidator.validateMaiHoa(payload);
        String method = payload.path("method").asText();
        if ("LINES".equals(method) || "OBJECT_COUNT".equals(method)) {
            boolean objectCount = "OBJECT_COUNT".equals(method);
            var evidence = EvidenceSummary.from(registry.authorizeAll(
                    objectCount ? List.of("MH-OBJECT-COUNT", "MH-TRIGRAM", "MH-MUTUAL", "MH-CHANGE")
                            : List.of("MH-MUTUAL", "MH-CHANGE"), RulePurpose.CALCULATION));
            // Source gates run before any data read or CALCULATING event.
            var trigramIndex = objectCount ? new TrigramIndex(trigrams.trigrams()) : null;
            var input = new ArrayList<Boolean>();
            var steps = new ArrayList<CalculationStep>();
            int movingLine;
            progress.report(Step.CALCULATING, "Đang tính quẻ chủ, quẻ hỗ và quẻ biến.");
            if (objectCount) {
                int count = payload.get("objectCount").intValue(), hour = payload.get("hourIndex").intValue();
                var numbers = MaiHoaNumbers.fromObjectCount(count, hour);
                input.addAll(trigramIndex.find(numbers.lowerTrigram()).linesBottomUp());
                input.addAll(trigramIndex.find(numbers.upperTrigram()).linesBottomUp());
                movingLine = numbers.movingLine();
                steps.add(new CalculationStep("OBJECT_COUNT_NUMBERS",
                        "Số vật lấy thượng quái, chỉ số giờ lấy hạ quái; tổng số gốc chia 6 lấy hào theo quy ước nhóm.",
                        Map.of("objectCount", count, "hourIndex", hour, "movingLineSum", count + hour,
                                "upperTrigram", numbers.upperTrigram(), "lowerTrigram", numbers.lowerTrigram(),
                                "movingLine", movingLine)));
            } else {
                payload.get("linesBottomUp").forEach(line -> input.add(line.booleanValue()));
                movingLine = payload.get("movingLine").intValue();
            }
            var calculation = MaiHoaLines.calculate(input, movingLine);
            progress.report(Step.LOOKUP, "Đang tra mã quẻ và tên đã duyệt trong dữ liệu nguồn.");
            var records = hexagrams.hexagrams();
            var index = new HexagramIndex(records);
            if (trigramIndex != null) trigramIndex.validateHexagrams(records);
            steps.addAll(List.of(
                    new CalculationStep("MUTUAL", "Hỗ hạ lấy hào 2–4; hỗ thượng lấy hào 3–5.",
                            Map.of("lowerLineStart", 2, "upperLineStart", 3)),
                    new CalculationStep("CHANGE", "Đảo duy nhất hào động tính từ dưới lên.",
                            Map.of("movingLine", calculation.movingLine()))));
            return MaiHoaResult.of(method, evidence, steps,
                    index.find(calculation.primary()).toCalculationView(),
                    index.find(calculation.mutual()).toCalculationView(),
                    index.find(calculation.changed()).toCalculationView(), calculation.movingLine(), null);
        }
        // Remaining methods are deliberately closed until their separate tasks are complete.
        throw new RuleNotAvailableException(switch (method) {
            case "TIME" -> "MH-TIME";
            case "OBJECT_COUNT" -> "MH-OBJECT-COUNT";
            default -> "MH-UNKNOWN";
        });
    }
}

