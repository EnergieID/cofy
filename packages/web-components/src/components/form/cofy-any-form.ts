import { consume } from "@lit/context";
import { css, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { html, unsafeStatic } from "lit/static-html.js";

import "./cofy-action-menu.js";
import "./cofy-field-shell.js";
import "./cofy-yaml-form.js";

import { fieldRegistryContext } from "../../context.js";
import type { MenuAction } from "./cofy-action-menu.js";
import type { AS_YAML_OPTION, FieldRegistry } from "./field-registry.js";
import { defaultFieldRegistry } from "./field-registry.js";
import { CofyFormField } from "./form-field.js";
import { deref } from "./schema/ref.js";
import { fieldDescription, fieldLabel } from "./schema/summary.js";
import { nativeStyles } from "../../theme/native-styles.js";
import { utilityStyles } from "../../theme/utility-styles.js";

const YAML_TAG = "cofy-yaml-form";

/**
 * Renders whichever field a schema node calls for: the first mapper in {@link fieldRegistryContext}
 * whose `matches` accepts this field's own schema, falling back to `cofy-yaml-form` if none do -
 * imported here directly, since this is the one place that fallback tag is named.
 *
 * Draws the field's shell - its label, actions, description and issues - around whatever it
 * mounts, so no field draws a label of its own; only a `wrapper` (see {@link FieldKind}) is left
 * to draw its own, or to hand it to the field it wraps. While `bare`, an ancestor already drew the
 * label and shows the issues, so the shell keeps only the actions.
 *
 * The one place a field's label/description are read off its schema. The label comes from the field's own schema, before
 * its `$ref` is resolved: a model's title is its class name, not the field's, so a field typed by a model - which pydantic
 * gives no title of its own - is named after its property instead. Its own description goes first too, as pydantic puts
 * it beside the `$ref`, with the model's as a fallback.
 */
@customElement("cofy-any-form")
export class CofyAnyForm extends CofyFormField {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @consume({ context: fieldRegistryContext, subscribe: true })
  public fieldRegistry: FieldRegistry = defaultFieldRegistry;

  @state() private yamlToggle = false;

  private shouldShowYaml(asYaml: AS_YAML_OPTION): boolean {
    switch (asYaml){
      case "never": return false;
      case "optional": return this.yamlToggle;
      case "default": return !this.yamlToggle;
    }
  }

  public override render(): TemplateResult {
    const node = deref(this.schema, this.root);
    const label = this.label || fieldLabel(this.schema, this.pointer);
    const description = this.description || fieldDescription(this.schema) || fieldDescription(node);

    const match = this.fieldRegistry.getFirstMatch(node, this.root);
    const asYaml = match?.asYaml ?? "never";
    const yaml = this.shouldShowYaml(asYaml);
    // While bare, the ancestor that drew this field's boundary offers viewing it as YAML, as part of its own.
    const togglable = asYaml !== "never" && !this.bare;
    const tagName = unsafeStatic(yaml ? YAML_TAG : (match?.tag ?? YAML_TAG));

    const toggleLabel = yaml ? this.t("form.viewAsForm") : this.t("form.viewAsYaml");
    const toggle = (): void => {
      this.yamlToggle = !this.yamlToggle;
    };
    const yamlActions: MenuAction[] = togglable ? [{ id: "toggle-yaml", label: toggleLabel, run: toggle }] : [];

    const wrapper = !yaml && match?.kind === "wrapper";
    const field = html`<${tagName}
      .schema=${node}
      .root=${this.root}
      .pointer=${this.pointer}
      .value=${this.value}
      ?required=${this.required}
      .issues=${this.issues}
      .hide=${this.hide}
      ?bare=${this.bare}
      .label=${label}
      .description=${description}
      .menuActions=${wrapper ? this.menuActions : []}
    ></${tagName}>`;

    if (wrapper) return field;

    const actions = [...yamlActions, ...this.menuActions];

    return html`
      <cofy-field-shell
        data-pointer=${this.pointer}
        label=${this.bare ? "" : label}
        ?required=${this.required}
        description=${this.bare ? "" : description}
        .issues=${this.ownIssues}
      >
        ${actions.length > 0 ? html`<cofy-action-menu slot="actions" .actions=${actions}></cofy-action-menu>` : nothing}
        ${field}
      </cofy-field-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-any-form": CofyAnyForm;
  }
}
