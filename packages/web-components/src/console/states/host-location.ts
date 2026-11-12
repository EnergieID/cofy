import { State, stateProperty } from "@dodona/lit-state";

/** What the console asks its host to show, in a `cofy-navigate` event. */
export interface NavigateDetail {
  /** The path as the host shows it, under its prefix: within the community, such as `/secrets`, for one. */
  path: string;
  /** Where that is on the host's site, such as `/w/1/cofy/secrets`. */
  href: string;
}

/**
 * Where the console is on its host's site: the console's paths under *consolePrefix* lie under *hostPrefix* there.
 * The console's own shell puts every path under `/console`; an app embedding it one community's, under a path of its
 * own: `/communities/demo/secrets` is `/w/1/cofy/secrets`.
 *
 * Going somewhere asks the host first, with a cancelable `cofy-navigate` event on *target*: a host that cancels it
 * navigates itself, and {@link show}s the path once it has. One that doesn't is navigated through the history, which
 * is followed on the back button between {@link start} and {@link stop}.
 */
export class HostLocation extends State {
  /** The console's path shown now, such as `/communities/demo/secrets`. */
  @stateProperty public path: string;

  private readonly hostPrefix: string;

  public constructor(
    hostPrefix: string,
    public readonly consolePrefix: string,
    private readonly target: EventTarget,
  ) {
    super();
    // `/w/1/cofy/` is `/w/1/cofy`, as its pages lie under it either way.
    this.hostPrefix = hostPrefix.replace(/\/+$/, "");
    this.path = this.fromHost(window.location.pathname) ?? (consolePrefix || "/");
  }

  /** The path shown now as the host shows it, under its prefix. */
  public get hostPath(): string {
    return this.hostPathOf(this.path);
  }

  /** The console's *path* as the host shows it, under its prefix. */
  public hostPathOf(path: string): string {
    return swap(path, this.consolePrefix, "") ?? path;
  }

  /** Where a link to the console's *path* goes on the host's site. */
  public href(path: string): string {
    return swap(path, this.consolePrefix, this.hostPrefix) ?? `${this.hostPrefix}${path}`;
  }

  /** Go to the console's *path*, asking the host first. */
  public go(path: string): void {
    const detail: NavigateDetail = { path: this.hostPathOf(path), href: this.href(path) };
    const event = new CustomEvent("cofy-navigate", { detail, bubbles: true, composed: true, cancelable: true });
    if (!this.target.dispatchEvent(event)) return;
    window.history.pushState(null, "", detail.href);
    this.path = path;
  }

  /** Go where a link to *pathname* on the host's site leads, if it is one of the console's pages. */
  public follow(pathname: string): boolean {
    const path = this.fromHost(pathname);
    if (path === undefined) return false;
    this.go(path);
    return true;
  }

  /** Show *path*, as the host shows it, once the host navigated to it. */
  public show(path: string): void {
    this.path = swap(path, "", this.consolePrefix)!;
  }

  /** Follow the back button until {@link stop} is called. */
  public start(): void {
    window.addEventListener("popstate", this.onPopState);
  }

  public stop(): void {
    window.removeEventListener("popstate", this.onPopState);
  }

  /** The console's path a host *pathname* shows, if it lies under the host's prefix. */
  private fromHost(pathname: string): string | undefined {
    return swap(pathname, this.hostPrefix, this.consolePrefix);
  }

  private readonly onPopState = (): void => {
    const path = this.fromHost(window.location.pathname);
    if (path !== undefined) this.path = path;
  };
}

/** *path* with the prefix *from* swapped for *to*, if it lies under *from*: `/a/b` from `/a` to `/c` is `/c/b`. */
function swap(path: string, from: string, to: string): string | undefined {
  if (from !== "" && path !== from && !path.startsWith(`${from}/`)) return undefined;
  const rest = path.slice(from.length);
  return `${to}${rest === "/" ? "" : rest}` || "/";
}
