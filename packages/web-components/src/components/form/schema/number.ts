import type { JsonSchema } from "@cofy/frontend-sdk";

/** The range and granularity a number field accepts, as a number input takes them. */
export interface NumberLimits {
  min: number | undefined;
  max: number | undefined;
  step: number;
}

/**
 * *node*'s `minimum`/`maximum`, its `multipleOf` as the step - one otherwise, for the input's buttons to step by - and its
 * exclusive bounds where the schema's own granularity makes them inclusive ones, one step further in. A decimal number
 * with no `multipleOf` has none, so its exclusive bounds are left to the validator.
 */
export function numberLimits(node: JsonSchema): NumberLimits {
  const multipleOf = numeric(node["multipleOf"]);
  const granularity = multipleOf ?? (node["type"] === "integer" ? 1 : undefined);
  const nudge = (bound: number | undefined, direction: 1 | -1): number | undefined =>
    bound === undefined || granularity === undefined ? undefined : bound + direction * granularity;

  return {
    min: numeric(node["minimum"]) ?? nudge(numeric(node["exclusiveMinimum"]), 1),
    max: numeric(node["maximum"]) ?? nudge(numeric(node["exclusiveMaximum"]), -1),
    step: multipleOf ?? 1,
  };
}

/** The value a new number field starts at: `0`, moved into its range if that lies outside it. */
export function seedNumber(node: JsonSchema): number {
  const { min, max } = numberLimits(node);
  if (min !== undefined && min > 0) return min;
  if (max !== undefined && max < 0) return max;
  return 0;
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
