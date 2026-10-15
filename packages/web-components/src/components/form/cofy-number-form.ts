import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/input/input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";

/** A number/integer field, rendered as a `wa-input[type=number]` - labelled only for assistive technology, under its field's own label. */
@customElement("cofy-number-form")
export class CofyNumberForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`
      <wa-input
        class="wa-visually-hidden-label"
        type="number"
        label=${this.label}
        .value=${typeof this.value === "number" ? String(this.value) : ""}
        ?required=${this.required}
        @input=${(event: Event): void => this.onInput(event)}
      ></wa-input>
    `;
  }

  private onInput(event: Event): void {
    const raw = (event.target as HTMLElement & { value?: string }).value ?? "";
    const value = raw === "" ? null : Number(raw);
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-number-form": CofyNumberForm;
  }
}
