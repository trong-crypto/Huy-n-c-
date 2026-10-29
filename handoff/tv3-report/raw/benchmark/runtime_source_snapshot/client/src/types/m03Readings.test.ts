import { expect, it } from "vitest";
import { isCalculationResponse } from "./contractValidation";
import { parseTerminal } from "../services/websocket/calculationState";
import lines from "../../../docs/examples/m03-lines-reading.response.json";
import count from "../../../docs/examples/m03-object-reading.response.json";
import time from "../../../docs/examples/m03-time-reading.response.json";
import seasonal from "../../../docs/examples/m03-lines-season.response.json";

it.each([lines, count, time, seasonal])("accepts a real captured M03 result through the shared response/state parser", response => {
  expect(isCalculationResponse(response)).toBe(true);
  expect(parseTerminal(response)).toEqual(response);
  expect(response.data.detailedReading.phases).toHaveLength(4);
  expect(response.data.detailedReading.phases.every(p => p.sourceStatus === "VERIFIED")).toBe(true);
  expect(response.data.ruleBasis).toBe("TEAM_DECISION");
});
