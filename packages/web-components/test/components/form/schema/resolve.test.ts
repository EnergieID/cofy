import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import {
  constTagsOf,
  discriminatorOf,
  matchBranch,
  optionalInner,
  schemaTypeName,
  unionBranches,
} from "../../../../src/components/form/schema/resolve.js";

describe("optionalInner", () => {
  it("is undefined for anything without a null branch", () => {
    expect(optionalInner({ type: "string" }, {})).toBeUndefined();
    expect(optionalInner({ anyOf: [{ type: "string" }, { type: "integer" }] }, {})).toBeUndefined();
    expect(optionalInner({ oneOf: [{ type: "string" }, { type: "null" }] }, {})).toBeUndefined();
  });

  it("is the one other branch of Optional[X], left unresolved", () => {
    const costGroup = { $ref: "#/$defs/CostGroup" };
    expect(optionalInner({ anyOf: [costGroup, { type: "null" }], default: null }, {})).toBe(costGroup);
  });

  it("is a union of the others for Optional[A | B], which pydantic flattens into one anyOf", () => {
    const schema = { anyOf: [{ type: "string" }, { type: "integer" }, { type: "null" }] };
    expect(optionalInner(schema, {})).toEqual({ anyOf: [{ type: "string" }, { type: "integer" }] });
  });

  it("recognizes a null branch behind a $ref", () => {
    const root: JsonSchema = { $defs: { Nothing: { type: "null" } } };
    expect(optionalInner({ anyOf: [{ type: "string" }, { $ref: "#/$defs/Nothing" }] }, root)).toEqual({ type: "string" });
  });
});

describe("unionBranches", () => {
  it("returns undefined for a plain leaf", () => {
    expect(unionBranches({ type: "string" }, {})).toBeUndefined();
  });

  it("returns oneOf's branches", () => {
    const branches = [{ $ref: "#/$defs/DirectiveSourceSettings" }];
    expect(unionBranches({ oneOf: branches }, {})).toEqual(branches);
  });

  it("returns a bare anyOf's non-null branches, with no discriminator implied", () => {
    const node = { anyOf: [{ type: "string" }, { type: "integer" }] };
    expect(unionBranches(node, {})).toEqual(node.anyOf);
  });

  it("does not treat a single-branch anyOf (Optional[X], left to cofy-optional-form) as a union", () => {
    const node = { anyOf: [{ type: "string" }, { type: "null" }] };
    expect(unionBranches(node, {})).toBeUndefined();
  });
});

describe("discriminatorOf", () => {
  it("reads a well-formed discriminator", () => {
    const node = { discriminator: { propertyName: "type", mapping: { directive: "#/$defs/DirectiveSourceSettings" } } };
    expect(discriminatorOf(node)).toEqual({ propertyName: "type", mapping: { directive: "#/$defs/DirectiveSourceSettings" } });
  });

  it("returns undefined when there is none - the energy_cost Formula shape", () => {
    expect(discriminatorOf({ oneOf: [{ $ref: "#/$defs/MinimumFormula" }, { $ref: "#/$defs/TieredFormula" }] })).toBeUndefined();
  });
});

describe("schemaTypeName", () => {
  it("reads a $ref's own $defs entry name", () => {
    expect(schemaTypeName({ $ref: "#/$defs/Formula" })).toBe("Formula");
  });

  it("falls back to an inline schema's own title", () => {
    expect(schemaTypeName({ title: "Cost group" })).toBe("Cost group");
  });

  it("returns undefined for neither", () => {
    expect(schemaTypeName({ type: "string" })).toBeUndefined();
  });
});

describe("matchBranch", () => {
  const branches: JsonSchema[] = [
    { title: "Index", type: "object", properties: { kind: { const: "index" } } },
    { title: "Minimum", type: "object", properties: { kind: { const: "minimum" }, floor: { type: "number" } } },
  ];

  it("defaults to the first branch for a non-record value", () => {
    expect(matchBranch(null, branches, {})).toBe(0);
    expect(matchBranch("nope", branches, {})).toBe(0);
  });

  it("prefers a branch whose own const-tagged property matches the value's", () => {
    expect(matchBranch({ kind: "minimum", floor: 3 }, branches, {})).toBe(1);
  });

  it("resolves a $ref'd branch before checking its properties", () => {
    const root: JsonSchema = { $defs: { Minimum: branches[1]! } };
    const refBranches: JsonSchema[] = [branches[0]!, { $ref: "#/$defs/Minimum" }];
    expect(matchBranch({ kind: "minimum", floor: 3 }, refBranches, root)).toBe(1);
  });

  it("prefers the const-tag match even when every branch's required keys would equally match", () => {
    // Both branches here require only "kind", which every value has - a required-keys-only
    // match would ambiguously stop at the first branch regardless of which one actually fits;
    // the const tag is what correctly picks branch 1 instead.
    const required: JsonSchema[] = [
      { type: "object", properties: { kind: { const: "index" } }, required: ["kind"] },
      { type: "object", properties: { kind: { const: "minimum" }, floor: { type: "number" } }, required: ["kind"] },
    ];
    expect(matchBranch({ kind: "minimum", floor: 3 }, required, {})).toBe(1);
  });

  it("falls back to a branch whose required keys are all present, when no const tag matches", () => {
    const untagged: JsonSchema[] = [
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      { type: "object", properties: { b: { type: "string" } }, required: ["b"] },
    ];
    expect(matchBranch({ b: "x" }, untagged, {})).toBe(1);
  });

  it("defaults to the first branch when neither heuristic matches anything", () => {
    const untagged: JsonSchema[] = [
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      { type: "object", properties: { b: { type: "string" } }, required: ["b"] },
    ];
    expect(matchBranch({ c: "x" }, untagged, {})).toBe(0);
  });
});

describe("constTagsOf", () => {
  const root: JsonSchema = {
    $defs: {
      Index: { type: "object", properties: { kind: { const: "index" }, constant_cost: { type: "number" } } },
      Periodic: { type: "object", properties: { kind: { const: "periodic" }, unit: { const: "month" } } },
    },
  };

  it("is the properties every branch fixes to a const", () => {
    expect(constTagsOf([{ $ref: "#/$defs/Index" }, { $ref: "#/$defs/Periodic" }], root)).toEqual(["kind"]);
  });

  it("is empty when branches share no const property", () => {
    expect(constTagsOf([{ type: "integer" }, { type: "string" }], {})).toEqual([]);
  });
});
