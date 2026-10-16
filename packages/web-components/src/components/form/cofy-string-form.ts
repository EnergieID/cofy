import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import "@awesome.me/webawesome/dist/components/input/input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { inputPattern } from "./schema/pattern.js";

/**
 * A plain string field, rendered as a `wa-input` held to the length and pattern its schema accepts - labelled only for
 * assistive technology, under its field's own label.
 */
@customElement("cofy-string-form")
export class CofyStringForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    const pattern = this.schema["pattern"];

    return html`
      <wa-input
        class="wa-visually-hidden-label"
        label=${this.label}
        .value=${typeof this.value === "string" ? this.value : ""}
        minlength=${ifDefined(integer(this.schema["minLength"]))}
        maxlength=${ifDefined(integer(this.schema["maxLength"]))}
        pattern=${ifDefined(typeof pattern === "string" ? inputPattern(pattern) : undefined)}
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

function integer(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-string-form": CofyStringForm;
  }
}
