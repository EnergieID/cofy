import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ModuleId } from "@cofy/frontend-sdk";
import type { Crumb } from "../../../../index.js";

import "../../../../index.js";

import { CofyCommunityPage } from "../cofy-community-page.js";

/** One module, edited as YAML. */
@customElement("cofy-module-page")
export class CofyModulePage extends CofyCommunityPage {
  @property({ attribute: false }) public moduleId: ModuleId | null = null;

  protected override crumbs(): Crumb[] {
    const module = this.moduleId === null ? undefined : this.cofy?.modules.get(this.slug, this.moduleId);
    return this.sectionTrail("modules", { label: module?.display_name ?? module?.name ?? this.moduleId?.name ?? "" });
  }

  protected override content(): TemplateResult {
    return html`<cofy-module-editor
      .slug=${this.slug}
      .moduleId=${this.moduleId}
      @module-updated=${(): void => this.routes.navigate("modules", { slug: this.slug })}
    ></cofy-module-editor>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-module-page": CofyModulePage;
  }
}
