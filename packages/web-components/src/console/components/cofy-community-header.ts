import { CofyElement, utilityStyles } from "../../index.js";
import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../index.js";

/** What heads each page of a community: the address of its API, and whether that API runs. */
@customElement("cofy-community-header")
export class CofyCommunityHeader extends CofyElement {
  public static override styles = [
    utilityStyles,
    css`
      :host {
        display: block;
        margin-block-end: var(--wa-space-m);
      }
    `,
  ];

  @property({ type: String }) public slug = "";

  public override render(): TemplateResult {
    return html`
      <div class="wa-split">
        <cofy-api-link .url=${this.cofy?.communities.get(this.slug)?.api_url ?? ""}></cofy-api-link>
        <cofy-community-status .slug=${this.slug}></cofy-community-status>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-community-header": CofyCommunityHeader;
  }
}
