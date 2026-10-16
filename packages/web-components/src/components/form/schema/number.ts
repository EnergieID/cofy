import type { JsonSchema } from "@cofy/frontend-sdk";

/** The range and granularity a number field accepts, as a number input takes them. */
export interface NumberLimits {
  min: number | undefined;
  max: number | undefined;
  step: number | "any";
}

/**
 * *node*'s `minimum`/`maximum`, `multipleOf`, and the exclusive bounds where a step makes them inclusive ones - one step
 * further in. Without a step - a decimal number with no `multipleOf` - an exclusive bound has no inclusive equivalent.
 */
export function numberLimits(node: JsonSchema): NumberLimits {
  const multipleOf = numeric(node["multipleOf"]);
  const step = multipleOf ?? (node["type"] === "integer" ? 1 : "any");
  const nudge = (bound: number | undefined, direction: 1 | -1): number | undefined =>
    bound === undefined || step === "any" ? undefined : bound + direction * step;

  return {
    min: numeric(node["minimum"]) ?? nudge(numeric(node["exclusiveMinimum"]), 1),
    max: numeric(node["maximum"]) ?? nudge(numeric(node["exclusiveMaximum"]), -1),
    step,
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
