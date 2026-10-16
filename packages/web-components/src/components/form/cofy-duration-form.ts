import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/select/select.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { DURATION_UNITS, formatDuration, parseDuration, type DurationUnit } from "./schema/duration.js";

/**
 * A duration (a `format: duration` string), entered as an amount of one unit - `15` `minutes`, written as `PT15M`. A
 * value made of several units, or of a fraction of one, is shown in a warning instead, until a new one replaces it; as
 * every value is entered here, that should hardly ever happen.
 */
@customElement("cofy-duration-form")
export class CofyDurationForm extends CofyFormField {
  public static override styles = [
    utilityStyles,
    css`
      .wa-flank\\:end {
        --flank-size: 10rem;
      }
    `,
  ];

  /** The unit chosen while there is no amount yet to hold it in a value. */
  @state() private pendingUnit: DurationUnit = "minutes";

  public override render(): TemplateResult {
    const text = typeof this.value === "string" ? this.value : "";
    const duration = parseDuration(text);
    const unit = duration?.unit ?? this.pendingUnit;

    return html`
      <div class="wa-stack wa-gap-xs">
        <div class="wa-flank:end wa-gap-xs">
          <wa-input
            class="wa-visually-hidden-label"
            type="number"
            label=${this.label}
            .value=${duration === undefined ? "" : String(duration.amount)}
            min="0"
            step="1"
            ?required=${this.required}
            @input=${(event: Event): void => this.onAmount(event, unit)}
          ></wa-input>
          <wa-select
            class="wa-visually-hidden-label"
            label=${this.t("form.durationUnit")}
            .value=${unit}
            lang=${this.i18n?.resolvedLanguage ?? "en"}
            @change=${(event: Event): void => this.onUnit(event, duration?.amount)}
          >
            ${repeat(
              DURATION_UNITS,
              (option) => option,
              (option) => html`<wa-option value=${option}>${this.t(`form.durationUnits.${option}`)}</wa-option>`,
            )}
          </wa-select>
        </div>
        ${text !== "" && duration === undefined
          ? html`<wa-callout variant="warning" size="s">${this.t("form.unshownValue", { value: text })}</wa-callout>`
          : nothing}
      </div>
    `;
  }

  private onAmount(event: Event, unit: DurationUnit): void {
    const raw = (event.target as HTMLElement & { value?: string | null }).value ?? "";
    const amount = Number(raw);
    this.emit(raw === "" || !Number.isInteger(amount) || amount < 0 ? null : formatDuration({ amount, unit }));
  }

  private onUnit(event: Event, amount: number | undefined): void {
    const unit = (event.target as HTMLElement & { value?: string }).value as DurationUnit;
    this.pendingUnit = unit;
    if (amount !== undefined) this.emit(formatDuration({ amount, unit }));
  }

  private emit(value: string | null): void {
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-duration-form": CofyDurationForm;
  }
}
