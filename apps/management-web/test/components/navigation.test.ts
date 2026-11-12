import { beforeEach, describe, expect, it } from "vitest";

import type { ConsoleMenuItem } from "@cofy/web-components/console";
import { CofyNavigation } from "../../src/components/cofy-navigation.js";
import { MENU_FOOTER_GROUPS, MENU_GROUPS } from "@cofy/web-components/console";
import { ANN, mount } from "../support/mount.js";

function item(name: ConsoleMenuItem["name"], group: string, label: string, current = false): ConsoleMenuItem {
  const path = `/communities/foo/${name}`;
  return { name, group, label, icon: "lock", path, href: path, current };
}

/** Inside a community, on its secrets. */
const ITEMS = [
  item("communities", "console", "Communities"),
  item("secrets", "configuration", "Secrets", true),
  item("grants", "permissions", "Access"),
  item("typeAvailability", "administration", "Allowed types"),
];

function groups(element: CofyNavigation): [string, string[]][] {
  return Array.from(element.shadowRoot!.querySelectorAll("section")).map((section) => [
    section.querySelector("h2")?.textContent ?? "",
    Array.from(section.querySelectorAll("a")).map((link) => link.textContent.trim()),
  ]);
}

function menu(groups: readonly string[], items: ConsoleMenuItem[] = ITEMS): CofyNavigation {
  const element = new CofyNavigation();
  element.groups = groups;
  element.items = items;
  return element;
}

describe("cofy-navigation", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("lists the items of its groups under their headings, in its order", async () => {
    const { element } = await mount(menu(MENU_GROUPS), ANN);

    expect(groups(element)).toEqual([
      ["General", ["Communities"]],
      ["Configuration", ["Secrets"]],
      ["Permissions", ["Access"]],
    ]);
  });

  it("marks the item showing, linked where the console says it is", async () => {
    const { element } = await mount(menu(MENU_GROUPS), ANN);

    const current = element.shadowRoot!.querySelector("a[aria-current=page]")!;
    expect(current.textContent.trim()).toBe("Secrets");
    expect(current.getAttribute("href")).toBe("/communities/foo/secrets");
  });

  it("lists only the groups it is given", async () => {
    const { element } = await mount(menu(MENU_FOOTER_GROUPS), ANN);

    expect(groups(element)).toEqual([["Administration", ["Allowed types"]]]);
  });

  it("hides itself with nothing to list", async () => {
    const { element } = await mount(menu(MENU_FOOTER_GROUPS, ITEMS.slice(0, 2)), ANN);

    expect(element.hidden).toBe(true);
  });
});
