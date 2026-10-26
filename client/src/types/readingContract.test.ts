import { describe, expect, it } from "vitest";
import { isCalculationResponse } from "./contractValidation";
import noSeason from "../../../docs/examples/m02-detailed-no-season.schema.response.json";
import seasonal from "../../../docs/examples/m02-detailed-season.schema.response.json";
import matched from "../../../docs/examples/m02-wealth-matched.schema.response.json";
import noLoc from "../../../docs/examples/m02-wealth-no-loc.schema.response.json";
import unavailable from "../../../docs/examples/m02-lines-reading-unavailable.response.json";
import extendedUnavailable from "../../../docs/examples/m02-wealth-extended-unavailable.response.json";
import legacyMaiHoa from "../../../docs/examples/mai-hoa-lines.response.json";
import legacyTamThe from "../../../docs/examples/tam-the-wealth.response.json";

describe("M02 additive contract (schema examples are not service acceptance)", () => {
  it.each([noSeason, seasonal, matched, noLoc, unavailable, extendedUnavailable, legacyMaiHoa, legacyTamThe])(
    "accepts a typed new/legacy fixture", value => expect(isCalculationResponse(value)).toBe(true));

  const badMaiHoa: [string, (v: typeof noSeason) => void][] = [
    ["explicit null reading", v => { (v.data as Record<string, unknown>).detailedReading = null; }],
    ["missing phases", v => { v.data.detailedReading.phases.length = 3; }],
    ["wrong phase order", v => { v.data.detailedReading.phases[0].kind = "FINAL_USE"; }],
    ["unknown relation", v => { v.data.detailedReading.phases[0].relation = "LUCK_SCORE"; }],
    ["team decision presented as source text", v => { v.data.detailedReading.phases[0].ruleBasis = "TEAM_DECISION"; }],
    ["draft content", v => { v.data.detailedReading.phases[0].sourceStatus = "DRAFT"; }],
    ["missing source hash", v => { v.data.detailedReading.phases[0].sourceReferences[0].sha256 = "bad"; }],
    ["hidden convention limitation", v => { v.data.detailedReading.calculationDecisions[0].limitation = ""; }],
    ["season guessed without context", v => { (v.data.detailedReading.season as Record<string, unknown>).bodyStrength = "VIGOROUS"; }],
    ["same role sides", v => { v.data.detailedReading.use.side = v.data.detailedReading.body.side; }],
  ];
  it.each(badMaiHoa)("rejects %s", (_name, mutate) => {
    const value = structuredClone(noSeason); mutate(value); expect(isCalculationResponse(value)).toBe(false);
  });
  it("requires evaluated season context and its own sources", () => {
    const value = structuredClone(seasonal);
    value.data.detailedReading.season.sourceReferences = [];
    expect(isCalculationResponse(value)).toBe(false);
  });
  const badWealth: [string, (v: typeof noLoc) => void][] = [
    ["missing bundle", v => { delete (v.data as Record<string, unknown>).bundleId; }],
    ["missing mode", v => { delete (v.data as Record<string, unknown>).coverageMode; }],
    ["reordered subreadings", v => { v.data.categories[0].subreadings.reverse(); }],
    ["wrong rule identity", v => { v.data.categories[0].subreadings[1].ruleCode = "TT-TAI-LOC"; }],
    ["missing Sang hen content", v => { v.data.categories[0].subreadings[1].entries = []; }],
    ["missing Loc reason", v => { v.data.categories[0].subreadings[0].reason = ""; }],
    ["flat entries differ", v => { v.data.categories[0].entries[0].content = "changed"; }],
    ["wrong entry label", v => { v.data.categories[0].subreadings[1].entries[0].subreadingCode = "LOC"; }],
    ["hidden editorial decisions", v => { v.data.editorialDecisions = []; }],
  ];
  it.each(badWealth)("rejects %s", (_name, mutate) => {
    const value = structuredClone(noLoc); mutate(value); expect(isCalculationResponse(value)).toBe(false);
  });
});
