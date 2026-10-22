import { beforeEach, describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import { CofyAnyForm } from "../../../src/components/form/cofy-any-form.js";
import { CofyNamedIdentifierForm } from "../../../src/components/form/cofy-named-identifier-form.js";
import { defaultFieldRegistry } from "../../../src/components/form/field-registry.js";
import { testI18n } from "../../support/i18n.js";

type Control = HTMLElement & { value: string | null };

const identifier: JsonSchema = {
  title: "NamedIdentifier",
  type: "object",
  "x-named-identifier": true,
  properties: { name: { type: "string", title: "Name" }, id: { type: "string", title: "Id" } },
  required: ["name", "id"],
};

async function mount(value: unknown): Promise<{ element: CofyNamedIdentifierForm; values: unknown[] }> {
  const element = new CofyNamedIdentifierForm();
  element.i18n = await testI18n();
  element.schema = identifier;
  element.root = identifier;
  element.pointer = "/supplier";
  element.label = "Supplier";
  element.value = value;
  const values: unknown[] = [];
  element.addEventListener("field-change", (event) => values.push((event as CustomEvent<{ value: unknown }>).detail.value));
  document.body.append(element);
  await element.updateComplete;
  return { element, values };
}

function inputs(element: CofyNamedIdentifierForm): Control[] {
  return [...element.shadowRoot!.querySelectorAll<Control>("wa-input")];
}

describe("cofy-named-identifier-form", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("is what an object marked as a named identifier dispatches to, rather than an object form", () => {
    expect(defaultFieldRegistry.getFirstMatch(identifier, identifier)?.tag).toBe("cofy-named-identifier-form");
  });

  it("is summarized by its name", () => {
    expect(defaultFieldRegistry.getSummary(identifier, identifier, { name: "Energie Belgie", id: "eb" })).toBe("Energie Belgie");
  });

  it("shows the name and the id side by side", async () => {
    const { element } = await mount({ name: "Energie Belgie", id: "eb" });

    expect(inputs(element).map((input) => input.value)).toEqual(["Energie Belgie", "eb"]);
  });

  it("reports the whole identifier when either part changes", async () => {
    const { element, values } = await mount({ name: "Energie Belgie", id: "eb" });
    const [name, id] = inputs(element);

    name!.value = "EB";
    name!.dispatchEvent(new Event("input"));
    id!.value = "eb2";
    id!.dispatchEvent(new Event("input"));

    expect(values).toEqual([{ name: "EB", id: "eb" }, { name: "Energie Belgie", id: "eb2" }]);
  });

  it("starts both parts empty without a value", async () => {
    const { element, values } = await mount(undefined);
    const [, id] = inputs(element);

    id!.value = "eb";
    id!.dispatchEvent(new Event("input"));

    expect(values).toEqual([{ name: "", id: "eb" }]);
  });
});

describe("a field typed by a model", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  async function shellOf(schema: JsonSchema): Promise<HTMLElement & { label: string; description: string }> {
    const root: JsonSchema = { $defs: { NamedIdentifier: { ...identifier, description: "Of the model." } } };
    const element = new CofyAnyForm();
    element.i18n = await testI18n();
    element.schema = schema;
    element.root = root;
    element.pointer = "/distributor";
    element.value = { name: "Fluvius", id: "fluvius" };
    document.body.append(element);
    await element.updateComplete;
    return element.shadowRoot!.querySelector("cofy-field-shell")!;
  }

  it("is labelled after its property, not the model's class name", async () => {
    expect((await shellOf({ $ref: "#/$defs/NamedIdentifier" })).label).toBe("Distributor");
  });

  it("is described by its own description first, and the model's otherwise", async () => {
    expect((await shellOf({ $ref: "#/$defs/NamedIdentifier", description: "Of the field." })).description).toBe("Of the field.");
    expect((await shellOf({ $ref: "#/$defs/NamedIdentifier" })).description).toBe("Of the model.");
  });
});
