import { consume } from "@lit/context";
import { CofyElement } from "@cofy/web-components";
import type { Crumb } from "@cofy/web-components";
import type { TOptions } from "i18next";
import type { TemplateResult } from "lit";

import { crumbStateContext, routeStateContext } from "../context.js";
import type { RouteName } from "../routes.js";
import type { CrumbState } from "../states/crumb-state.js";
import type { RouteState } from "../states/route-state.js";
import { APP_NAMESPACE } from "../i18n.js";

/**
 * What every page needs on top of {@link CofyElement}: the route to navigate by, and the trail
 * to publish. Who may see a page is its route's to say, so a page is only ever rendered for
 * someone who may.
 *
 * A subclass renders through {@link content}.
 *
 * A subclass implements {@link crumbs} and is done. They are worked out during each render, so
 * what they read is subscribed to - and loaded - like anything else rendered, and published
 * after it. A subclass overriding `updated` has to call `super.updated()` or its trail stops
 * updating.
 *
 * Pages translate out of the `app` namespace, since `components` belongs to the library.
 */
export abstract class CofyPage extends CofyElement {
  @consume({ context: routeStateContext, subscribe: true })
  public routes!: RouteState<RouteName>;

  @consume({ context: crumbStateContext, subscribe: true })
  public trail!: CrumbState;

  /** The community this page is part of; a page outside any one community has none. */
  declare public slug?: string;

  private trailToPublish: Crumb[] = [];

  /** The page itself, for someone who may see it. */
  protected abstract content(): TemplateResult;

  public override render(): TemplateResult {
    // Published once rendered: setting another state while rendering would update its readers mid-render.
    this.trailToPublish = this.crumbs();
    return this.content();
  }

  /** This page's trail. Worked out while rendering, so it may read stores directly. */
  protected abstract crumbs(): Crumb[];

  /** Translate out of the application's own namespace. */
  protected override t(key: string, options?: TOptions): string {
    return super.t(key, { ns: APP_NAMESPACE, ...options });
  }

  public override updated(): void {
    this.trail?.set(this.trailToPublish);
  }
}
