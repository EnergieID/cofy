import { beforeEach, describe, expect, it } from "vitest";
import { ContextProvider } from "@lit/context";
import type { JsonSchema } from "@cofy/frontend-sdk";

import "../../../src/components/form/cofy-dict-form.js";
import "../../../src/components/form/cofy-list-form.js";
import { i18nContext } from "../../../src/context.js";
import { testI18n } from "../../support/i18n.js";

async function mount(tag: "cofy-list-form" | "cofy-dict-form", schema: JsonSchema, value: unknown): Promise<HTMLElement> {
  const element = document.createElement(tag);
  new ContextProvider(element, { context: i18nContext, initialValue: await testI18n() });
  element.schema = schema;
  element.root = schema;
  element.pointer = "/field";
  element.value = value;
  document.body.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return element;
}

/** For each item, whether it has a delete link, followed by whether there is an "Add" item. */
function affordances(element: HTMLElement): { removable: boolean[]; addable: boolean } {
  const items = Array.from(element.shadowRoot!.querySelectorAll("wa-accordion-item[data-segment]"));
  return {
    removable: items.map((item) => item.querySelector("cofy-link-button") !== null),
    addable: element.shadowRoot!.querySelector(".cofy-list-add, .cofy-dict-add") !== null,
  };
}

describe("a list's size limits", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  const strings: JsonSchema = { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 };

  it("offers adding and removing within its limits", async () => {
    const element = await mount("cofy-list-form", strings, ["a", "b"]);
    expect(affordances(element)).toEqual({ removable: [true, true], addable: true });
  });

  it("offers no add once full, and no remove once down to its minimum", async () => {
    expect(affordances(await mount("cofy-list-form", strings, ["a", "b", "c"])).addable).toBe(false);
    expect(affordances(await mount("cofy-list-form", strings, ["a"])).removable).toEqual([false]);
  });

  it("only lets a value outside its limits move towards them", async () => {
    expect(affordances(await mount("cofy-list-form", strings, ["a", "b", "c", "d"]))).toEqual({
      removable: [true, true, true, true],
      addable: false,
    });
    const tooShort: JsonSchema = { ...strings, minItems: 3 };
    expect(affordances(await mount("cofy-list-form", tooShort, ["a"]))).toEqual({ removable: [false], addable: true });
  });

  it("only removes a tuple's last positional element, but any of the ones after them", async () => {
    const tuple: JsonSchema = { type: "array", prefixItems: [{ type: "number" }, { type: "string" }], items: { type: "boolean" } };
    expect(affordances(await mount("cofy-list-form", tuple, [1, "a"])).removable).toEqual([false, true]);
    expect(affordances(await mount("cofy-list-form", tuple, [1, "a", true, false])).removable).toEqual([false, false, true, true]);
  });

  it("offers neither on a fixed-length tuple", async () => {
    const boundaries: JsonSchema = {
      type: "array",
      prefixItems: [{ type: "number" }, { type: "number" }],
      minItems: 2,
      maxItems: 2,
    };
    expect(affordances(await mount("cofy-list-form", boundaries, [1, 2]))).toEqual({ removable: [false, false], addable: false });
  });
});

describe("a dict's size limits", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  const tariffs: JsonSchema = { type: "object", additionalProperties: { type: "string" }, minProperties: 1, maxProperties: 2 };

  it("offers no add once full, and no remove once down to its minimum", async () => {
    expect(affordances(await mount("cofy-dict-form", tariffs, { a: "x" }))).toEqual({ removable: [false], addable: true });
    expect(affordances(await mount("cofy-dict-form", tariffs, { a: "x", b: "y" }))).toEqual({
      removable: [true, true],
      addable: false,
    });
  });
});
