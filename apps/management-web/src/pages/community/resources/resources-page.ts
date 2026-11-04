import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import "../../../components/cofy-community-header.js";
import { CofyCommunityPage } from "../cofy-community-page.js";

/** A community's resources, and the way to add one. */
@customElement("cofy-resources-page")
export class CofyResourcesPage extends CofyCommunityPage {
  protected override crumbs(): Crumb[] {
    return this.sectionTrail("resources");
  }

  protected override content(): TemplateResult {
    // The list carries its own title and toolbar, so the page adds no chrome beyond the community's header.
    return html`
      <cofy-community-header .slug=${this.slug}></cofy-community-header>
      <cofy-resource-list
        .slug=${this.slug}
        @resource-create=${(): void => this.routes.navigate("newResource", { slug: this.slug })}
        @resource-edit=${(event: CustomEvent<{ slug: string; name: string }>): void =>
          this.routes.navigate("resource", { slug: event.detail.slug, name: event.detail.name })}
      ></cofy-resource-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-resources-page": CofyResourcesPage;
  }
}
