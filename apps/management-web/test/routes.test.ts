import { describe, expect, it } from "vitest";

import { matchRoute, type Access } from "../src/router.js";
import { routes } from "../src/routes.js";

describe("routes", () => {
  it.each([
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
    ["newModule", { slug: "foo" }, "write", "modules", "foo"],
    ["resources", { slug: "foo" }, "read", "resources", "foo"],
    ["resource", { slug: "foo", name: "day_ahead" }, "read", "resources", "foo"],
    ["newResource", { slug: "foo" }, "write", "resources", "foo"],
    ["secrets", { slug: "foo" }, "read", "secrets", "foo"],
    ["tokens", { slug: "foo" }, "read", "tokens", "foo"],
    ["grants", { slug: "foo" }, "read", "grants", "foo"],
    ["allowedTypes", { slug: "foo" }, "write", "allowed_types", "foo"],
  ] as const)("lets %s be seen by whoever may %s %s", (name, params, action, subject, slug) => {
    const asked: unknown[] = [];
    const access: Access = {
      can: (...args) => {
        asked.push(args);
        return false;
      },
    };

    expect(routes[name].allows(access, params)).toBe(false);
    expect(asked).toEqual([[action, subject, slug]]);
  });

  it("lets anyone logged in see the communities", () => {
    expect("allows" in routes.communities).toBe(false);
  });
});
