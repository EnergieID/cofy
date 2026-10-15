import { consume } from "@lit/context";
import { CofyElement, nativeStyles, utilityStyles } from "@cofy/web-components";
import type { TOptions } from "i18next";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/drawer/drawer.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";
import "@cofy/web-components";

import { routeStateContext } from "../context.js";
import { APP_NAMESPACE } from "../i18n.js";
import type { RouteName } from "../routes.js";
import type { RouteState } from "../states/route-state.js";

/**
 * The console's global settings, behind one header action: who is logged in, logging out, the
 * admin console for whoever may use it, and the language and appearance.
 *
 * They are as global as this console gets, so they live behind one control in the header rather
 * than several, and the drawer leaves room for whatever comes next without another icon.
 *
 * The drawer opens through `<dialog>` and the top layer, so it is not affected by the layout
 * or stacking context of the header it is nested in, and it brings its own focus trap, inert
 * background and focus return.
 */
@customElement("cofy-settings-panel")
export class CofySettingsPanel extends CofyElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: contents;
      }
      .email {
        color: var(--wa-color-text-quiet);
      }
      h2 {
        margin: 0;
      }
    `,
  ];

  @consume({ context: routeStateContext, subscribe: true })
  public routes!: RouteState<RouteName>;

  @state() private open = false;

  public override render(): TemplateResult {
    const label = this.t("settings.open");
    const me = this.cofy?.session.get();

    return html`
      <wa-button id="settings-trigger" appearance="plain" label=${label} @click=${(): void => this.toggle()}>
        <wa-icon name="gear" library="cofy"></wa-icon>
      </wa-button>
      <wa-tooltip for="settings-trigger">${label}</wa-tooltip>

      <wa-drawer
        placement="end"
        label=${label}
        lang=${this.i18n?.resolvedLanguage ?? "en"}
        ?open=${this.open}
        @wa-after-hide=${(): void => {
          this.open = false;
        }}
      >
        <div class="wa-stack">
          ${me == null
            ? nothing
            : html`
                <div class="wa-stack wa-gap-3xs">
                  <strong>${me.name ?? me.email}</strong>
                  ${me.name == null ? nothing : html`<span class="email">${me.email}</span>`}
                </div>
                <a
                  href="#"
                  @click=${(event: Event): void => {
                    event.preventDefault();
                    this.cofy?.session.logout();
                  }}
                  >${this.t("settings.logout")}</a
                >
                <wa-divider></wa-divider>
              `}
          ${this.adminConsole()}
          <cofy-theme-picker></cofy-theme-picker>
          <cofy-locale-picker></cofy-locale-picker>
        </div>
      </wa-drawer>
    `;
  }

  /** The admin console's pages, for whoever may use them. */
  private adminConsole(): TemplateResult | typeof nothing {
    if (!this.routes.allows("typeAvailability")) return nothing;
    return html`
      <section class="wa-stack wa-gap-xs">
        <h2 class="wa-heading-s">${this.t("settings.admin")}</h2>
        <a href=${this.routes.hashFor("typeAvailability")} @click=${(): void => this.close()}>
          ${this.t("settings.allowedTypes")}
        </a>
      </section>
      <wa-divider></wa-divider>
    `;
  }

  /** Translate out of the application's own namespace. */
  protected override t(key: string, options?: TOptions): string {
    return super.t(key, { ns: APP_NAMESPACE, ...options });
  }

  private toggle(): void {
    this.open = !this.open;
  }

  private close(): void {
    this.open = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-settings-panel": CofySettingsPanel;
  }
}
