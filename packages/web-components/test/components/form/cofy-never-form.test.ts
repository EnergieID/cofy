import { describe, expect, it } from "vitest";
import { ContextProvider } from "@lit/context";

import { CofyNeverForm } from "../../../src/components/form/cofy-never-form.js";
import { i18nContext } from "../../../src/context.js";
import { testI18n } from "../../support/i18n.js";

describe("cofy-never-form", () => {
  it("says the field isn't available as its only error, under its label, instead of offering a control", async () => {
    const host = document.createElement("div");
    new ContextProvider(host, { context: i18nContext, initialValue: await testI18n() });
    document.body.append(host);
    const element = new CofyNeverForm();
    element.schema = { not: {} };
    element.label = "Tariff";
    element.pointer = "/tariff";
    // What a validator reports about a value nothing is valid against, which explains less.
    element.issues = [{ pointer: "/tariff", message: 'Instance matched "not" schema.', keyword: "not" }];
    host.append(element);
    await element.updateComplete;

    const shell = element.shadowRoot!.querySelector("cofy-field-shell")!;
    expect(shell.getAttribute("label")).toBe("Tariff");
    expect(shell.issues).toEqual([
      { message: "No valid options available for this community. Contact a system administrator." },
    ]);
    expect(element.shadowRoot!.querySelector("input, wa-input, wa-select")).toBeNull();
  });
});
