import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/input/input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";

/** A plain string field, rendered as a `wa-input` - labelled only for assistive technology, under its field's own label. */
@customElement("cofy-string-form")
export class CofyStringForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`
      <wa-input
        class="wa-visually-hidden-label"
        label=${this.label}
        .value=${typeof this.value === "string" ? this.value : ""}
        ?required=${this.required}
        @input=${(event: Event): void => this.onInput(event)}
      ></wa-input>
    `;
  }

  private onInput(event: Event): void {
    const value = (event.target as HTMLElement & { value?: string }).value ?? "";
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-string-form": CofyStringForm;
  }
}
