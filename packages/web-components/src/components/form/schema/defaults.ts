import type { JsonSchema } from "@cofy/frontend-sdk";

import { itemSchema, prefixItemsOf, sizeLimits } from "./collection.js";
import { deref, isRecord, noneExpanding, type RefGuard } from "./ref.js";
import { referableBranches, referableOf } from "./referable.js";
import { unionBranches } from "./resolve.js";

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
 * walks the schema itself. Without this the walk never bottoms out.
 */
function seed(schema: JsonSchema, root: JsonSchema, expanding: RefGuard): unknown {
  const node = deref(schema, root);
  if (expanding.has(node)) return null;

  const path = new Set([...expanding, node]);

  if ("default" in node) return node["default"];

  // A referable field starts as its value, a reference to a resource being the alternative to it - even when nothing is
  // valid against the value, which the union below would drop, leaving a reference to no resource in particular.
  const referable = referableOf(node) !== undefined ? referableBranches(node) : undefined;
  if (referable !== undefined) return seed(referable.value, root, path);

  // `unionBranches` is the same test `cofy-union-form` uses to decide whether it has a genuine
  // union to show a picker for - a `oneOf`, or a multi-branch `anyOf` (a plain, non-optional
  // `Union[A, B]`, which pydantic emits as `anyOf` rather than `oneOf`). An `Optional[X]`
  // (`anyOf` with a single non-null branch) does not reach here: pydantic always gives it a
  // `default` of `None`, already returned above.
  const branches = unionBranches(node, root);
  if (branches !== undefined) {
    // Pick the first branch; the author changes the discriminator to choose another. A union with no
    // branch left to offer has nothing to start from.
    return branches.length > 0 ? seed(branches[0]!, root, path) : null;
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
      return 0;
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
