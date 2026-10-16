import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@cofy/frontend-sdk";

import { CofyStringForm } from "../../../src/components/form/cofy-string-form.js";

async function mount(schema: JsonSchema): Promise<HTMLElement> {
  const element = new CofyStringForm();
  element.schema = schema;
  element.root = schema;
  element.pointer = "/name";
  element.value = "spot";
  document.body.append(element);
  await element.updateComplete;
  return element.shadowRoot!.querySelector<HTMLElement>("wa-input")!;
}

describe("cofy-string-form", () => {
  it("holds its input to the length and pattern its schema accepts", async () => {
    const input = await mount({ type: "string", minLength: 1, maxLength: 20, pattern: "^[a-z_-]+$" });

    expect(input.getAttribute("minlength")).toBe("1");
    expect(input.getAttribute("maxlength")).toBe("20");
    expect(input.getAttribute("pattern")).toBe("[\\s\\S]*(?:^[a-z_\\-]+$)[\\s\\S]*");
  });

  it("sets none of them where its schema has none", async () => {
    const input = await mount({ type: "string" });

    expect(["minlength", "maxlength", "pattern"].filter((name) => input.hasAttribute(name))).toEqual([]);
  });
});
