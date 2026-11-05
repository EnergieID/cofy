import { describe, expect, it } from "vitest";

import { matchRoute, type Access } from "../src/router.js";
import { MENU_FOOTER_GROUPS, MENU_GROUPS, routes } from "../src/routes.js";

describe("routes", () => {
  it.each([
    ["/", "home", {}],
    ["/communities", "communities", {}],
    ["/communities/foo", "modules", { slug: "foo" }],
    ["/communities/foo/resources", "resources", { slug: "foo" }],
    ["/communities/foo/secrets", "secrets", { slug: "foo" }],
    ["/communities/foo/tokens", "tokens", { slug: "foo" }],
    ["/communities/foo/allowed-types", "allowedTypes", { slug: "foo" }],
    ["/allowed-types", "typeAvailability", {}],
    ["/communities/foo/resources/new", "newResource", { slug: "foo" }],
    ["/communities/foo/resources/entsoe_key", "resource", { slug: "foo", name: "entsoe_key" }],
    ["/communities/foo/modules/tariff/spot", "module", { slug: "foo", type: "tariff", name: "spot" }],
  ])("matches %s to the %s page", (path, name, params) => {
    const match = matchRoute(routes, path)!;

    expect(match.name).toBe(name);
    expect(match.params).toEqual(params);
  });

  it.each([
    ["typeAvailability", {}, "read", "allowed_types", null],
    ["modules", { slug: "foo" }, "read", "modules", "foo"],
    ["module", { slug: "foo", type: "tariff", name: "spot" }, "read", "modules", "foo"],
    ["newModule", { slug: "foo" }, "create", "modules", "foo"],
    ["resources", { slug: "foo" }, "read", "resources", "foo"],
    ["resource", { slug: "foo", name: "day_ahead" }, "read", "resources", "foo"],
    ["newResource", { slug: "foo" }, "create", "resources", "foo"],
    ["secrets", { slug: "foo" }, "read", "secrets", "foo"],
    ["tokens", { slug: "foo" }, "read", "tokens", "foo"],
    ["grants", { slug: "foo" }, "read", "grants", "foo"],
    ["allowedTypes", { slug: "foo" }, "update", "allowed_types", "foo"],
  ] as const)("lets %s be seen by whoever may %s %s", (name, params, action, subject, slug) => {
    const asked: unknown[] = [];
    const access: Access = {
      get: () => undefined,
      can: (...args) => {
        asked.push(args);
        return false;
      },
    };

    expect(routes[name].allows(access, params)).toBe(false);
    expect(asked).toEqual([[action, subject, slug]]);
  });

  describe("home", () => {
    /** Someone with a role in *slugs*, who may create communities if *creates*. */
    function person(slugs: string[], creates = false): Access {
      const me = {
        email: "ann@example.com",
        name: null,
        system_admin: false,
        permissions: slugs.map((slug) => ({ slug, permissions: [] })),
      };
      return { get: () => me, can: (action, subject, slug) => creates && action === "create" && subject === "community" && slug === null };
    }

    it("is the one community of whoever has only that one, who has no list to pick from", () => {
      expect(routes.home.redirect(person(["demo"]))).toBe("/communities/demo");
      expect(routes.communities.allows(person(["demo"]))).toBe(false);
    });

    it("is the list for whoever has several", () => {
      expect(routes.home.redirect(person(["demo", "evo"]))).toBe("/communities");
      expect(routes.communities.allows(person(["demo", "evo"]))).toBe(true);
    });

    it("is the list for whoever may create a community, with one or none", () => {
      expect(routes.home.redirect(person(["demo"], true))).toBe("/communities");
      expect(routes.home.redirect(person([], true))).toBe("/communities");
      expect(routes.communities.allows(person([], true))).toBe(true);
    });

    it("is itself for whoever has no community at all", () => {
      expect(routes.home.redirect(person([]))).toBeUndefined();
      expect(routes.communities.allows(person([]))).toBe(false);
    });
  });

  it("files every page the menu lists under one of its groups", () => {
    const groups = Object.values(routes).flatMap((route) => ("menu" in route ? [route.menu.group] : []));

    const known: readonly string[] = [...MENU_GROUPS, ...MENU_FOOTER_GROUPS];

    expect(groups.filter((group) => !known.includes(group))).toEqual([]);
  });
});
