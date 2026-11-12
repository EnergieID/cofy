import { ProblemError } from "@cofy/frontend-sdk";
import { html, type TemplateResult } from "lit";

import {
  buildPath,
  isWithin,
  matchRoute,
  paramsFor,
  type Access,
  type RouteMatch,
  type RouteParams,
  type RouteTable,
} from "../router.js";
import type { HostLocation } from "./host-location.js";

/** What a page shows in place of itself to someone who may not see it: what a refused request shows. */
const NO_ACCESS = new ProblemError(403, { status: 403, code: "forbidden" });

/** A page as the menu lists it. */
export interface MenuItem<Name extends string = string> {
  name: Name;
  group: string;
  icon: string;
  /** Its path, such as `/communities/foo/secrets`. */
  path: string;
  /** What a link to it takes as its `href`. */
  href: string;
  /** Whether the page showing is this one, or one reached from it. */
  current: boolean;
}

/**
 * The console's pages, at the path its {@link HostLocation} keeps: which one shows, which the menu lists, and where a
 * link to one goes. Pages address routes by name, so no page spells out a path or touches `window.location`.
 *
 * Who may see a page is its route's to say, so a page is never rendered for someone who may not
 * see it, and a link or tab to it can ask the same rule through {@link allows}.
 *
 * Not `@lit-labs/router`, which knows nothing of a host's base path, or of a host that routes itself.
 */
export class RouteState<Name extends string = string> {
  private readonly routes: RouteTable<Name>;
  private readonly access: Access;
  private readonly location: HostLocation;

  /** Routes for the person whose *access* their rules ask about, at *location*. */
  public constructor(routes: RouteTable<Name>, access: Access, location: HostLocation) {
    this.routes = routes;
    this.access = access;
    this.location = location;
  }

  /** The path shown, which the location keeps, reactively. */
  public get path(): string {
    return this.location.path;
  }

  /** Where a link to *name* goes, for its `href`. */
  public hrefFor(name: Name, params: RouteParams = {}): string {
    return this.location.href(buildPath(this.routes[name].path, params));
  }

  /** Go to *name*, asking the host first. */
  public navigate(name: Name, params: RouteParams = {}): void {
    this.location.go(buildPath(this.routes[name].path, params));
  }

  /** Whether the person logged in may see the page *name* is, for *params*. */
  public allows(name: Name, params: RouteParams = {}): boolean {
    return this.routes[name].allows?.(this.access, params) ?? true;
  }

  /** The route the current path matches, with what it captured - after the route's redirect, if it has one. */
  public match(): RouteMatch<Name> | undefined {
    return matchRoute(this.routes, this.shown());
  }

  /** The path whose page is shown: the current one, or where its route sends the person logged in. */
  private shown(): string {
    return matchRoute(this.routes, this.path)?.route.redirect?.(this.access) ?? this.path;
  }

  /**
   * The pages the menu lists from here, in declaration order: those with a place in the menu
   * that the current path's parameters can address - a community's pages only inside one - and
   * that the person logged in may see.
   */
  public menu(): MenuItem<Name>[] {
    const params = this.match()?.params ?? {};
    const listed = (Object.keys(this.routes) as Name[]).flatMap((name) => {
      const route = this.routes[name];
      const own = paramsFor(route.path, params);
      if (route.menu === undefined || own === undefined || !this.allows(name, own)) return [];
      return [{ name, menu: route.menu, path: buildPath(route.path, own) }];
    });
    // The page showing belongs to the listed one its path lies deepest within: a module's editor to the modules.
    const current = listed
      .filter((item) => isWithin(this.shown(), item.path))
      .sort((a, b) => b.path.length - a.path.length)[0];

    return listed.map((item) => ({
      name: item.name,
      group: item.menu.group,
      icon: item.menu.icon,
      path: item.path,
      href: this.location.href(item.path),
      current: item === current,
    }));
  }

  /** The page for the current path - or why it isn't shown - or `undefined` when no route claims it. */
  public render(): TemplateResult | undefined {
    const match = this.match();
    if (match === undefined) return undefined;
    if (!this.allows(match.name, match.params)) {
      return html`<cofy-problem-details .problem=${NO_ACCESS}></cofy-problem-details>`;
    }
    return match.route.render(match.params);
  }
}
