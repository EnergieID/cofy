import { beforeEach, describe, expect, it, vi } from "vitest";

import { CofyAccountMenu } from "../../src/components/cofy-account-menu.js";
import { ANN, mount } from "../support/mount.js";

function summaryOf(element: HTMLElement): string {
  return element.shadowRoot!.querySelector(".who")!.textContent.replace(/\s+/g, " ").trim();
}

describe("cofy-account-menu", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows who is logged in behind a user icon", async () => {
    const { element } = await mount(new CofyAccountMenu(), ANN);

    expect(element.shadowRoot!.querySelector("[slot=trigger] wa-icon")!.getAttribute("label")).toBe("Your account");
    expect(summaryOf(element)).toBe("Ann Peeters ann@example.com");
  });

  it("logs out when that is picked", async () => {
    const { element, cofy } = await mount(new CofyAccountMenu(), ANN);
    const logout = vi.spyOn(cofy.session, "logout").mockImplementation(() => {});

    const item = element.shadowRoot!.querySelector("wa-dropdown-item[value=logout]")!;
    expect(item.textContent.trim()).toBe("Log out");
    element.shadowRoot!.querySelector("wa-dropdown")!.dispatchEvent(new CustomEvent("wa-select", { detail: { item } }));

    expect(logout).toHaveBeenCalled();
  });
});
