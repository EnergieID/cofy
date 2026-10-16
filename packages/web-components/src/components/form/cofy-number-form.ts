import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import "@awesome.me/webawesome/dist/components/number-input/number-input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { numberLimits } from "./schema/number.js";

/**
 * A number/integer field, rendered as a `wa-number-input` limited to the range and granularity its schema accepts -
 * labelled only for assistive technology, under its field's own label.
 */
@customElement("cofy-number-form")
export class CofyNumberForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    const { min, max, step } = numberLimits(this.schema);

    return html`
      <wa-number-input
        class="wa-visually-hidden-label"
        label=${this.label}
        .value=${typeof this.value === "number" ? String(this.value) : ""}
        min=${ifDefined(min)}
        max=${ifDefined(max)}
        step=${step}
        ?required=${this.required}
        @input=${(event: Event): void => this.onInput(event)}
      ></wa-number-input>
    `;
  }

  private onInput(event: Event): void {
    const raw = (event.target as HTMLElement & { value?: string | null }).value ?? "";
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
