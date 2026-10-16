import { describe, expect, it } from "vitest";

import { CofyTimeForm } from "../../../src/components/form/cofy-time-form.js";
import { defaultFieldRegistry } from "../../../src/components/form/field-registry.js";

type TimeInput = HTMLElement & { value: string | null };

async function mount(value: unknown): Promise<CofyTimeForm> {
  const element = new CofyTimeForm();
  element.schema = { type: "string", format: "time" };
  element.root = element.schema;
  element.pointer = "/start";
  element.value = value;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

function input(element: CofyTimeForm): TimeInput {
  return element.shadowRoot!.querySelector<TimeInput>("wa-time-input")!;
}

describe("cofy-time-form", () => {
  it("is what a time of day dispatches to, rather than a plain string", () => {
    expect(defaultFieldRegistry.getFirstMatch({ type: "string", format: "time" }, {})?.tag).toBe("cofy-time-form");
    expect(defaultFieldRegistry.getFirstMatch({ type: "string" }, {})?.tag).toBe("cofy-string-form");
  });

  it("shows the time it holds, in 24 hours whatever the locale", async () => {
    const element = await mount("07:30");

    expect(input(element).value).toBe("07:30");
    expect(input(element).getAttribute("hour-format")).toBe("24");
  });

  it("reports the time entered with its seconds, as the format requires, and an emptied field as null", async () => {
    const element = await mount("07:30");
    const values: unknown[] = [];
    element.addEventListener("field-change", (event) => values.push((event as CustomEvent<{ value: unknown }>).detail.value));

    input(element).value = "22:00";
    input(element).dispatchEvent(new Event("input"));
    input(element).value = "22:00:15";
    input(element).dispatchEvent(new Event("input"));
    input(element).value = null;
    input(element).dispatchEvent(new Event("input"));

    expect(values).toEqual(["22:00:00", "22:00:15", null]);
  });
});
