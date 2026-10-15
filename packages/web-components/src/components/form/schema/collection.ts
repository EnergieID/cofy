import type { JsonSchema } from "@cofy/frontend-sdk";

import { isRecord } from "./ref.js";

/** How many elements an array, or entries an object, may hold. */
export interface SizeLimits {
  min: number;
  max: number;
}

/** *node*'s `minItems`/`maxItems`, or `minProperties`/`maxProperties` for its `"properties"`. */
export function sizeLimits(node: JsonSchema, of: "items" | "properties"): SizeLimits {
  const min = of === "items" ? node["minItems"] : node["minProperties"];
  const max = of === "items" ? node["maxItems"] : node["maxProperties"];
  return {
    min: typeof min === "number" ? min : 0,
    max: typeof max === "number" ? max : Infinity,
  };
}

/** An array's own positional schemas, empty unless it is a tuple. */
export function prefixItemsOf(node: JsonSchema): readonly JsonSchema[] {
  const prefixItems = node["prefixItems"];
  return Array.isArray(prefixItems) ? (prefixItems as unknown[]).filter(isRecord) : [];
}

/** The schema of an array's element at *index*: a tuple's own for its position, otherwise the one every element shares. */
export function itemSchema(node: JsonSchema, index: number): JsonSchema {
  return prefixItemsOf(node)[index] ?? (isRecord(node["items"]) ? node["items"] : {});
}
