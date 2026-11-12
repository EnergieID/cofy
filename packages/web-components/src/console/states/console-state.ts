import type { CofyStore } from "@cofy/frontend-sdk";
import type { CofyI18n } from "../../index.js";
import { State, stateProperty, type Unsubscribe } from "@dodona/lit-state";

import { CONSOLE_NAMESPACE } from "../i18n.js";
import { isWithin } from "../router.js";
import { routes, type RouteName } from "../routes.js";
import { CrumbState } from "./crumb-state.js";
import { HostLocation } from "./host-location.js";
import { RouteState } from "./route-state.js";

/** A page as a host lists it in its menu. */
export interface ConsoleMenuItem {
  name: RouteName;
  /** The group it belongs to, such as `configuration`. */
  group: string;
  /** Its label, in the console's language. */
  label: string;
  /** An icon of the `cofy` icon library, which importing the console registers, or a name for a host's own. */
  icon: string;
  /** Its path as the host shows it, under the base: within the community, such as `/secrets`, for one. */
  path: string;
  /** Where it is on the host's site, such as `/w/1/cofy/secrets`. */
  href: string;
  /** Whether the page showing is this one, or one reached from it. */
  current: boolean;
}

export interface ConsoleStateOptions {
  /** The stores the pages read and write. */
  store: CofyStore;
  /** Where the host shows the console, such as `/w/1/cofy`. */
  base: string;
  /** The community shown, by slug; without one, every page is. */
  community?: string;
  /** Where to ask the host to navigate, with a `cofy-navigate` event. */
  target: EventTarget;
  /** The translations the menu is labelled in. */
  i18n: CofyI18n;
}

/**
 * The console's state beside its stores: where it is, its pages, the trail to the page showing, and the menu - for
 * `<cofy-console>` to show the page, and for its host to draw anything around it, such as the menu or the trail.
 *
 * Its parts are lit-state, so a Lit host renders from them as from the stores. Any other host subscribes to the console
 * state itself: once started, it passes on every change of its parts - its location, trail, session and translations -
 * as its own, under the part's name.
 */
export class ConsoleState extends State {
  /** The translations the menu is labelled in. */
  @stateProperty public i18n: CofyI18n;

  public readonly store: CofyStore;
  public readonly location: HostLocation;
  public readonly routes: RouteState<RouteName>;
  public readonly crumbs = new CrumbState();

  private relays: Unsubscribe[] = [];
  private translationsRelay?: Unsubscribe;

  public constructor(options: ConsoleStateOptions) {
    super();
    this.store = options.store;
    this.i18n = options.i18n;
    const inside = options.community === undefined ? "" : `/communities/${encodeURIComponent(options.community)}`;
    this.location = new HostLocation(options.base, inside, options.target);
    this.routes = new RouteState(routes, options.store.session, this.location);
  }

  /** Follow the back button, and pass on its parts' changes, until {@link stop} is called. */
  public start(): void {
    this.location.start();
    this.relays = [
      this.location.subscribe(() => this.dispatchStateEvent("location")),
      this.crumbs.subscribe(() => this.dispatchStateEvent("crumbs")),
      this.store.session.subscribe(() => this.dispatchStateEvent("session")),
      // Translations replaced after it starts.
      this.subscribe(() => this.relayTranslations(), "i18n"),
    ];
    this.relayTranslations();
  }

  public stop(): void {
    this.location.stop();
    for (const relay of this.relays) relay();
    this.relays = [];
    this.translationsRelay?.();
  }

  /** Show *path*, as the host shows it, under the base: once the host navigated to it. */
  public show(path: string): void {
    this.location.show(path);
  }

  /** The pages the person logged in may see from where they are, in the community if the console is inside one. */
  public menu(): ConsoleMenuItem[] {
    const inside = this.location.consolePrefix || "/";
    return this.routes
      .menu()
      .filter((item) => isWithin(item.path, inside))
      .map((item) => ({
        name: item.name,
        group: item.group,
        label: this.i18n.t(`menu.items.${item.name}`, { ns: CONSOLE_NAMESPACE }),
        icon: item.icon,
        path: this.location.hostPathOf(item.path),
        href: item.href,
        current: item.current,
      }));
  }

  private relayTranslations(): void {
    this.translationsRelay?.();
    this.translationsRelay = this.i18n.subscribe(() => this.dispatchStateEvent("i18n"));
  }
}
