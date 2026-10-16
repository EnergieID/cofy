import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/time-input/time-input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";

/**
 * A time of day (a `format: time` string), rendered as a `wa-time-input` in the reader's own clock - labelled only for
 * assistive technology, under its field's own label. Its value is `HH:mm`, or `HH:mm:ss` where seconds are set; an
 * emptied field is `null`.
 */
@customElement("cofy-time-form")
export class CofyTimeForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`
      <wa-time-input
        class="wa-visually-hidden-label"
        label=${this.label}
        .value=${typeof this.value === "string" ? this.value : null}
        lang=${this.i18n?.resolvedLanguage ?? "en"}
        ?required=${this.required}
        @input=${(event: Event): void => this.onInput(event)}
      ></wa-time-input>
    `;
  }

  private onInput(event: Event): void {
    const raw = (event.target as HTMLElement & { value?: string }).value ?? "";
    const value = raw === "" ? null : raw;
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-time-form": CofyTimeForm;
  }
}
