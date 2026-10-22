import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/input/input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { isRecord } from "./schema/ref.js";

/**
 * An entry of a list, such as a supplier or a region (an object marked `x-named-identifier`): its `name` is what is
 * shown, its `id` what is used. Entered as both, side by side, until there is a list of entries to pick one from.
 */
@customElement("cofy-named-identifier-form")
export class CofyNamedIdentifierForm extends CofyFormField {
  public static override styles = [
    utilityStyles,
    css`
      .wa-flank\\:end {
        --flank-size: 12rem;
      }
    `,
  ];

  public override render(): TemplateResult {
    const value = this.identifier;

    return html`
      <div class="wa-flank:end wa-gap-xs">
        <wa-input
          label=${this.t("form.identifierName")}
          .value=${value.name}
          ?required=${this.required}
          @input=${(event: Event): void => this.onInput(event, "name")}
        ></wa-input>
        <wa-input
          label=${this.t("form.identifierId")}
          .value=${value.id}
          ?required=${this.required}
          @input=${(event: Event): void => this.onInput(event, "id")}
        ></wa-input>
      </div>
    `;
  }

  private get identifier(): { name: string; id: string } {
    const value = isRecord(this.value) ? this.value : {};
    return {
      name: typeof value["name"] === "string" ? value["name"] : "",
      id: typeof value["id"] === "string" ? value["id"] : "",
    };
  }

  private onInput(event: Event, key: "name" | "id"): void {
    const entered = (event.target as HTMLElement & { value?: string | null }).value ?? "";
    this.dispatchEvent(
      new CustomEvent("field-change", {
        bubbles: true,
        composed: true,
        detail: { pointer: this.pointer, value: { ...this.identifier, [key]: entered } },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-named-identifier-form": CofyNamedIdentifierForm;
  }
}
