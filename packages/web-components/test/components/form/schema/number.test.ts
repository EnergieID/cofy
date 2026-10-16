import { describe, expect, it } from "vitest";

import { numberLimits, seedNumber } from "../../../../src/components/form/schema/number.js";

describe("numberLimits", () => {
  it("takes an inclusive range as it is", () => {
    expect(numberLimits({ type: "number", minimum: 0, maximum: 100 })).toEqual({ min: 0, max: 100, step: "any" });
  });

  it("steps an integer by one, and a decimal number by any amount", () => {
    expect(numberLimits({ type: "integer" }).step).toBe(1);
    expect(numberLimits({ type: "number" }).step).toBe("any");
  });

  it("steps by multipleOf where there is one", () => {
    expect(numberLimits({ type: "number", multipleOf: 0.25 }).step).toBe(0.25);
  });

  it("turns an exclusive bound into an inclusive one a step further in, where there is a step", () => {
    expect(numberLimits({ type: "integer", exclusiveMinimum: 0, exclusiveMaximum: 10 })).toEqual({ min: 1, max: 9, step: 1 });
    expect(numberLimits({ type: "number", multipleOf: 0.5, exclusiveMinimum: 1 }).min).toBe(1.5);
  });

  it("leaves an exclusive bound to the validator where there is no step to turn it into an inclusive one", () => {
    expect(numberLimits({ type: "number", exclusiveMinimum: 0 })).toEqual({ min: undefined, max: undefined, step: "any" });
  });
});

describe("seedNumber", () => {
  it("starts at 0 where that is allowed", () => {
    expect(seedNumber({ type: "integer" })).toBe(0);
    expect(seedNumber({ type: "integer", minimum: -5, maximum: 5 })).toBe(0);
  });

  it("starts at the nearest end of the range where 0 lies outside it", () => {
    expect(seedNumber({ type: "integer", minimum: 1 })).toBe(1);
    expect(seedNumber({ type: "integer", exclusiveMinimum: 0 })).toBe(1);
    expect(seedNumber({ type: "number", maximum: -2 })).toBe(-2);
  });
});
