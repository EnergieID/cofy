import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/tag/tag.js";

import { CofyElement } from "../../cofy-element.js";
import { utilityStyles } from "../../theme/utility-styles.js";

/** A type a system admin restricts: its group and name, and what it is for. */
@customElement("cofy-type-label")
export class CofyTypeLabel extends CofyElement {
  public static override styles = [
    utilityStyles,
    css`
      :host {
        display: block;
      }
      .description {
        color: var(--wa-color-text-quiet);
      }
    `,
  ];

  /** What the type is a type of: `module`, `resource`, or the resource kind holding it. */
  @property({ type: String }) public group = "";
  @property({ type: String }) public type = "";
  /** What the type is for; nothing is shown when it doesn't say. */
  @property({ type: String }) public description = "";

  public override render(): TemplateResult {
    return html`
      <div class="wa-cluster wa-gap-2xs">
        <wa-tag size="small" variant="neutral" appearance="filled">${this.group}</wa-tag>
        <wa-tag size="small" variant="neutral" appearance="outlined">${this.type}</wa-tag>
      </div>
      ${this.description === "" ? nothing : html`<div class="description wa-caption-s">${this.description}</div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-type-label": CofyTypeLabel;
  }
}
