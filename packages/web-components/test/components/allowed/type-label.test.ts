import { beforeEach, describe, expect, it } from "vitest";

import { CofyTypeLabel } from "../../../src/components/allowed/cofy-type-label.js";

async function label(description: string): Promise<CofyTypeLabel> {
  const element = new CofyTypeLabel();
  element.group = "source";
  element.type = "entsoe_day_ahead";
  element.description = description;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("cofy-type-label", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows a type's group and name, and what it is for", async () => {
    const element = await label("Day-ahead prices.");

    const tags = Array.from(element.shadowRoot!.querySelectorAll("wa-tag"), (tag) => tag.textContent);
    expect(tags).toEqual(["source", "entsoe_day_ahead"]);
    expect(element.shadowRoot!.querySelector(".description")!.textContent).toBe("Day-ahead prices.");
  });

  it("leaves out a description the type doesn't give", async () => {
    const element = await label("");

    expect(element.shadowRoot!.querySelector(".description")).toBeNull();
  });
});
