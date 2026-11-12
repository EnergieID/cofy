import type { SessionStore } from "@cofy/frontend-sdk";
import type { TemplateResult } from "lit";

/** The values a path's `:name` segments captured. */
export type RouteParams = Record<string, string>;

/** What a route's rules ask of who is logged in: what they may do, and where. */
export type Access = Pick<SessionStore, "can" | "get">;

/** Where a page is listed in the menu: under which group, with which icon. */
export interface MenuEntry {
  group: string;
  /** An icon of the `cofy` icon library, see `icons.ts`. */
  icon: string;
}

/**
 * One route.
 *
 * The shape follows `@lit-labs/router`'s route config: a path pattern, and a render function
 * taking the captured parameters - and, beside them, who may see it and where the menu lists it.
 */
export interface RouteDefinition {
  /** A pattern such as `/communities/:slug/modules/:type/:name`. Segments starting with `:` capture. */
  path: string;
  render: (params: RouteParams) => TemplateResult;
  /** Whether the person logged in may see the page; anyone logged in may, without a rule. */
  allows?: (access: Access, params: RouteParams) => boolean;
  /** The page's place in the menu; a page reached only from another one has none. */
  menu?: MenuEntry;
  /** Another path to show instead, for some: their own home, say. Without one, or when it gives none, this page shows. */
  redirect?: (access: Access) => string | undefined;
}

/** A set of routes, keyed by name. */
export type RouteTable<Name extends string = string> = Record<Name, RouteDefinition>;

export interface RouteMatch<Name extends string = string> {
  name: Name;
  route: RouteDefinition;
  params: RouteParams;
}

/**
 * The first route in *routes* whose pattern matches *path*.
 *
 * Matching is by declaration order, so a pattern with a literal segment has to be declared
 * before one whose parameter would also match it.
 */
export function matchRoute<Name extends string>(
  routes: RouteTable<Name>,
  path: string,
): RouteMatch<Name> | undefined {
  const segments = split(path);

  for (const [name, route] of Object.entries<RouteDefinition>(routes)) {
    const params = matchPattern(route.path, segments);
    if (params !== undefined) return { name: name as Name, route, params };
  }
  return undefined;
}

/**
 * The parameters *pattern* names, taken from *params* - or `undefined` when one is missing.
 *
 * Only those: a rule asking about a page outside any community must not be answered for the
 * community the reader happens to be in.
 */
export function paramsFor(pattern: string, params: RouteParams): RouteParams | undefined {
  const own: RouteParams = {};
  for (const segment of split(pattern).filter((part) => part.startsWith(":"))) {
    const value = params[segment.slice(1)];
    if (value === undefined) return undefined;
    own[segment.slice(1)] = value;
  }
  return own;
}

/** Whether *path* is *prefix* or lies under it, segment by segment: `/communities/foo/secrets` lies under `/communities/foo`. */
export function isWithin(path: string, prefix: string): boolean {
  const segments = split(path);
  return split(prefix).every((segment, index) => segments[index] === segment);
}

/** Fill a pattern's parameters, e.g. `/communities/:slug` with `{slug: "foo"}` gives `/communities/foo`. */
export function buildPath(pattern: string, params: RouteParams = {}): string {
  const filled = split(pattern).map((segment) => {
    if (!segment.startsWith(":")) return segment;

    const value = params[segment.slice(1)];
    if (value === undefined) throw new Error(`Missing route parameter ${segment} for ${pattern}`);
    return encodeURIComponent(value);
  });
  return `/${filled.join("/")}`;
}

function matchPattern(pattern: string, segments: string[]): RouteParams | undefined {
  const expected = split(pattern);
  if (expected.length !== segments.length) return undefined;

  const params: RouteParams = {};
  for (const [index, part] of expected.entries()) {
    const actual = segments[index]!;
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(actual);
    else if (part !== actual) return undefined;
  }
  return params;
}

function split(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}
