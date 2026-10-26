package com.huyenco.common.dto;

import com.huyenco.knowledge.RuleBasis;
import com.huyenco.knowledge.SourceStatus;
import java.time.OffsetDateTime;
import java.util.List;
import static com.huyenco.common.dto.ReadingContracts.*;

public record DetailedReading(String schemaVersion, String bundleId, MaiHoaReadingOptions.Topic topic,
                              TextKind textKind, TrigramRole body, TrigramRole use, List<Phase> phases,
                              SeasonReading season, String summary, List<ReadingDecision> calculationDecisions,
                              List<SourceReference> sourceReferences) {
    public enum TextKind { EDITORIAL_PARAPHRASE }
    public enum Side { UPPER, LOWER }
    public enum Trigram { CAN, DOAI, LY, CHAN, TON, KHAM, CAN2, KHON }
    public enum Element { KIM, MOC, THUY, HOA, THO }
    public enum Relation { SAME_ELEMENT, USE_GENERATES_BODY, BODY_GENERATES_USE, BODY_CONTROLS_USE, USE_CONTROLS_BODY }
    public enum PhaseKind { INITIAL_USE, MIDDLE_BODY_MUTUAL, MIDDLE_USE_MUTUAL, FINAL_USE }
    public enum Season { SPRING, SUMMER, AUTUMN, WINTER, EARTH_MONTH }
    public enum Strength { VIGOROUS, WEAK, UNCLASSIFIED }
    public enum SeasonStatus { EVALUATED, NOT_EVALUATED }
    public enum SeasonReason { MISSING_READING_TIME }

    public DetailedReading {
        require("1.0".equals(schemaVersion) && text(bundleId) && topic != null && textKind != null
                && body != null && use != null && body.side() != use.side() && season != null && text(summary),
                "Incomplete detailed reading");
        require(phases != null && phases.size() == 4, "Four ordered reading phases required");
        phases = List.copyOf(phases);
        for (int i = 0; i < 4; i++) require(phases.get(i).kind() == PhaseKind.values()[i], "Wrong reading phase order");
        require(calculationDecisions != null && !calculationDecisions.isEmpty()
                && calculationDecisions.stream().allMatch(d -> d != null && d.purpose() == ReadingDecision.Purpose.CALCULATION),
                "Body/phase calculation conventions must remain explicit");
        calculationDecisions = List.copyOf(calculationDecisions);
        sourceReferences = sources(sourceReferences);
    }
    public record TrigramRole(Side side, Trigram trigramCode, Element element) {
        public TrigramRole { require(side != null && trigramCode != null && element != null, "Trigram role required"); }
    }
    public record Phase(PhaseKind kind, TrigramRole comparator, Relation relation, String templateCode,
                        String content, TextKind textKind, RuleBasis ruleBasis, SourceStatus sourceStatus,
                        List<SourceReference> sourceReferences) {
        public Phase {
            require(kind != null && comparator != null && relation != null && text(templateCode) && text(content)
                    && textKind != null && ruleBasis == RuleBasis.SOURCE_VERIFIED && sourceStatus == SourceStatus.VERIFIED,
                    "Reading text requires verified source evidence");
            sourceReferences = sources(sourceReferences);
        }
    }
    public record SeasonReading(SeasonStatus status, SeasonReason reason, String datetime, LunarDate lunarDate,
                                Season season, Strength bodyStrength, List<SourceReference> sourceReferences) {
        public SeasonReading {
            require(status != null, "Season status required");
            if (status == SeasonStatus.NOT_EVALUATED) {
                require(reason == SeasonReason.MISSING_READING_TIME && datetime == null && lunarDate == null
                        && season == null && bodyStrength == null && sourceReferences != null && sourceReferences.isEmpty(),
                        "Missing reading context cannot imply a season or strength");
                sourceReferences = List.of();
            } else {
                require(reason == null && text(datetime) && lunarDate != null && season != null && bodyStrength != null,
                        "Evaluated season requires explicit date and calendar");
                var local = OffsetDateTime.parse(datetime).withOffsetSameInstant(java.time.ZoneOffset.ofHours(7)).toLocalDate();
                require(local.getYear() >= 1900 && local.getYear() <= 2099 && lunarDate.month() >= 1
                        && lunarDate.month() <= 12 && lunarDate.day() >= 1 && lunarDate.day() <= 30, "Invalid season date");
                sourceReferences = sources(sourceReferences);
            }
        }
    }
}
