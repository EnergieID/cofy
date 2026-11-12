import { CofyElement, nativeStyles, utilityStyles } from "@cofy/web-components";
import type { TOptions } from "i18next";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";

import { APP_NAMESPACE } from "../i18n.js";

/** Who is logged in, behind a user icon in the header, with the way to log out. */
@customElement("cofy-account-menu")
export class CofyAccountMenu extends CofyElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: inline-block;
      }
      .who {
        padding: var(--wa-space-xs) var(--wa-space-m);
        max-inline-size: 20rem;
      }
      .who > * {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .email {
        color: var(--wa-color-text-quiet);
        font-size: var(--wa-font-size-s);
      }
    `,
  ];

  public override render(): TemplateResult {
    const label = this.t("account.label");
    const me = this.cofy?.session.get();
    return html`
      <wa-dropdown
        placement="bottom-end"
        @wa-select=${(event: CustomEvent<{ item: { value: string } }>): void => {
          if (event.detail.item.value === "logout") this.cofy?.session.logout();
        }}
      >
        <wa-button slot="trigger" appearance="plain" title=${label}>
          <wa-icon name="circle-user" library="cofy" label=${label}></wa-icon>
        </wa-button>
        ${me == null
          ? nothing
          : html`
              <div class="who wa-stack wa-gap-0">
                <strong>${me.name ?? me.email}</strong>
                ${me.name == null ? nothing : html`<span class="email">${me.email}</span>`}
              </div>
              <wa-divider></wa-divider>
            `}
        <wa-dropdown-item value="logout">
          <wa-icon slot="icon" name="right-from-bracket" library="cofy"></wa-icon>
          ${this.t("account.logout")}
        </wa-dropdown-item>
      </wa-dropdown>
    `;
  }

  /** Translate out of the application's own namespace. */
  protected override t(key: string, options?: TOptions): string {
    return super.t(key, { ns: APP_NAMESPACE, ...options });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-account-menu": CofyAccountMenu;
  }
}
