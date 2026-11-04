import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import "../../components/cofy-community-header.js";
import { CofyCommunityPage } from "./cofy-community-page.js";

/** Which types a community may configure - for a system admin. */
@customElement("cofy-community-allowed-page")
export class CofyCommunityAllowedPage extends CofyCommunityPage {
  protected override crumbs(): Crumb[] {
    return this.sectionTrail("allowedTypes");
  }

  protected override content(): TemplateResult {
    // The list carries its own title and toolbar, so the page adds no chrome beyond the community's header.
    return html`
      <cofy-community-header .slug=${this.slug}></cofy-community-header>
      <cofy-allowed-type-list .slug=${this.slug}></cofy-allowed-type-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-community-allowed-page": CofyCommunityAllowedPage;
  }
}
