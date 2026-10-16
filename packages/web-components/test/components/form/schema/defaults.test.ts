import { describe, expect, it } from "vitest";

import { seedFromSchema } from "../../../../src/components/form/schema/defaults.js";

describe("seedFromSchema", () => {
  it("uses a property's default", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: { name: { type: "string", default: "default" } },
    });

    expect(seeded).toEqual({ name: "default" });
  });

  it("includes required properties without a default, as empty placeholders", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: { api_key: { type: "string" }, count: { type: "integer" }, on: { type: "boolean" } },
      required: ["api_key", "count", "on"],
    });

    expect(seeded).toEqual({ api_key: "", count: 0, on: false });
  });

  it("leaves out properties that are neither required nor defaulted", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: { name: { type: "string" }, optional: { type: "string" } },
      required: ["name"],
    });

    expect(seeded).toEqual({ name: "" });
  });

  it("pins a const, which is how a discriminator gets its value", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: { type: { const: "tariff", default: "tariff" } },
      required: ["type"],
    });

    expect(seeded).toEqual({ type: "tariff" });
  });

  it("follows a $ref into the schema's own $defs", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: { source: { $ref: "#/$defs/Source" } },
      required: ["source"],
      $defs: { Source: { type: "object", properties: { type: { const: "x", default: "x" } }, required: ["type"] } },
    });

    expect(seeded).toEqual({ source: { type: "x" } });
  });

  it("takes the first branch of a union, which the author can then change", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: {
        source: {
          oneOf: [{ $ref: "#/$defs/A" }, { $ref: "#/$defs/B" }],
        },
      },
      required: ["source"],
      $defs: {
        A: { type: "object", properties: { type: { const: "a", default: "a" } }, required: ["type"] },
        B: { type: "object", properties: { type: { const: "b", default: "b" } }, required: ["type"] },
      },
    });

    expect(seeded).toEqual({ source: { type: "a" } });
  });

  it("starts a referable field as its value, not as a reference", () => {
    const ref = { type: "object", properties: { type: { const: "resource" }, name: { type: "string" } } };
    const referable = (value: object): unknown =>
      seedFromSchema({ oneOf: [value, { $ref: "#/$defs/Ref" }], "x-referable": { kind: "source" }, $defs: { Ref: ref } });

    expect(referable({ type: "object", properties: { type: { const: "a" } }, required: ["type"] })).toEqual({ type: "a" });
    // Not a reference to no resource in particular where nothing is valid against the value.
    expect(referable({ not: {} })).toEqual({});
  });

  it("takes the first branch of a plain (non-discriminated) union too, which pydantic emits as anyOf", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: {
        source: {
          anyOf: [{ $ref: "#/$defs/A" }, { $ref: "#/$defs/B" }],
        },
      },
      required: ["source"],
      $defs: {
        A: { type: "object", properties: { type: { const: "a", default: "a" } }, required: ["type"] },
        B: { type: "object", properties: { type: { const: "b", default: "b" } }, required: ["type"] },
      },
    });

    expect(seeded).toEqual({ source: { type: "a" } });
  });

  it("still seeds an Optional (a single-branch anyOf with null) from its own default rather than treating it as a union", () => {
    const seeded = seedFromSchema({
      type: "object",
      properties: {
        nickname: { anyOf: [{ type: "string" }, { type: "null" }], default: null },
      },
      required: ["nickname"],
    });

    expect(seeded).toEqual({ nickname: null });
  });

  it("starts a number within its range", () => {
    expect(seedFromSchema({ type: "integer", minimum: 1 })).toBe(1);
  });

  it("starts arrays empty", () => {
    expect(seedFromSchema({ type: "object", properties: { xs: { type: "array" } }, required: ["xs"] })).toEqual({
      xs: [],
    });
  });

  it("starts a tuple with a placeholder in each position", () => {
    const tuple = { type: "array", prefixItems: [{ type: "number" }, { type: "string" }], minItems: 2, maxItems: 2 };
    expect(seedFromSchema(tuple)).toEqual([0, ""]);
  });

  it("starts a list with as many elements as its minimum", () => {
    expect(seedFromSchema({ type: "array", items: { type: "string" }, minItems: 2 })).toEqual(["", ""]);
    // A tuple's own positions first, then the elements every later one shares.
    const tuple = { type: "array", prefixItems: [{ type: "number" }], items: { type: "boolean" }, minItems: 2 };
    expect(seedFromSchema(tuple)).toEqual([0, false]);
  });

  it("starts an optional out as null, even one without a default", () => {
    expect(seedFromSchema({ anyOf: [{ type: "string" }, { type: "null" }] })).toBeNull();
    expect(seedFromSchema({ anyOf: [{ type: "string" }, { type: "integer" }, { type: "null" }] })).toBeNull();
  });

  it("seeds something other than null for a value nothing is valid against, so it shows why", () => {
    expect(seedFromSchema({ not: {} })).toEqual({});
    expect(seedFromSchema({ oneOf: [{ $ref: "#/$defs/Gone" }], $defs: { Gone: { not: {} } } })).toEqual({});
  });

  // Real module schemas are recursive - a tariff formula can contain further formulas - and seeding walks the schema
  // rather than an instance. A schema that can be satisfied at all leads back to itself only through something that
  // can stop.
  it("stops a schema that refers back to itself through an optional", () => {
    const formula = {
      type: "object",
      properties: { kind: { const: "index" }, inner: { anyOf: [{ $ref: "#/$defs/Formula" }, { type: "null" }] } },
      required: ["kind", "inner"],
    };
    expect(seedFromSchema({ $ref: "#/$defs/Formula" }, { $defs: { Formula: formula } })).toEqual({ kind: "index", inner: null });
  });

  it("stops a schema that refers back to itself through a union, at a branch that does not", () => {
    const root = {
      $defs: {
        Formula: { oneOf: [{ $ref: "#/$defs/Minimum" }, { $ref: "#/$defs/Constant" }] },
        Minimum: {
          type: "object",
          properties: { kind: { const: "minimum" }, of: { $ref: "#/$defs/Formula" } },
          required: ["kind", "of"],
        },
        Constant: { type: "object", properties: { kind: { const: "constant" } }, required: ["kind"] },
      },
    };
    expect(seedFromSchema({ $ref: "#/$defs/Formula" }, root)).toEqual({ kind: "minimum", of: { kind: "constant" } });
  });

  it("stops a schema that refers back to itself through a list", () => {
    const formula = {
      type: "object",
      properties: { kind: { const: "sum" }, terms: { type: "array", items: { $ref: "#/$defs/Formula" } } },
      required: ["kind", "terms"],
    };
    expect(seedFromSchema({ $ref: "#/$defs/Formula" }, { $defs: { Formula: formula } })).toEqual({ kind: "sum", terms: [] });
  });

  it("returns an empty object for a schema with no properties", () => {
    expect(seedFromSchema({ type: "object" })).toEqual({});
  });
});
