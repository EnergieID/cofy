import { consume } from "@lit/context";
import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { JsonSchema, Referable, ResourceRef, ResourceSettings } from "@cofy/frontend-sdk";

import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "./cofy-action-menu.js";
import "./cofy-any-form.js";
import "./cofy-field-shell.js";
import "../resource/cofy-save-resource-dialog.js";

import { communitySlugContext } from "../../context.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import type { MenuAction } from "./cofy-action-menu.js";
import { CofyFormField } from "./form-field.js";
import { seedFromSchema } from "./schema/defaults.js";
import { isNever } from "./schema/never.js";
import { isRefValue, referableBranches, referableOf } from "./schema/referable.js";

/**
 * A field whose value can also be a reference to a resource (an `x-referable` schema): edited as
 * its value, with using a resource instead - or saving the value as one - among its actions.
 *
 * Which of the two it shows follows from the value itself: a reference shows the resource
 * picker, under a field shell of its own; anything else the value's own form, which it hands its
 * actions - and those it was handed - to (a `wrapper`, as far as `cofy-any-form` is concerned). Switching to a resource keeps the value it
 * replaces, so switching back restores it.
 */
@customElement("cofy-referable-form")
export class CofyReferableForm extends CofyFormField {
  public static override styles = [
    utilityStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @consume({ context: communitySlugContext, subscribe: true })
  @state()
  public slug = "";

  @state() private saving = false;

  /** The value a reference replaced, restored when a value is specified again. */
  private replaced: unknown;

  public override render(): TemplateResult {
    const referable = referableOf(this.schema);
    const branches = referableBranches(this.schema);
    if (referable === undefined || branches === undefined) return html``;

    return isRefValue(this.value) ? this.renderRef(this.value, referable, branches.value) : this.renderValue(referable, branches.value);
  }

  private renderValue(referable: Referable, schema: JsonSchema): TemplateResult {
    const actions: MenuAction[] = [];
    // Only offered once there is something to pick.
    if (this.fitting(referable).length > 0) {
      actions.push({ id: "use-resource", label: this.t("form.useResource"), run: (): void => this.useResource() });
    }
    if (this.canSave(schema)) {
      actions.push({
        id: "save-as-resource",
        label: this.t("form.saveAsResource"),
        run: (): void => {
          this.saving = true;
        },
      });
    }

    return html`
      <cofy-any-form
        .schema=${schema}
        .root=${this.root}
        .pointer=${this.pointer}
        .value=${this.value}
        ?required=${this.required}
        .issues=${this.issues}
        .hide=${this.hide}
        ?bare=${this.bare}
        .label=${this.label}
        .description=${this.description}
        .menuActions=${[...this.menuActions, ...actions]}
      ></cofy-any-form>
      <cofy-save-resource-dialog
        .open=${this.saving}
        .kind=${referable.kind}
        .value=${this.value}
        @resource-saved=${(event: CustomEvent<{ name: string }>): void => this.onSaved(event.detail.name)}
        @dialog-closed=${(): void => {
          this.saving = false;
        }}
      ></cofy-save-resource-dialog>
    `;
  }

  private renderRef(ref: ResourceRef, referable: Referable, valueSchema: JsonSchema): TemplateResult {
    const options = this.fitting(referable);
    // Labelled only for assistive technology: it sits under the field's own label, which names what it picks.
    const picker = html`<wa-select
      class="wa-visually-hidden-label"
      label=${this.label || this.t("form.resource")}
      placeholder=${this.t("form.chooseResource")}
      .value=${ref.name}
      ?disabled=${options.length === 0}
      lang=${this.i18n?.resolvedLanguage ?? "en"}
      @change=${(event: Event): void => this.onChoose(event)}
    >
      ${repeat(
        options,
        (resource) => resource.name,
        (resource) => html`<wa-option value=${resource.name}>${this.optionLabel(resource)}</wa-option>`,
      )}
    </wa-select>`;
    const actions: MenuAction[] = [
      ...this.menuActions,
      { id: "specify-value", label: this.t("form.specifyValue"), run: (): void => this.specifyValue(valueSchema) },
    ];

    return html`
      <cofy-field-shell
        data-pointer=${this.pointer}
        label=${this.bare ? "" : this.label}
        ?required=${this.required}
        description=${this.bare ? "" : this.description}
        .issues=${this.refIssues()}
      >
        <cofy-action-menu slot="actions" .actions=${actions}></cofy-action-menu>
        ${picker}
      </cofy-field-shell>
    `;
  }

  /** The community's resources this field can reference. */
  private fitting(referable: Referable): ResourceSettings[] {
    return this.slug === "" ? [] : (this.cofy?.resources.fitting(this.slug, referable) ?? []);
  }

  /** Whether there is a value to save as a resource - none where nothing is valid against it. */
  private canSave(schema: JsonSchema): boolean {
    return this.cofy !== undefined && this.value !== undefined && this.value !== null && !isNever(schema, this.root);
  }

  /** The reference's own issues, and those of its name - it has no form of its own to show them in. */
  private refIssues(): readonly { message: string }[] {
    if (this.bare) return [];
    return this.issues.filter((issue) => issue.pointer === this.pointer || issue.pointer.startsWith(`${this.pointer}/`));
  }

  private optionLabel(resource: ResourceSettings): string {
    return resource.description ? `${resource.name} — ${resource.description}` : resource.name;
  }

  private useResource(): void {
    this.replaced = this.value;
    this.emit({ type: "resource", name: "" });
  }

  private specifyValue(schema: JsonSchema): void {
    const value = this.replaced ?? seedFromSchema(schema, this.root);
    this.replaced = undefined;
    this.emit(value);
  }

  private onSaved(name: string): void {
    this.saving = false;
    this.replaced = this.value;
    this.emit({ type: "resource", name });
  }

  private onChoose(event: Event): void {
    const name = (event.target as HTMLElement & { value?: string }).value ?? "";
    this.emit({ type: "resource", name });
  }

  private emit(value: unknown): void {
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-referable-form": CofyReferableForm;
  }
}
