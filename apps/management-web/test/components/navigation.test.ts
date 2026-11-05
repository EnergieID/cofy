import type { Me } from "@cofy/frontend-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { CofyNavigation } from "../../src/components/cofy-navigation.js";
import { MENU_FOOTER_GROUPS, MENU_GROUPS } from "../../src/routes.js";
import { ANN, mount } from "../support/mount.js";

/** Everything to read in a community, but what types it may use. */
const READ_ALL = (["modules", "resources", "secrets", "tokens", "grants"] as const).map((subject) => ({
  action: "read" as const,
  subject,
}));

/** Ann, who may read everything in the communities "foo" and "bar". */
const MEMBER: Me = {
  ...ANN,
  permissions: [
    { slug: "foo", permissions: READ_ALL },
    { slug: "bar", permissions: READ_ALL },
  ],
};

/** Ann, who has only the community "foo". */
const SINGLE: Me = { ...ANN, permissions: [{ slug: "foo", permissions: READ_ALL }] };

const ADMIN: Me = {
  ...ANN,
  system_admin: true,
  permissions: [
    {
      slug: null,
      permissions: [
        { action: "create", subject: "community" },
        { action: "read", subject: "allowed_types" },
      ],
    },
  ],
};

function groups(element: CofyNavigation): [string, string[]][] {
  return Array.from(element.shadowRoot!.querySelectorAll("section")).map((section) => [
    section.querySelector("h2")?.textContent ?? "",
    Array.from(section.querySelectorAll("a")).map((link) => link.textContent.trim()),
  ]);
}

function menu(groups: readonly string[]): CofyNavigation {
  const element = new CofyNavigation();
  element.groups = groups;
  return element;
}

describe("cofy-navigation", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("lists only the communities outside a community, under the General heading", async () => {
    const { element } = await mount(menu(MENU_GROUPS), MEMBER);

    expect(groups(element)).toEqual([["General", ["Communities"]]]);
  });

  it("lists a community's pages inside it, grouped", async () => {
    const { element } = await mount(menu(MENU_GROUPS), MEMBER, "#/communities/foo/secrets");

    expect(groups(element)).toEqual([
      ["General", ["Communities"]],
      ["Configuration", ["Modules", "Resources", "Secrets"]],
      ["Permissions", ["API tokens", "Access"]],
    ]);
    const current = element.shadowRoot!.querySelector("a[aria-current=page]")!;
    expect(current.textContent.trim()).toBe("Secrets");
    expect(current.getAttribute("href")).toBe("#/communities/foo/secrets");
  });

  it("leaves out the communities for whoever has only one, whose home is that one", async () => {
    const { element } = await mount(menu(MENU_GROUPS), SINGLE);

    expect(groups(element)).toEqual([
      ["Configuration", ["Modules", "Resources", "Secrets"]],
      ["Permissions", ["API tokens", "Access"]],
    ]);
    expect(element.shadowRoot!.querySelector("a[aria-current=page]")!.getAttribute("href")).toBe("#/communities/foo");
  });

  it("lists only the groups it is given", async () => {
    const { element } = await mount(menu(MENU_GROUPS), ADMIN, "#/allowed-types");

    expect(groups(element)).toEqual([["General", ["Communities"]]]);
  });

  it("lists the administration for a system admin", async () => {
    const { element } = await mount(menu(MENU_FOOTER_GROUPS), ADMIN, "#/allowed-types");

    expect(element.hidden).toBe(false);
    expect(groups(element)).toEqual([["Administration", ["Allowed types"]]]);
    expect(element.shadowRoot!.querySelector("a[aria-current=page]")!.getAttribute("href")).toBe("#/allowed-types");
  });

  it("hides itself with nothing to list", async () => {
    const { element } = await mount(menu(MENU_FOOTER_GROUPS), MEMBER);

    expect(element.hidden).toBe(true);
  });
});
