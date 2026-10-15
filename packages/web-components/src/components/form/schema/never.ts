import type { JsonSchema } from "@cofy/frontend-sdk";

import { deref, isRecord } from "./ref.js";

/**
 * Whether nothing is valid against *schema*: one with `"not": {}` - as a type a community may not use comes, or a
 * field of a family nothing implements yet, its title beside it; every keyword has to hold, so nothing else in it
 * matters. Such a branch of a union is not one to offer, and such a field is not one to fill in.
 */
export function isNever(schema: JsonSchema, root: JsonSchema): boolean {
  const not = deref(schema, root)["not"];
  return isRecord(not) && Object.keys(not).length === 0;
}
