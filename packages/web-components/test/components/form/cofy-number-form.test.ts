import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import { CofyNumberForm } from "../../../src/components/form/cofy-number-form.js";

type NumberInput = HTMLElement & { value: string };

async function mount(schema: JsonSchema, value: unknown): Promise<CofyNumberForm> {
  const element = new CofyNumberForm();
  element.schema = schema;
  element.root = schema;
  element.pointer = "/count";
  element.value = value;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

function input(element: CofyNumberForm): NumberInput {
  return element.shadowRoot!.querySelector<NumberInput>("wa-input")!;
}

describe("cofy-number-form", () => {
  it("limits its input to the range and granularity its schema accepts", async () => {
    const element = await mount({ type: "integer", minimum: 1, exclusiveMaximum: 10 }, 3);

    expect(input(element).getAttribute("min")).toBe("1");
    expect(input(element).getAttribute("max")).toBe("9");
    expect(input(element).getAttribute("step")).toBe("1");
  });

  it("sets no bound its schema does not have, and steps by one", async () => {
    const element = await mount({ type: "number" }, 3.5);

    expect(input(element).hasAttribute("min")).toBe(false);
    expect(input(element).hasAttribute("max")).toBe(false);
    expect(input(element).getAttribute("step")).toBe("1");
  });

  it("reports what is typed as a number, and an empty input as null", async () => {
    const element = await mount({ type: "number" }, 1);
    const values: unknown[] = [];
    element.addEventListener("field-change", (event) => values.push((event as CustomEvent<{ value: unknown }>).detail.value));

    input(element).value = "2.5";
    input(element).dispatchEvent(new Event("input"));
    input(element).value = "";
    input(element).dispatchEvent(new Event("input"));

    expect(values).toEqual([2.5, null]);
  });
});
