import { html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { primitiveText } from "./schema/summary.js";

/**
 * A `const`-only field, such as the `type` discriminator - fixed by the schema, so it renders
 * as read-only text rather than an editable control.
 */
@customElement("cofy-const-form")
export class CofyConstForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`<span class="wa-color-text-quiet">${primitiveText(this.schema["const"])}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-const-form": CofyConstForm;
  }
}
