import { ProblemError } from "@cofy/frontend-sdk";
import { State, stateProperty } from "@dodona/lit-state";
import { html, type TemplateResult } from "lit";

import { buildHash, matchRoute, pathFromHash, type Access, type RouteParams, type RouteTable } from "../router.js";

/** What a page shows in place of itself to someone who may not see it: what a refused request shows. */
const NO_ACCESS = new ProblemError(403, { status: 403, code: "forbidden" });

/**
 * Where the app is, as observable state.
 *
 * The path is state first and a URL second: the shell renders from {@link path}, and
 * navigating writes the hash so the address bar, the back button and a shared link agree.
 * Pages address routes by name, so no page spells out a path or touches `window.location`.
 *
 * Who may see a page is its route's to say, so a page is never rendered for someone who may not
 * see it, and a link or tab to it can ask the same rule through {@link allows}.
 *
 * Hash routing rather than paths, so the console works when served from any prefix without
 * the host needing rewrite rules - which also rules out `@lit-labs/router`, whose hash
 * support is a known gap and which needs a `URLPattern` polyfill outside Chromium.
 */
export class RouteState<Name extends string = string> extends State {
  @stateProperty public path = "/";

  private readonly routes: RouteTable<Name>;
  private readonly access: Access;

  /** Routes for the person whose *access* their rules ask about. */
  public constructor(routes: RouteTable<Name>, access: Access) {
    super();
    this.routes = routes;
    this.access = access;
    this.path = pathFromHash(window.location.hash);
  }

  /** Follow the address bar until {@link stop} is called. */
  public start(): void {
    window.addEventListener("hashchange", this.onHashChange);
  }

  public stop(): void {
    window.removeEventListener("hashchange", this.onHashChange);
  }

  /** The hash addressing *name*, for a link's `href`. */
  public hashFor(name: Name, params: RouteParams = {}): string {
    return buildHash(this.routes[name].path, params);
  }

  /**
   * Go to *name*.
   *
   * The state is set directly rather than waiting for the browser's `hashchange`, which does
   * not fire when the target hash is the one already shown.
   */
  public navigate(name: Name, params: RouteParams = {}): void {
    const hash = this.hashFor(name, params);
    this.path = pathFromHash(hash);
    if (window.location.hash !== hash) window.location.hash = hash;
  }

  /** Whether the person logged in may see the page *name* is, for *params*. */
  public allows(name: Name, params: RouteParams = {}): boolean {
    return this.routes[name].allows?.(this.access, params) ?? true;
  }

  /** The page for the current path - or why it isn't shown - or `undefined` when no route claims it. */
  public render(): TemplateResult | undefined {
    const match = matchRoute(this.routes, this.path);
    if (match === undefined) return undefined;
    if (!this.allows(match.name, match.params)) {
      return html`<cofy-problem-details .problem=${NO_ACCESS}></cofy-problem-details>`;
    }
    return match.route.render(match.params);
  }

  private readonly onHashChange = (): void => {
    this.path = pathFromHash(window.location.hash);
  };
}
