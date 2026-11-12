import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "../../index.js";

import "../../index.js";

import { CofyPage } from "./cofy-page.js";

/**
 * Home, for someone with no community to go to: what to do about it. Everyone else is sent on to
 * their communities by the route.
 */
@customElement("cofy-home-page")
export class CofyHomePage extends CofyPage {
  public static override styles = css`
    :host {
      display: block;
    }
  `;

  protected override crumbs(): Crumb[] {
    return [];
  }

  protected override content(): TemplateResult {
    return html`
      <cofy-heading>
        <span slot="title">${this.t("home.title")}</span>
        <span slot="description">${this.t("home.noAccess")}</span>
      </cofy-heading>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-home-page": CofyHomePage;
  }
}
