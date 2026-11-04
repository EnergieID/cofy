import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { html } from "lit";
import type { TemplateResult } from "lit";

import { RouteState } from "../../src/states/route-state.js";
import type { Access, RouteTable } from "../../src/router.js";

const routes = {
  communities: { path: "/", render: (): TemplateResult => html`<p>root</p>` },
  modules: {
    path: "/communities/:slug",
    render: ({ slug }): TemplateResult => html`<p>modules ${slug}</p>`,
    allows: (access: Access, { slug }): boolean => access.can("read", "community", slug ?? null),
  },
} satisfies RouteTable;

/** Someone who may see the community "foo", and nothing else. */
const access: Access = { can: (_action, _subject, slug) => slug === "foo" };

describe("RouteState", () => {
  let state: RouteState;

  beforeEach(() => {
    window.location.hash = "";
    state = new RouteState(routes, access);
    state.start();
  });

  afterEach(() => {
    state.stop();
  });

  it("starts from the address bar", () => {
    window.location.hash = "#/communities/foo";

    expect(new RouteState(routes, access).path).toBe("/communities/foo");
  });

  it("defaults to the root path", () => {
    expect(state.path).toBe("/");
  });

  it("writes the hash when navigating, so the address bar and back button agree", () => {
    state.navigate("modules", { slug: "foo" });

    expect(window.location.hash).toBe("#/communities/foo");
    expect(state.path).toBe("/communities/foo");
  });

  it("updates state even when the hash is already what it would set", () => {
    // `hashchange` does not fire for a no-op assignment, so the state cannot wait for it
    window.location.hash = "#/communities/foo";
    state.navigate("modules", { slug: "foo" });

    expect(state.path).toBe("/communities/foo");
  });

  it("follows the address bar changing underneath it", async () => {
    window.location.hash = "#/communities/bar";
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.path).toBe("/communities/bar");
  });

  it("stops following once stopped", async () => {
    state.stop();
    window.location.hash = "#/communities/bar";
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.path).toBe("/");
  });

  it("notifies subscribers when the path changes", () => {
    const seen: (string | undefined)[] = [];
    state.subscribe((_s, key) => seen.push(key));

    state.navigate("modules", { slug: "foo" });

    expect(seen).toContain("path");
  });

  it("builds a hash for a named route, so a link never spells out a path", () => {
    expect(state.hashFor("modules", { slug: "foo" })).toBe("#/communities/foo");
  });

  it("renders the matching route with its parameters", () => {
    state.navigate("modules", { slug: "foo" });

    expect(JSON.stringify(state.render()!.values)).toContain("foo");
  });

  it("says so when no route claims the path", () => {
    window.location.hash = "#/nope";
    const orphan = new RouteState(routes, access);

    expect(orphan.render()).toBeUndefined();
  });

  it("tells whether a route's page may be seen, as its rule says, and lets anyone see one without", () => {
    expect(state.allows("modules", { slug: "foo" })).toBe(true);
    expect(state.allows("modules", { slug: "bar" })).toBe(false);
    expect(state.allows("communities")).toBe(true);
  });

  it("shows a page that may not be seen as refused, rather than rendering it", () => {
    state.navigate("modules", { slug: "bar" });

    const rendered = JSON.stringify(state.render()!.values);
    expect(rendered).toContain("403");
    expect(rendered).not.toContain("modules");
  });

  describe("menu", () => {
    const menuRoutes = {
      communities: { path: "/", render: (): TemplateResult => html`root`, menu: { group: "top", icon: "home" } },
      admin: {
        path: "/admin",
        render: (): TemplateResult => html`admin`,
        // As the console's own rules do: about the community in the parameters, or none without one.
        allows: (access: Access, { slug }): boolean => access.can("read", "allowed_types", slug ?? null),
        menu: { group: "admin", icon: "sliders" },
      },
      modules: { path: "/communities/:slug", render: (): TemplateResult => html`modules`, menu: { group: "community", icon: "cubes" } },
      secrets: {
        path: "/communities/:slug/secrets",
        render: (): TemplateResult => html`secrets`,
        menu: { group: "community", icon: "lock" },
      },
      module: { path: "/communities/:slug/modules/:type/:name", render: (): TemplateResult => html`module` },
    } satisfies RouteTable;

    function menuAt(hash: string): ReturnType<RouteState["menu"]> {
      window.location.hash = hash;
      return new RouteState(menuRoutes, access).menu();
    }

    it("lists the pages with a place in it that may be seen, leaving out a community's outside one", () => {
      expect(menuAt("#/").map((item) => item.name)).toEqual(["communities"]);
    });

    it("lists a community's pages inside it, addressed to it", () => {
      const items = menuAt("#/communities/foo");

      expect(items.map((item) => [item.name, item.group, item.icon, item.hash])).toEqual([
        ["communities", "top", "home", "#/"],
        ["modules", "community", "cubes", "#/communities/foo"],
        ["secrets", "community", "lock", "#/communities/foo/secrets"],
      ]);
    });

    it("marks the page showing as current", () => {
      expect(menuAt("#/communities/foo/secrets").filter((item) => item.current).map((item) => item.name)).toEqual([
        "secrets",
      ]);
    });

    it("marks the page a page off the menu is reached from as current", () => {
      const current = menuAt("#/communities/foo/modules/tariff/spot").filter((item) => item.current);

      expect(current.map((item) => item.name)).toEqual(["modules"]);
    });

    it("asks a page's rule only about the parameters its own path has", () => {
      // Inside "foo" only: may read allowed types there, but not outside any community.
      expect(menuAt("#/communities/foo").map((item) => item.name)).not.toContain("admin");
    });

    it("leaves out a page its rule refuses", () => {
      expect(menuAt("#/communities/bar").map((item) => item.name)).toEqual(["communities", "modules", "secrets"]);
      const admin = new RouteState(menuRoutes, { can: (): boolean => true });
      expect(admin.menu().map((item) => item.name)).toContain("admin");
    });
  });
});
