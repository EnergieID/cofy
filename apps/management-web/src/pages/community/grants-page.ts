import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import "../../components/cofy-community-header.js";
import { CofyCommunityPage } from "./cofy-community-page.js";

/** Who may manage a community. */
@customElement("cofy-grants-page")
export class CofyGrantsPage extends CofyCommunityPage {
  protected override crumbs(): Crumb[] {
    return this.sectionTrail("grants");
  }

  protected override content(): TemplateResult {
    // The list carries its own title and toolbar, so the page adds no chrome beyond the community's header.
    return html`
      <cofy-community-header .slug=${this.slug}></cofy-community-header>
      <cofy-grant-list .slug=${this.slug}></cofy-grant-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-grants-page": CofyGrantsPage;
  }
}
