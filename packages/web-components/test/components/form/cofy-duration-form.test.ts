import { describe, expect, it } from "vitest";

import { CofyDurationForm } from "../../../src/components/form/cofy-duration-form.js";
import { defaultFieldRegistry } from "../../../src/components/form/field-registry.js";
import { testI18n } from "../../support/i18n.js";

type Control = HTMLElement & { value: string | null };

async function mount(value: unknown): Promise<{ element: CofyDurationForm; values: unknown[] }> {
  const element = new CofyDurationForm();
  element.i18n = await testI18n();
  element.schema = { type: "string", format: "duration" };
  element.root = element.schema;
  element.pointer = "/chunk_size";
  element.label = "Chunk Size";
  element.value = value;
  const values: unknown[] = [];
  element.addEventListener("field-change", (event) => values.push((event as CustomEvent<{ value: unknown }>).detail.value));
  document.body.append(element);
  await element.updateComplete;
  return { element, values };
}

function amount(element: CofyDurationForm): Control {
  return element.shadowRoot!.querySelector<Control>("wa-number-input")!;
}

function unit(element: CofyDurationForm): Control {
  return element.shadowRoot!.querySelector<Control>("wa-select")!;
}

function enter(control: Control, value: string, event = "input"): void {
  control.value = value;
  control.dispatchEvent(new Event(event));
}

describe("cofy-duration-form", () => {
  it("is what a duration dispatches to, rather than a plain string", () => {
    expect(defaultFieldRegistry.getFirstMatch({ type: "string", format: "duration" }, {})?.tag).toBe("cofy-duration-form");
  });

  it("shows a duration as its amount and unit", async () => {
    const { element } = await mount("P1D");

    expect([amount(element).value, unit(element).value]).toEqual(["1", "days"]);
  });

  it("reports the amount entered in the unit chosen, and an emptied amount as null", async () => {
    const { element, values } = await mount("P1D");

    enter(amount(element), "7");
    enter(unit(element), "weeks", "change");
    enter(amount(element), "");

    expect(values).toEqual(["P7D", "P1W", null]);
  });

  it("keeps a unit chosen before any amount, for the amount entered next", async () => {
    const { element, values } = await mount(null);

    enter(unit(element), "hours", "change");
    await element.updateComplete;
    expect(values).toEqual([]);
    enter(amount(element), "2");

    expect(values).toEqual(["PT2H"]);
  });

  it("warns about a value it can't show, until a new one replaces it", async () => {
    const { element, values } = await mount("P1DT2H");

    expect(amount(element).value).toBe("");
    expect(element.shadowRoot!.querySelector("wa-callout")?.textContent).toContain("P1DT2H");
    enter(amount(element), "15");

    expect(values).toEqual(["PT15M"]);
  });

  it("does not warn about a field with nothing in it yet", async () => {
    const { element } = await mount(null);

    expect(element.shadowRoot!.querySelector("wa-callout")).toBeNull();
  });
});
