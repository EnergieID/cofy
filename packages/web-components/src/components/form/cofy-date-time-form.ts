import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/time-input/time-input.js";

import { utilityStyles } from "../../theme/utility-styles.js";
import { CofyFormField } from "./form-field.js";
import { emptyDateTime, formatDateTime, localOffset, parseDateTime, type DateTimeParts } from "./schema/date-time.js";

/**
 * A point in time (a `format: date-time` string), entered as its date, its time of day, and its offset from UTC side by
 * side - so it is written in the one format the schema accepts, with nothing converted between time zones. A new value
 * starts at the reader's own offset for the date entered. A value this can't take apart is shown in a warning instead,
 * until a new one replaces it.
 *
 * Each control reports on `change` - once what it holds is complete - since one still being typed reads as empty. Both
 * times are in 24 hours, whatever the reader's locale.
 */
@customElement("cofy-date-time-form")
export class CofyDateTimeForm extends CofyFormField {
  public static override styles = [
    utilityStyles,
    css`
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--wa-space-xs);
      }
      .date {
        flex: 0 1 10rem;
      }
      .time {
        flex: 0 1 8.5rem;
      }
      .sign {
        flex: 0 0 5rem;
      }
      .offset {
        flex: 0 1 6.5rem;
      }
    `,
  ];

  /** What was entered before there was a date to hold it in a value - a time, an offset - kept until there is one. */
  @state() private pending: DateTimeParts | undefined;

  public override render(): TemplateResult {
    const parsed = parseDateTime(this.value);
    const held = parsed !== undefined && parsed.date !== "";
    const parts = held ? parsed : (this.pending ?? parsed ?? emptyDateTime());
    const lang = this.i18n?.resolvedLanguage ?? "en";

    return html`
      <div class="wa-stack wa-gap-xs">
        <div class="row">
          <wa-input
            class="date wa-visually-hidden-label"
            type="date"
            label=${this.label}
            .value=${parts.date}
            lang=${lang}
            ?required=${this.required}
            @change=${(event: Event): void => this.change(parts, { date: valueOf(event) }, parsed)}
          ></wa-input>
          <wa-time-input
            class="time wa-visually-hidden-label"
            label=${this.t("form.time")}
            .value=${parts.time}
            hour-format="24"
            lang=${lang}
            @change=${(event: Event): void => this.change(parts, { time: valueOf(event) }, parsed)}
          ></wa-time-input>
          <span class="wa-color-text-quiet">${this.t("form.utc")}</span>
          <wa-select
            class="sign wa-visually-hidden-label"
            label=${this.t("form.utcOffsetSign")}
            .value=${parts.sign}
            @change=${(event: Event): void => this.change(parts, { sign: valueOf(event) as "+" | "-" }, parsed)}
          >
            <wa-option value="+">+</wa-option>
            <wa-option value="-">−</wa-option>
          </wa-select>
          <wa-time-input
            class="offset wa-visually-hidden-label"
            label=${this.t("form.utcOffset")}
            .value=${parts.offset}
            hour-format="24"
            max="14:00"
            @change=${(event: Event): void => this.change(parts, { offset: valueOf(event) }, parsed)}
          ></wa-time-input>
        </div>
        ${parsed === undefined
          ? html`<wa-callout variant="warning" size="s">
              ${this.t("form.unshownValue", { value: String(this.value) })}
            </wa-callout>`
          : nothing}
      </div>
    `;
  }

  /**
   * Reports *parts* with *changed* in them. While nothing is held yet - before a date is first entered, or in place of a
   * value this can't take apart - the offset follows the date entered, as the reader's own for it.
   */
  private change(parts: DateTimeParts, changed: Partial<DateTimeParts>, parsed: DateTimeParts | undefined): void {
    const next = { ...parts, ...changed };
    const held = parsed !== undefined && parsed.date !== "";
    const offset = held || changed.sign !== undefined || changed.offset !== undefined ? {} : localOffset(local(next));
    const value = formatDateTime({ ...next, ...offset });
    this.pending = value === null ? { ...next, ...offset } : undefined;
    this.dispatchEvent(
      new CustomEvent("field-change", { bubbles: true, composed: true, detail: { pointer: this.pointer, value } }),
    );
  }
}

/** *parts*' date and time as the reader's own local time, as `Date` reads one. */
function local(parts: DateTimeParts): string {
  return parts.date === "" ? "" : `${parts.date}T${parts.time === "" ? "00:00" : parts.time}`;
}

function valueOf(event: Event): string {
  return (event.target as HTMLElement & { value?: string }).value ?? "";
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-date-time-form": CofyDateTimeForm;
  }
}
