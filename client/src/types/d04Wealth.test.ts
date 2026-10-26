import { expect, it } from "vitest";
import { isCalculationResponse } from "./contractValidation";
import { parseTerminal } from "../services/websocket/calculationState";
import matched from "../../../docs/examples/d04-wealth-matched.response.json";
import missing from "../../../docs/examples/d04-wealth-no-loc.response.json";
import aliases from "../../../docs/examples/d04-label-aliases.response.json";
import lunar from "../../../docs/examples/d04-leap-lunar.response.json";
import solar from "../../../docs/examples/d04-solar-equivalent.response.json";

it.each([matched, missing, aliases, lunar, solar])("accepts a real captured D04 result without flattening away its source scope", response => {
  expect(isCalculationResponse(response)).toBe(true);
  expect(parseTerminal(response)).toEqual(response);
  expect(response.data.coverageMode).toBe("EXTENDED");
  const wealth = response.data.categories.find(c => c.category === "WEALTH")!;
  expect(wealth.subreadings?.map(s => s.code)).toEqual(["LOC", "SANG_HEN", "DIEN_SAN"]);
  expect(wealth.entries).toEqual(wealth.subreadings?.flatMap(s => s.entries));
  expect(response.data.editorialDecisions.every(d => d.ruleBasis === "TEAM_DECISION")).toBe(true);
});

it("keeps all categories when Loc has no printed intersection", () => {
  expect(missing.data.categories.map(c => c.category)).toEqual(["CAREER", "WEALTH", "LOVE"]);
  const wealth = missing.data.categories.find(c => c.category === "WEALTH")!;
  expect(wealth.subreadings?.[0]).toMatchObject({ code: "LOC", status: "NO_SOURCE_MATCH", entries: [], reason: "NO_PRINTED_INTERSECTION" });
  expect(wealth.entries).toHaveLength(2);
});

it("retains label conflicts and returns the same content for equivalent solar and leap-lunar dates", () => {
  const wealth = matched.data.categories.find(c => c.category === "WEALTH")!;
  expect(wealth.subreadings?.[2].entries[0].title).toBe("Phú / Phá");
  expect(wealth.subreadings?.[2].decisionReferences).toHaveLength(2);
  expect(lunar.data).toEqual(solar.data);
});
