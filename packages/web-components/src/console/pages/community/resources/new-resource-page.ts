import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "../../../../index.js";

import { nativeStyles } from "../../../../index.js";
import "../../../../index.js";

import { CofyCommunityPage } from "../cofy-community-page.js";

/** Add a resource to a community. */
@customElement("cofy-new-resource-page")
export class CofyNewResourcePage extends CofyCommunityPage {
  public static override styles = [
    nativeStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  protected override crumbs(): Crumb[] {
    return this.sectionTrail("resources", { label: this.t("newResource.crumb") });
  }

  protected override content(): TemplateResult {
    return html`
      <section>
        <cofy-resource-create
          .slug=${this.slug}
          @resource-created=${(): void => this.routes.navigate("resources", { slug: this.slug })}
          @create-cancelled=${(): void => this.routes.navigate("resources", { slug: this.slug })}
        ></cofy-resource-create>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-new-resource-page": CofyNewResourcePage;
  }
}
