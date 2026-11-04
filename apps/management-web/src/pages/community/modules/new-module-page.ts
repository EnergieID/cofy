import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { Crumb } from "@cofy/web-components";

import { nativeStyles } from "@cofy/web-components";
import "@cofy/web-components";

import { CofyCommunityPage } from "../cofy-community-page.js";

/** Add a module to a community. */
@customElement("cofy-new-module-page")
export class CofyNewModulePage extends CofyCommunityPage {
  public static override styles = [
    nativeStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  protected override crumbs(): Crumb[] {
    return this.sectionTrail("modules", { label: this.t("newModule.crumb") });
  }

  protected override content(): TemplateResult {
    return html`
      <section>
        <cofy-module-create
          .slug=${this.slug}
          @module-created=${(): void => this.routes.navigate("modules", { slug: this.slug })}
          @create-cancelled=${(): void => this.routes.navigate("modules", { slug: this.slug })}
        ></cofy-module-create>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-new-module-page": CofyNewModulePage;
  }
}
