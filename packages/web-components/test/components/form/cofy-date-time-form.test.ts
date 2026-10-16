import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CofyDateTimeForm } from "../../../src/components/form/cofy-date-time-form.js";
import { defaultFieldRegistry } from "../../../src/components/form/field-registry.js";
import { testI18n } from "../../support/i18n.js";

type Control = HTMLElement & { value: string | null };

const originalZone = process.env["TZ"];
beforeAll(() => {
  process.env["TZ"] = "Europe/Brussels";
});
afterAll(() => {
  process.env["TZ"] = originalZone;
});

async function mount(value: unknown): Promise<{ element: CofyDateTimeForm; values: unknown[] }> {
  const element = new CofyDateTimeForm();
  element.i18n = await testI18n();
  element.schema = { type: "string", format: "date-time" };
  element.root = element.schema;
  element.pointer = "/start";
  element.label = "Start";
  element.value = value;
  const values: unknown[] = [];
  element.addEventListener("field-change", (event) => values.push((event as CustomEvent<{ value: unknown }>).detail.value));
  document.body.append(element);
  await element.updateComplete;
  return { element, values };
}

/** The date, the time, the offset's sign and the offset, in the order the row shows them. */
function controls(element: CofyDateTimeForm): Control[] {
  return Array.from(element.shadowRoot!.querySelectorAll<Control>("wa-input, wa-time-input, wa-select"));
}

function enter(control: Control, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("change"));
}

describe("cofy-date-time-form", () => {
  it("is what a point in time dispatches to, rather than a plain string", () => {
    expect(defaultFieldRegistry.getFirstMatch({ type: "string", format: "date-time" }, {})?.tag).toBe("cofy-date-time-form");
  });

  it("shows a date-time's date, time and offset side by side", async () => {
    const { element } = await mount("2026-01-01T07:30:00-05:00");

    expect(controls(element).map((control) => control.value)).toEqual(["2026-01-01", "07:30:00", "-", "05:00"]);
  });

  it("reports the whole date-time whichever part changes, keeping the offset it holds", async () => {
    const { element, values } = await mount("2026-01-01T07:30:00+01:00");
    const [date, time, sign, offset] = controls(element);

    enter(date!, "2026-07-01");
    enter(time!, "08:00");
    enter(sign!, "-");
    enter(offset!, "03:00");

    expect(values).toEqual([
      "2026-07-01T07:30:00+01:00",
      "2026-01-01T08:00:00+01:00",
      "2026-01-01T07:30:00-01:00",
      "2026-01-01T07:30:00+03:00",
    ]);
  });

  it("starts a new one at the reader's own offset for the date entered", async () => {
    const { element, values } = await mount(null);

    enter(controls(element)[0]!, "2026-07-01");

    expect(values).toEqual(["2026-07-01T00:00:00+02:00"]);
  });

  it("keeps a time entered before the date, for when the date is entered", async () => {
    const { element, values } = await mount(null);

    enter(controls(element)[1]!, "08:15");
    await element.updateComplete;
    expect(controls(element)[1]!.value).toBe("08:15");
    enter(controls(element)[0]!, "2026-01-15");

    expect(values).toEqual([null, "2026-01-15T08:15:00+01:00"]);
  });

  it("keeps the time when the date changes", async () => {
    const { element, values } = await mount("2026-01-01T07:30:00+01:00");

    enter(controls(element)[0]!, "2026-02-01");

    expect(values).toEqual(["2026-02-01T07:30:00+01:00"]);
  });

  it("shows both times in 24 hours, whatever the locale", async () => {
    const { element } = await mount(null);

    const times = Array.from(element.shadowRoot!.querySelectorAll("wa-time-input"));
    expect(times.map((time) => time.getAttribute("hour-format"))).toEqual(["24", "24"]);
  });

  it("warns about a value it can't take apart, until a new one replaces it", async () => {
    const { element, values } = await mount("next tuesday");

    expect(element.shadowRoot!.querySelector("wa-callout")?.textContent).toContain("next tuesday");
    enter(controls(element)[0]!, "2026-01-15");
    expect(values).toEqual(["2026-01-15T00:00:00+01:00"]);
  });
});
