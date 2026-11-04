import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import "@cofy/web-components";

import { CofyCommunityPage } from "../cofy-community-page.js";

/** One resource, edited in place. */
@customElement("cofy-resource-page")
export class CofyResourcePage extends CofyCommunityPage {
  @property({ type: String }) public name = "";

  protected override crumbs(): Crumb[] {
    return this.sectionTrail("resources", { label: this.name });
  }

  protected override content(): TemplateResult {
    return html`<cofy-resource-editor
      .slug=${this.slug}
      .name=${this.name}
      @resource-updated=${(): void => this.routes.navigate("resources", { slug: this.slug })}
    ></cofy-resource-editor>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-resource-page": CofyResourcePage;
  }
}
