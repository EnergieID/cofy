import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { CofyElement } from "../../cofy-element.js";
import { nativeStyles } from "../../theme/native-styles.js";
import { utilityStyles } from "../../theme/utility-styles.js";

/** The one thing every kind of "issue" this shell shows actually needs - a message to print. */
export interface FieldShellIssue {
  message: string;
}

/**
 * Wraps a field's own control (slotted in) with its label and actions above, and its description
 * and errors below - drawn by `cofy-any-form` around every field, so a control never carries a
 * visible label of its own. Styled with `wa-form-control-label`, the same utility class (and
 * tokens) Web Awesome's own controls use for their label.
 *
 * Its actions show beside the label, or - where there is none (a `bare` field) - beside the control
 * itself, at the top: for a picker beside the picker, and for a union beside its type picker.
 *
 * `issues` only needs a `message` to print, not a full `ValidationIssue` - a YAML editor's own
 * syntax errors (plain strings) map onto the same shape (`{ message }`) as a caller's schema
 * issues, so both wrap in exactly this one element.
 */
@customElement("cofy-field-shell")
export class CofyFieldShell extends CofyElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
      /*
       * Exactly one label line high, whether or not there are actions: the action button is taller than the label, and
       * would otherwise push the control down as it appears - it overflows the row instead, centred on the label.
       */
      .header {
        line-height: var(--wa-form-control-label-line-height);
        block-size: 1lh;
        align-items: center;
        /* wa-split wraps, which sizes its line to the tallest item rather than to the row, shifting the label instead. */
        flex-wrap: nowrap;
      }
      .body {
        display: flex;
        align-items: flex-start;
        gap: var(--wa-space-xs);
      }
      .body ::slotted(:not([slot])) {
        flex: 1;
        min-inline-size: 0;
      }
      .cofy-field-issues {
        padding-inline-start: var(--wa-space-m);
        color: var(--wa-color-danger-on-quiet);
        font-size: var(--wa-font-size-s);
      }
    `,
  ];

  @property({ type: String }) public label = "";
  @property({ type: Boolean }) public required = false;
  @property({ type: String }) public description = "";
  @property({ attribute: false }) public issues: readonly FieldShellIssue[] = [];

  public override render(): TemplateResult {
    return html`
      <div class="wa-stack wa-gap-xs">
        ${this.label === ""
          ? nothing
          : html`<div class="header wa-split">
              <label>${this.label}${this.required ? "*" : ""}</label>
              <slot name="actions"></slot>
            </div>`}
        <div class="body">
          <slot></slot>
          ${this.label === "" ? html`<slot name="actions"></slot>` : nothing}
        </div>
        ${this.description === ""
          ? nothing
          : html`<div class="wa-color-text-quiet wa-caption-s">${this.description}</div>`}
        ${this.issues.length === 0
          ? nothing
          : html`<ul class="cofy-field-issues">
              ${this.issues.map((issue) => html`<li>${issue.message}</li>`)}
            </ul>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-field-shell": CofyFieldShell;
  }
}
