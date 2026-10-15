import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "./cofy-action-menu.js";
import "./cofy-field-shell.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";

/**
 * A field nothing is valid against - one only holding types the community may not use, or a union with none of its
 * types left to offer, as the field registry dispatches both here - so there is nothing to fill in: it says so, rather
 * than offering a control nothing entered in could satisfy.
 *
 * It draws its own field shell (a `wrapper`, as far as `cofy-any-form` is concerned) to say so as its error, and as its
 * only one: what a validator reports about a value nothing is valid against - no
 * branch matching, a `not` matching - explains less than that.
 */
@customElement("cofy-never-form")
export class CofyNeverForm extends CofyFormField {
  public static override styles = [utilityStyles];

  public override render(): TemplateResult {
    return html`
      <cofy-field-shell
        data-pointer=${this.pointer}
        label=${this.bare ? "" : this.label}
        ?required=${this.required}
        description=${this.bare ? "" : this.description}
        .issues=${[{ message: this.t("form.notAvailable") }]}
      >
        ${this.menuActions.length > 0
          ? html`<cofy-action-menu slot="actions" .actions=${this.menuActions}></cofy-action-menu>`
          : nothing}
      </cofy-field-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-never-form": CofyNeverForm;
  }
}
