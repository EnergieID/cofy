import { describe, expect, it } from "vitest";

import { formatDuration, parseDuration } from "../../../../src/components/form/schema/duration.js";

describe("parseDuration", () => {
  it("reads a whole number of one unit, telling minutes from months by the T", () => {
    expect(parseDuration("PT15M")).toEqual({ amount: 15, unit: "minutes" });
    expect(parseDuration("P3M")).toEqual({ amount: 3, unit: "months" });
    expect(parseDuration("P1D")).toEqual({ amount: 1, unit: "days" });
    expect(parseDuration("P2W")).toEqual({ amount: 2, unit: "weeks" });
    expect(parseDuration("P1Y")).toEqual({ amount: 1, unit: "years" });
    expect(parseDuration("PT1H")).toEqual({ amount: 1, unit: "hours" });
    expect(parseDuration("PT30S")).toEqual({ amount: 30, unit: "seconds" });
  });

  it("gives nothing for several units, a fraction, or what is not a duration", () => {
    expect(parseDuration("P1DT2H")).toBeUndefined();
    expect(parseDuration("PT1.5H")).toBeUndefined();
    expect(parseDuration("15 minutes")).toBeUndefined();
    expect(parseDuration("")).toBeUndefined();
  });
});

describe("formatDuration", () => {
  it("writes a date unit before the T and a time unit after it", () => {
    expect(formatDuration({ amount: 15, unit: "minutes" })).toBe("PT15M");
    expect(formatDuration({ amount: 3, unit: "months" })).toBe("P3M");
    expect(formatDuration({ amount: 0, unit: "seconds" })).toBe("PT0S");
  });
});
