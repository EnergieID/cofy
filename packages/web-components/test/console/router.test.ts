import { describe, expect, it } from "vitest";
import { html } from "lit";
import type { TemplateResult } from "lit";

import { buildPath, isWithin, paramsFor, matchRoute, type RouteTable } from "../../src/console/router.js";

const routes = {
  communities: { path: "/", render: (): TemplateResult => html`root` },
  modules: { path: "/communities/:slug", render: (): TemplateResult => html`modules` },
  newModule: { path: "/communities/:slug/modules/new", render: (): TemplateResult => html`new` },
  module: { path: "/communities/:slug/modules/:type/:name", render: (): TemplateResult => html`module` },
} satisfies RouteTable;

describe("matchRoute", () => {
  it.each([
    ["/", "communities", {}],
    ["/communities/foo", "modules", { slug: "foo" }],
    ["/communities/foo/modules/new", "newModule", { slug: "foo" }],
    ["/communities/foo/modules/tariff/spot", "module", { slug: "foo", type: "tariff", name: "spot" }],
  ])("matches %s to the %s route", (path, name, params) => {
    const match = matchRoute(routes, path)!;

    expect(match.name).toBe(name);
    expect(match.params).toEqual(params);
  });

  it("prefers a literal segment over a parameter that would also match", () => {
    // `/communities/foo/modules/new` must be the create page, never a module type named "new"
    expect(matchRoute(routes, "/communities/foo/modules/new")!.name).toBe("newModule");
  });

  it("does not match a path with the wrong number of segments", () => {
    expect(matchRoute(routes, "/c")).toBeUndefined();
    expect(matchRoute(routes, "/communities/foo/modules/tariff/spot/extra")).toBeUndefined();
  });

  it("returns nothing when no route claims the path", () => {
    expect(matchRoute(routes, "/nope")).toBeUndefined();
  });

  it("decodes captured segments", () => {
    expect(matchRoute(routes, "/communities/a%2Fb")!.params["slug"]).toBe("a/b");
  });

  it("ignores a trailing slash", () => {
    expect(matchRoute(routes, "/communities/foo/")!.name).toBe("modules");
  });
});

describe("buildPath", () => {
  it("fills parameters", () => {
    expect(buildPath("/communities/:slug/modules/:type/:name", { slug: "foo", type: "tariff", name: "spot" })).toBe(
      "/communities/foo/modules/tariff/spot",
    );
  });

  it("encodes a value that would otherwise add a segment", () => {
    expect(buildPath("/communities/:slug", { slug: "a/b" })).toBe("/communities/a%2Fb");
  });

  it("round trips through matchRoute", () => {
    const params = { slug: "a/b", type: "tariff", name: "spot" };

    const match = matchRoute(routes, buildPath("/communities/:slug/modules/:type/:name", params))!;

    expect(match.params).toEqual(params);
  });

  it("refuses a pattern it cannot fill, rather than producing a broken link", () => {
    expect(() => buildPath("/communities/:slug", {})).toThrow("Missing route parameter");
  });

  it("builds the root path", () => {
    expect(buildPath("/")).toBe("/");
  });
});

describe("paramsFor", () => {
  it("takes the parameters a pattern names, and only those", () => {
    expect(paramsFor("/", { slug: "foo" })).toEqual({});
    expect(paramsFor("/communities/:slug", { slug: "foo", name: "bar" })).toEqual({ slug: "foo" });
  });

  it("gives nothing when a parameter is missing", () => {
    expect(paramsFor("/communities/:slug", {})).toBeUndefined();
    expect(paramsFor("/communities/:slug/modules/:type/:name", { slug: "foo" })).toBeUndefined();
  });
});

describe("isWithin", () => {
  it.each([
    ["/communities/foo", "/communities/foo", true],
    ["/communities/foo/secrets", "/communities/foo", true],
    ["/communities/foo", "/", true],
    ["/communities/foobar", "/communities/foo", false],
    ["/communities/foo", "/communities/foo/secrets", false],
  ])("finds %s within %s: %s", (path, prefix, within) => {
    expect(isWithin(path, prefix)).toBe(within);
  });
});
