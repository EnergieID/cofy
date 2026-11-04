import { consume } from "@lit/context";
import { CofyElement, nativeStyles, utilityStyles } from "@cofy/web-components";
import type { TOptions } from "i18next";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import "@awesome.me/webawesome/dist/components/icon/icon.js";

import { routeStateContext } from "../context.js";
import { APP_NAMESPACE } from "../i18n.js";
import { MENU_GROUPS, type RouteName } from "../routes.js";
import type { MenuItem, RouteState } from "../states/route-state.js";

/**
 * A part of the menu down the side of the console: the pages the routes list in *groups*, for
 * where the reader is and what they may see. With nothing to list, it hides itself.
 */
@customElement("cofy-navigation")
export class CofyNavigation extends CofyElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      h2 {
        margin: 0;
        padding-inline: var(--wa-space-s);
        color: var(--wa-color-text-quiet);
        font-size: var(--wa-font-size-xs);
        font-weight: var(--wa-font-weight-semibold);
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      a {
        padding: var(--wa-space-xs) var(--wa-space-s);
        border-radius: var(--wa-border-radius-m);
        color: var(--wa-color-text-normal);
        text-decoration: none;
      }
      a:hover {
        background: var(--wa-color-neutral-fill-quiet);
      }
      a[aria-current="page"] {
        background: var(--wa-color-brand-fill-quiet);
        color: var(--wa-color-brand-on-quiet);
        font-weight: var(--wa-font-weight-semibold);
      }
      a wa-icon {
        inline-size: 1.25em;
        color: var(--wa-color-text-quiet);
      }
      a[aria-current="page"] wa-icon {
        color: inherit;
      }
    `,
  ];

  @consume({ context: routeStateContext, subscribe: true })
  public routes!: RouteState<RouteName>;

  /** The groups to list, in order. */
  @property({ attribute: false }) public groups: readonly string[] = [];

  public override willUpdate(): void {
    this.hidden = this.listed().length === 0;
  }

  public override render(): TemplateResult {
    const items = this.listed();
    return html`
      <nav class="wa-stack wa-gap-l" aria-label=${this.t("menu.label")}>
        ${repeat(
          this.groups,
          (group) => group,
          (group) => this.group(group, items),
        )}
      </nav>
    `;
  }

  private listed(): MenuItem<RouteName>[] {
    return this.routes.menu().filter((item) => this.groups.includes(item.group));
  }

  private group(group: string, items: MenuItem<RouteName>[]): TemplateResult | typeof nothing {
    const listed = items.filter((item) => item.group === group);
    if (listed.length === 0) return nothing;
    return html`
      <section class="wa-stack wa-gap-3xs">
        ${group === MENU_GROUPS[0] ? nothing : html`<h2>${this.t(`menu.groups.${group}`)}</h2>`}
        ${repeat(
          listed,
          (item) => item.name,
          (item) => html`
            <a
              class="wa-cluster wa-gap-s"
              href=${item.hash}
              aria-current=${item.current ? "page" : nothing}
            >
              <wa-icon name=${item.icon}></wa-icon>${this.t(`menu.items.${item.name}`)}
            </a>
          `,
        )}
      </section>
    `;
  }

  /** Translate out of the application's own namespace. */
  protected override t(key: string, options?: TOptions): string {
    return super.t(key, { ns: APP_NAMESPACE, ...options });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-navigation": CofyNavigation;
  }
}
