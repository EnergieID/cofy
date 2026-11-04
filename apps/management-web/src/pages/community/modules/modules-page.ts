import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import "../../../components/cofy-community-header.js";
import { CofyCommunityPage } from "../cofy-community-page.js";

/** A community's modules, and the way to add one. */
@customElement("cofy-modules-page")
export class CofyModulesPage extends CofyCommunityPage {
  protected override crumbs(): Crumb[] {
    return this.sectionTrail("modules");
  }

  protected override content(): TemplateResult {
    // The list carries its own title and toolbar, so the page adds no chrome beyond the community's header.
    return html`
      <cofy-community-header .slug=${this.slug}></cofy-community-header>
      <cofy-module-list
        .slug=${this.slug}
        @module-create=${(): void => this.routes.navigate("newModule", { slug: this.slug })}
        @module-edit=${(event: CustomEvent<{ slug: string; id: { type: string; name: string } }>): void =>
          this.routes.navigate("module", {
            slug: event.detail.slug,
            type: event.detail.id.type,
            name: event.detail.id.name,
          })}
      ></cofy-module-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-modules-page": CofyModulesPage;
  }
}
