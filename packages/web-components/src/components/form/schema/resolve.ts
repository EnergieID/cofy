import type { JsonSchema } from "@cofy/frontend-sdk";

import { isNever } from "./never.js";
import { deref, isRecord, refOf } from "./ref.js";

/** An OpenAPI-style discriminator, tying a union's branches to a tag property. */
export interface Discriminator {
  propertyName: string;
  mapping: Readonly<Record<string, string>>;
}

/**
 * *anyOf*'s own non-`null` branches - the candidates for a bare union (more than one) - or
 * `undefined` if *anyOf* isn't an array at all.
 */
function nonNullBranches(anyOf: unknown, root: JsonSchema): JsonSchema[] | undefined {
  if (!Array.isArray(anyOf)) return undefined;
  return (anyOf as JsonSchema[]).filter((branch) => !isNull(branch, root));
}

function isNull(schema: JsonSchema, root: JsonSchema): boolean {
  return deref(schema, root)["type"] === "null";
}

/**
 * What an `Optional` - an `anyOf` with a `null` branch - holds when it is not `null`: its one other
 * branch, or a union of the others (pydantic flattens `Optional[A | B]` into one `anyOf`), or
 * `undefined` if *node* is not one. Expects *node* already resolved past its own `$ref`.
 */
export function optionalInner(node: JsonSchema, root: JsonSchema): JsonSchema | undefined {
  const anyOf = node["anyOf"];
  if (!Array.isArray(anyOf) || !(anyOf as JsonSchema[]).some((branch) => isNull(branch, root))) return undefined;

  const others = nonNullBranches(anyOf, root)!;
  if (others.length === 0) return undefined;
  return others.length === 1 ? others[0] : { anyOf: others };
}

/**
 * *node*'s own union branches - `oneOf`, or an `anyOf` with more than one non-`null` branch - or
 * `undefined` if it isn't one. A branch nothing is valid against is not one to offer, so it is left
 * out - which can leave a union with none. Expects *node* already resolved past its own `$ref`.
 */
export function unionBranches(node: JsonSchema, root: JsonSchema): readonly JsonSchema[] | undefined {
  const oneOf = node["oneOf"];
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    return (oneOf as JsonSchema[]).filter((branch) => !isNever(branch, root));
  }

  const nonNull = nonNullBranches(node["anyOf"], root);
  return nonNull !== undefined && nonNull.length > 1 ? nonNull : undefined;
}

/**
 * *node*'s own discriminator, if it has one - pydantic only ever puts a `discriminator` beside
 * `oneOf`, never a bare `anyOf` union.
 */
export function discriminatorOf(node: JsonSchema): Discriminator | undefined {
  const discriminator = node["discriminator"];
  if (!isRecord(discriminator)) return undefined;

  const propertyName = discriminator["propertyName"];
  const mapping = discriminator["mapping"];
  if (typeof propertyName !== "string" || !isRecord(mapping)) return undefined;

  return { propertyName, mapping: mapping as Record<string, string> };
}

/**
 * The name a custom field mapper would key this schema under - its own `$ref`'s `$defs` entry,
 * or its own `title` for an inline schema with no `$ref`. Checked against *schema* as handed
 * down, before `deref` resolves it - the identity a `$ref` carries (`TimeseriesSource`,
 * `Formula`, ...) is exactly what resolving it throws away.
 */
export function schemaTypeName(schema: JsonSchema): string | undefined {
  const ref = refOf(schema);
  if (ref !== undefined) return ref.split("/").pop();
  return typeof schema["title"] === "string" ? schema["title"] : undefined;
}

/**
 * A best-effort guess at which of *branches* *value* already matches. Defaults to the first.
 *
 * A branch whose own `const`-tagged property matches the value's is preferred - that is what a
 * `kind`/`type`-style tag actually looks like once resolved, and it is far more specific than
 * "has the same required keys," which every sibling branch sharing a common field would also
 * satisfy (a `kind: "index"` value still lists `kind` as a required key of every other branch).
 * Used by `cofy-union-form` for a union with no discriminator to read the tag from directly.
 */
export function matchBranch(value: unknown, branches: readonly JsonSchema[], root: JsonSchema): number {
  if (!isRecord(value)) return 0;

  const byTag = branches.findIndex((branch) => {
    const properties = deref(branch, root)["properties"];
    if (!isRecord(properties)) return false;
    return Object.entries(properties).some(
      ([key, propSchema]) => isRecord(propSchema) && "const" in propSchema && value[key] === propSchema["const"],
    );
  });
  if (byTag !== -1) return byTag;

  const byRequired = branches.findIndex((branch) => {
    const required = deref(branch, root)["required"];
    return Array.isArray(required) && required.length > 0 && required.every((key) => key in value);
  });
  return byRequired === -1 ? 0 : byRequired;
}
