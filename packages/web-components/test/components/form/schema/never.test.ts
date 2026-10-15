import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import { isNever } from "../../../../src/components/form/schema/never.js";
import { unionBranches } from "../../../../src/components/form/schema/resolve.js";

const root: JsonSchema = {
  $defs: {
    Gone: { not: {} },
    Kept: { type: "object", properties: { type: { const: "kept" } } },
  },
};

describe("isNever", () => {
  it("is true of a schema nothing is valid against, also through a reference, whatever is beside it", () => {
    expect(isNever({ not: {} }, root)).toBe(true);
    expect(isNever({ not: {}, title: "Source" }, root)).toBe(true);
    expect(isNever({ $ref: "#/$defs/Gone" }, root)).toBe(true);
  });

  it("is false of anything else, a schema merely ruling some values out included", () => {
    expect(isNever({ $ref: "#/$defs/Kept" }, root)).toBe(false);
    expect(isNever({ type: "string", not: { const: "" } }, root)).toBe(false);
    expect(isNever({ not: { type: "null" } }, root)).toBe(false);
    expect(isNever({ oneOf: [{ $ref: "#/$defs/Gone" }] }, root)).toBe(false);
  });
});

describe("unionBranches", () => {
  it("offers no branch nothing is valid against, which can leave a union with none", () => {
    const union = { oneOf: [{ $ref: "#/$defs/Gone" }, { $ref: "#/$defs/Kept" }] };

    expect(unionBranches(union, root)).toEqual([{ $ref: "#/$defs/Kept" }]);
    expect(unionBranches({ oneOf: [{ $ref: "#/$defs/Gone" }] }, root)).toEqual([]);
  });
});
