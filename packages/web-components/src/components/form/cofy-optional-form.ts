import { consume } from "@lit/context";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/details/details.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "./cofy-action-menu.js";
import "./cofy-any-form.js";
import "./cofy-field-shell.js";
import "../../icons.js";

import { fieldRegistryContext } from "../../context.js";
import { nativeStyles } from "../../theme/native-styles.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import type { MenuAction } from "./cofy-action-menu.js";
import type { FieldRegistry } from "./field-registry.js";
import { defaultFieldRegistry } from "./field-registry.js";
import { CofyFormField } from "./form-field.js";
import { seedFromSchema } from "./schema/defaults.js";
import { deref } from "./schema/ref.js";
import { optionalInner } from "./schema/resolve.js";

/**
 * A field that can also be left out (an `Optional`, an `anyOf` with a `null` branch): edited as what
 * it holds, with clearing it back to `null` among its actions.
 *
 * Which of the two it shows follows from the value itself: `null` shows a "Create" placeholder,
 * which seeds what it holds, and anything else that value's own form. A single input has no
 * placeholder - it is always shown, empty while `null` - so clearing it just empties it.
 */
@customElement("cofy-optional-form")
export class CofyOptionalForm extends CofyFormField {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @consume({ context: fieldRegistryContext, subscribe: true })
  public fieldRegistry: FieldRegistry = defaultFieldRegistry;

  public override render(): TemplateResult {
    const inner = optionalInner(this.schema, this.root);
    if (inner === undefined) return html``;

    const empty = this.value === null || this.value === undefined;
    const input = this.fieldRegistry.getFirstMatch(deref(inner, this.root), this.root)?.kind === "input";
    if (empty && !input) return this.renderEmpty(inner);

    const clear: MenuAction[] = empty ? [] : [{ id: "clear", label: this.t("form.remove"), run: (): void => this.emit(null) }];
    return html`<cofy-any-form
      .schema=${inner}
      .root=${this.root}
      .pointer=${this.pointer}
      .value=${this.value}
      ?required=${this.required}
      .issues=${this.issues}
      .hide=${this.hide}
      ?bare=${this.bare}
      .label=${this.label}
      .description=${this.description}
      .menuActions=${[...this.menuActions, ...clear]}
    ></cofy-any-form>`;
  }

  private renderEmpty(inner: Record<string, unknown>): TemplateResult {
    return html`
      <cofy-field-shell
        data-pointer=${this.pointer}
        label=${this.bare ? "" : this.label}
        ?required=${this.required}
        description=${this.bare ? "" : this.description}
        .issues=${this.ownIssues}
      >
        ${this.menuActions.length > 0
          ? html`<cofy-action-menu slot="actions" .actions=${this.menuActions}></cofy-action-menu>`
          : nothing}
        <wa-details
          appearance="outlined"
          summary=${this.t("form.create")}
          @wa-show=${(event: CustomEvent): void => {
            event.stopPropagation();
            event.preventDefault();
            this.emit(seedFromSchema(inner, this.root));
          }}
        >
          <wa-icon slot="expand-icon" name="plus" library="cofy"></wa-icon>
        </wa-details>
      </cofy-field-shell>
    `;
  }

  private emit(value: unknown): void {
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-optional-form": CofyOptionalForm;
  }
}
