import { consume } from "@lit/context";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/tag/tag.js";

import { formValueContext } from "../../context.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { getAtPointer, parentPointer, pointerFor } from "./schema/pointer.js";

const STEPS = ["--", "-", "0", "+", "++"] as const;

/**
 * The four ascending boundaries between directive steps, shown between the steps they separate: `-- ≤ b0 < - ≤ b1 < 0
 * ≤ b2 < + ≤ b3 < ++`, as a value on a boundary belongs to the step below it. While the `reverse` beside it is set, the
 * steps run the other way: `++ ≤ b0 < + ≤ b1 < 0 ≤ b2 < - ≤ b3 < --`.
 *
 * Each step is a filled tag in its own palette hue - red, yellow, gray, light and dark green - the outer steps in the hue's
 * core color, the inner ones in a light tint of it, or a dark one in dark mode.
 *
 * Wraps between its steps, so every line starts with one.
 */
@customElement("cofy-directive-boundaries-form")
export class CofyDirectiveBoundariesForm extends CofyFormField {
  public static override styles = [
    utilityStyles,
    css`
      .step {
        display: flex;
        align-items: center;
        gap: var(--wa-space-xs);
        white-space: nowrap;
      }

      wa-tag {
        justify-content: center;
        min-inline-size: 2.25em;
        padding-inline: 0.5em;
        font-weight: var(--wa-font-weight-semibold);
      }

      wa-tag[data-step="--"] {
        --wa-color-fill-quiet: light-dark(var(--wa-color-red-90), var(--wa-color-red-20));
        --wa-color-on-quiet: light-dark(var(--wa-color-red-30), var(--wa-color-red-70));
      }

      wa-tag[data-step="-"] {
        --wa-color-fill-quiet: light-dark(var(--wa-color-yellow-90), var(--wa-color-yellow-20));
        --wa-color-on-quiet: light-dark(var(--wa-color-yellow-30), var(--wa-color-yellow-70));
      }

      wa-tag[data-step="0"] {
        --wa-color-fill-quiet: light-dark(var(--wa-color-gray-90), var(--wa-color-gray-20));
        --wa-color-on-quiet: light-dark(var(--wa-color-gray-30), var(--wa-color-gray-70));
      }

      wa-tag[data-step="+"] {
        --wa-color-fill-quiet: light-dark(var(--wa-color-green-90), var(--wa-color-green-20));
        --wa-color-on-quiet: light-dark(var(--wa-color-green-30), var(--wa-color-green-70));
      }

      wa-tag[data-step="++"] {
        --wa-color-fill-quiet: light-dark(var(--wa-color-green-70), var(--wa-color-green-40));
        --wa-color-on-quiet: light-dark(var(--wa-color-green-10), var(--wa-color-green-90));
      }

      wa-input {
        inline-size: 7rem;
      }

      .issues {
        margin: 0;
        padding-inline-start: var(--wa-space-m);
        color: var(--wa-color-danger-on-quiet);
        font-size: var(--wa-font-size-s);
      }
    `,
  ];

  @consume({ context: formValueContext, subscribe: true })
  public formValue: unknown;

  private get reverse(): boolean {
    return getAtPointer(this.formValue, pointerFor(parentPointer(this.pointer), "reverse")) === true;
  }

  private get boundaries(): (number | null)[] {
    const value = Array.isArray(this.value) ? (this.value as unknown[]) : [];
    return STEPS.slice(1).map((_, index) => (typeof value[index] === "number" ? value[index] : null));
  }

  public override render(): TemplateResult {
    const steps = this.reverse ? [...STEPS].reverse() : STEPS;
    const boundaries = this.boundaries;
    const itemIssues = this.issues.filter((issue) => issue.pointer.startsWith(`${this.pointer}/`));

    return html`
      <div class="wa-stack wa-gap-xs">
        <div class="wa-cluster wa-gap-xs">
          ${boundaries.map(
            (boundary, index) => html`
              <div class="step">
                ${this.renderStep(steps[index]!)}
                <span>≤</span>
                <wa-input
                  class="wa-visually-hidden-label"
                  type="number"
                  step="any"
                  label=${this.t("form.directiveBoundary", { lower: steps[index], upper: steps[index + 1] })}
                  .value=${boundary === null ? "" : String(boundary)}
                  ?required=${this.required}
                  @input=${(event: Event): void => this.onInput(event, index)}
                ></wa-input>
                <span>&lt;</span>
              </div>
            `,
          )}
          ${this.renderStep(steps[steps.length - 1]!)}
        </div>
        ${itemIssues.length === 0
          ? nothing
          : html`<ul class="issues">
              ${itemIssues.map((issue) => html`<li>${issue.message}</li>`)}
            </ul>`}
      </div>
    `;
  }

  private renderStep(step: string): TemplateResult {
    return html`<wa-tag data-step=${step} appearance="filled">${step}</wa-tag>`;
  }

  private onInput(event: Event, index: number): void {
    const raw = (event.target as HTMLElement & { value?: string | null }).value ?? "";
    const value = this.boundaries;
    value[index] = raw === "" ? null : Number(raw);
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-directive-boundaries-form": CofyDirectiveBoundariesForm;
  }
}
