import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "../../../index.js";

import "../../../index.js";

import "../../components/cofy-community-header.js";
import { CofyCommunityPage } from "./cofy-community-page.js";

/** The API tokens other applications call a community's API with. */
@customElement("cofy-tokens-page")
export class CofyTokensPage extends CofyCommunityPage {
  protected override crumbs(): Crumb[] {
    return this.sectionTrail("tokens");
  }

  protected override content(): TemplateResult {
    // The list carries its own title and toolbar, so the page adds no chrome beyond the community's header.
    return html`
      <cofy-community-header .slug=${this.slug}></cofy-community-header>
      <cofy-token-list .slug=${this.slug}></cofy-token-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-tokens-page": CofyTokensPage;
  }
}
