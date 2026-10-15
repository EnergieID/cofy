import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";

/**
 * A boolean field, rendered as a `wa-checkbox` under its field's own label - its own label, in the default slot, is there
 * only for assistive technology.
 */
@customElement("cofy-boolean-form")
export class CofyBooleanForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`
      <wa-checkbox
        class="wa-visually-hidden-label"
        ?checked=${Boolean(this.value)}
        ?required=${this.required}
        @change=${(event: Event): void => this.onChange(event)}
      >
        ${this.label}
      </wa-checkbox>
    `;
  }

  private onChange(event: Event): void {
    const value = (event.target as HTMLElement & { checked?: boolean }).checked ?? false;
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-boolean-form": CofyBooleanForm;
  }
}
