import type { JsonSchema } from "@cofy/frontend-sdk";

import { itemSchema, prefixItemsOf, sizeLimits } from "./collection.js";
import { deref, isRecord, noneExpanding, type RefGuard } from "./ref.js";
import { isNever } from "./never.js";
import { seedNumber } from "./number.js";
import { referableBranches, referableOf } from "./referable.js";
import { optionalInner, unionBranches } from "./resolve.js";

/**
 * Build the smallest object that a schema would plausibly accept.
 *
 * Every property with a `default` gets it, and every required property without one gets a
 * placeholder of the right shape - so a new module opens as a skeleton with the right keys
 * in the right places, rather than an empty document the author has to derive from the
 * schema by hand. It is explicitly not guaranteed to validate: a required string with no
 * default becomes `""`, which the author still has to fill in, and the editor says so.
 */
export function seedFromSchema(schema: JsonSchema, root: JsonSchema = schema): unknown {
  return seed(schema, root, noneExpanding);
}

/**
 * *expanding* holds the resolved nodes already being expanded on this path.
 *
 * These schemas are recursive - a tariff formula can contain further formulas, and a module's
 * source can lead back to one - and unlike validation, which walks a finite instance, seeding
 * walks the schema itself. A schema that can be satisfied at all leads back to itself only
 * through something that can stop: an optional, which starts out `null`; a list, which starts out
 * empty; or a union, which starts out as a branch that is not already being expanded.
 */
function seed(schema: JsonSchema, root: JsonSchema, expanding: RefGuard): unknown {
  const node = deref(schema, root);
  const path = new Set([...expanding, node]);

  if ("default" in node) return node["default"];

  // Starts out not there; `cofy-optional-form` offers to create it.
  if (optionalInner(node, root) !== undefined) return null;

  // Nothing is valid against it, but anything other than `null` shows why - where `null` would leave an optional around
  // it looking like it was never created.
  if (isNever(node, root)) return {};

  // A referable field starts as its value, a reference to a resource being the alternative to it - even when nothing is
  // valid against the value, which the union below would drop, leaving a reference to no resource in particular.
  const referable = referableOf(node) !== undefined ? referableBranches(node) : undefined;
  if (referable !== undefined) return seed(referable.value, root, path);

  // `unionBranches` is the same test `cofy-union-form` uses to decide whether it has a genuine
  // union to show a picker for - a `oneOf`, or a multi-branch `anyOf` (a plain `Union[A, B]`,
  // which pydantic emits as `anyOf` rather than `oneOf`).
  const branches = unionBranches(node, root);
  if (branches !== undefined) {
    // The first branch that does not lead straight back here; the author changes the discriminator to choose another.
    // A union with no branch left to offer is one nothing is valid against.
    const branch = branches.find((candidate) => !path.has(deref(candidate, root))) ?? branches[0];
    return branch === undefined ? {} : seed(branch, root, path);
  }

  const constant = node["const"];
  if (constant !== undefined) return constant;

  switch (node["type"]) {
    case "object":
      return seedObject(node, root, path);
    case "array": {
      // As many placeholders as it needs at least: one in each of a tuple's positions, and up to its minimum.
      const length = Math.max(prefixItemsOf(node).length, sizeLimits(node, "items").min);
      return Array.from({ length }, (_, index) => seed(itemSchema(node, index), root, path));
    }
    case "string":
      return "";
    case "integer":
    case "number":
      return seedNumber(node);
    case "boolean":
      return false;
    default:
      return null;
  }
}

function seedObject(node: JsonSchema, root: JsonSchema, expanding: RefGuard): Record<string, unknown> {
  const properties = node["properties"];
  const required = new Set(Array.isArray(node["required"]) ? (node["required"] as string[]) : []);
  const seeded: Record<string, unknown> = {};

  if (!isRecord(properties)) return seeded;

  for (const [name, property] of Object.entries(properties)) {
    if (!isRecord(property)) continue;
    // A field with a default is worth showing even when optional: it tells the author the
    // knob exists. One that is neither required nor defaulted is left out to keep the
    // starting document short.
    if (!required.has(name) && !("default" in property)) continue;
    seeded[name] = seed(property, root, expanding);
  }
  return seeded;
}
