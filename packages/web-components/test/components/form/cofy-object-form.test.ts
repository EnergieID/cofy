import { beforeEach, describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import "../../../src/components/form/cofy-object-form.js";
import type { CofyObjectForm } from "../../../src/components/form/cofy-object-form.js";
import { testI18n } from "../../support/i18n.js";

/** A cache's settings - its lifetime basic, how it chunks advanced. */
const cache: JsonSchema = {
  type: "object",
  properties: {
    chunk_size: { type: "string", "x-advanced": true },
    max_age: { type: "string" },
    max_chunks: { type: "integer", "x-advanced": true },
  },
};

async function mountObjectForm(schema: JsonSchema): Promise<CofyObjectForm> {
  const element = document.createElement("cofy-object-form");
  element.i18n = await testI18n();
  element.schema = schema;
  element.root = schema;
  element.value = {};
  document.body.append(element);
  await element.updateComplete;
  return element;
}

/** The fields directly in `parent`'s own stack - not those nested further down. */
function segments(parent: ParentNode): (string | undefined)[] {
  return Array.from(parent.querySelector("div.wa-stack")!.children)
    .filter((child): child is HTMLElement => child.localName === "cofy-any-form")
    .map((field) => field.dataset["segment"]);
}

function advancedSection(element: CofyObjectForm): (HTMLElement & { open: boolean }) | null {
  return element.shadowRoot!.querySelector("wa-details.advanced");
}

describe("cofy-object-form with advanced properties", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("puts the advanced properties in a collapsed section after the basic ones", async () => {
    const element = await mountObjectForm(cache);

    expect(segments(element.shadowRoot!)).toEqual(["max_age"]);
    const section = advancedSection(element)!;
    expect(section.open).toBe(false);
    expect(segments(section)).toEqual(["chunk_size", "max_chunks"]);
  });

  it("starts the section's content with a divider", async () => {
    const element = await mountObjectForm(cache);

    expect(advancedSection(element)!.querySelector("div.wa-stack")!.firstElementChild!.localName).toBe("wa-divider");
  });

  it("has no advanced section when nothing is advanced", async () => {
    const element = await mountObjectForm({ type: "object", properties: { max_age: { type: "string" } } });

    expect(segments(element.shadowRoot!)).toEqual(["max_age"]);
    expect(advancedSection(element)).toBeNull();
  });
});
