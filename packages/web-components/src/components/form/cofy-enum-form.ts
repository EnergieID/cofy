import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/select/select.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { primitiveText } from "./schema/summary.js";

/** An `enum` field, rendered as a `wa-select` - labelled only for assistive technology, under its field's own label. */
@customElement("cofy-enum-form")
export class CofyEnumForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    const values = Array.isArray(this.schema["enum"]) ? (this.schema["enum"] as unknown[]) : [];

    return html`
      <wa-select
        class="wa-visually-hidden-label"
        label=${this.label}
        .value=${primitiveText(this.value)}
        lang=${this.i18n?.resolvedLanguage ?? "en"}
        ?required=${this.required}
        @change=${(event: Event): void => this.onChange(event, values)}
      >
        ${repeat(
          values,
          (value) => primitiveText(value),
          (value) => html`<wa-option value=${primitiveText(value)}>${primitiveText(value)}</wa-option>`,
        )}
      </wa-select>
    `;
  }

  private onChange(event: Event, values: unknown[]): void {
    const raw = (event.target as HTMLElement & { value?: string }).value ?? "";
    const value = values.find((candidate) => primitiveText(candidate) === raw) ?? raw;
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-enum-form": CofyEnumForm;
  }
}
