import { consume } from "@lit/context";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/details/details.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "./cofy-any-form.js";

import { fieldRegistryContext } from "../../context.js";
import { nativeStyles } from "../../theme/native-styles.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import type { FieldRegistry } from "./field-registry.js";
import { defaultFieldRegistry } from "./field-registry.js";
import { CofyFormField } from "./form-field.js";
import { pointerFor } from "./schema/pointer.js";
import { isRecord } from "./schema/ref.js";

/**
 * An object's own properties, each rendered by a child `cofy-any-form`.
 *
 * Its fields are grouped in a details of their own - unless `bare`, meaning the ancestor that
 * mounted it (a union, around the branch it resolved to, or the document itself at its root)
 * already is their boundary, and a second one would double up.
 *
 * Properties marked `x-advanced` come last, in a section that is collapsed until expanded.
 *
 * Creating an object that is not there yet, and clearing one back to not being there, is left to
 * `cofy-optional-form` around it - an object that is not optional is always there.
 */
@customElement("cofy-object-form")
export class CofyObjectForm extends CofyFormField {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }

      /* Flush with the fields above it, rather than inset like a panel. */
      .advanced {
        --spacing: var(--wa-space-xs);
      }

      .advanced::part(header) {
        padding: 0;
        font-size: var(--wa-font-size-s);
      }

      .advanced::part(content) {
        padding-inline: 0;
        padding-block-end: 0;
      }
    `,
  ];

  @consume({ context: fieldRegistryContext, subscribe: true })
  public fieldRegistry: FieldRegistry = defaultFieldRegistry;

  public override render(): TemplateResult {
    const properties = this.schema["properties"];
    const required = new Set(Array.isArray(this.schema["required"]) ? (this.schema["required"] as string[]) : []);
    const shown = isRecord(properties)
      ? Object.entries(properties).filter(
          (entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]) && !this.hide.includes(entry[0]),
        )
      : [];
    const basic = shown.filter(([, propSchema]) => propSchema["x-advanced"] !== true);
    const advanced = shown.filter(([, propSchema]) => propSchema["x-advanced"] === true);

    const propertiesBlock = html`
      <div class="wa-stack">
        ${basic.map(([name, propSchema]) => this.renderProperty(name, propSchema, required.has(name)))}
        ${advanced.length > 0 ? this.renderAdvanced(advanced, required) : nothing}
      </div>
    `;

    return this.bare ? propertiesBlock : this.renderPopulated(propertiesBlock);
  }

  private renderAdvanced(advanced: [string, Record<string, unknown>][], required: Set<string>): TemplateResult {
    return html`
      <wa-details class="advanced" appearance="plain" icon-placement="start">
        <span slot="summary">${this.t("form.advancedOptions")}</span>
        <div class="wa-stack">
          <wa-divider></wa-divider>
          ${advanced.map(([name, propSchema]) => this.renderProperty(name, propSchema, required.has(name)))}
        </div>
      </wa-details>
    `;
  }

  private renderPopulated(content: TemplateResult): TemplateResult {
    const summary = this.fieldRegistry.getSummary(this.schema, this.root, this.value);

    return html`
      <wa-details appearance="outlined" open>
        <span slot="summary">${summary ?? ""}</span>
        ${content}
      </wa-details>
    `;
  }

  private renderProperty(name: string, propSchema: Record<string, unknown>, required: boolean): TemplateResult {
    const childPointer = pointerFor(this.pointer, name);
    const childValue = isRecord(this.value) ? this.value[name] : undefined;

    return html`
      <cofy-any-form
        data-segment=${name}
        .schema=${propSchema}
        .root=${this.root}
        .pointer=${childPointer}
        .value=${childValue}
        ?required=${required}
        .issues=${this.issues}
      ></cofy-any-form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-object-form": CofyObjectForm;
  }
}
