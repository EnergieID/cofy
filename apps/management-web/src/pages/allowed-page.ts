import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import { CofyPage } from "./cofy-page.js";

/** Which communities may use each type - for a system admin. */
@customElement("cofy-allowed-page")
export class CofyAllowedPage extends CofyPage {
  public static override styles = css`
    :host {
      display: block;
    }
  `;

  protected override crumbs(): Crumb[] {
    return [{ label: this.t("allowed.crumb") }];
  }

  protected override content(): TemplateResult {
    // The table carries its own title, so the page adds no chrome of its own.
    return html`<cofy-availability-list></cofy-availability-list>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-allowed-page": CofyAllowedPage;
  }
}
