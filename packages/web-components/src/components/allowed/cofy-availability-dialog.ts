import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ProblemError, TypeAvailability } from "@cofy/frontend-sdk";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/switch/switch.js";
import "../cofy-problem-details.js";

import { CofyElement } from "../../cofy-element.js";
import { utilityStyles } from "../../theme/utility-styles.js";

/**
 * Changes which communities may use a type: whether it is available by default, and the communities that are
 * an exception to that.
 *
 * Opened and closed by its host through `open`: it reports `availability-saved` once stored, and `dialog-closed` when
 * dismissed.
 */
@customElement("cofy-availability-dialog")
export class CofyAvailabilityDialog extends CofyElement {
  public static override styles = [
    utilityStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property({ type: Boolean }) public open = false;
  /** The type to change. */
  @property({ attribute: false }) public availability: TypeAvailability | null = null;

  @state() private isDefault = true;
  @state() private exceptions: string[] = [];
  @state() private saving = false;
  @state() private error: ProblemError | null = null;

  public override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this.isDefault = this.availability?.default ?? true;
      this.exceptions = [...(this.availability?.exceptions ?? [])];
      this.error = null;
    }
  }

  public override render(): TemplateResult {
    const communities = this.cofy?.communities.all() ?? [];
    return html`
      <wa-dialog
        label=${this.t("availabilityDialog.title", { type: this.availability?.type ?? "" })}
        ?open=${this.open}
        @wa-hide=${(event: Event): void => this.onHide(event)}
      >
        <div class="wa-stack">
          ${this.error === null ? nothing : html`<cofy-problem-details .problem=${this.error}></cofy-problem-details>`}
          <wa-switch
            hint=${this.t("availabilityDialog.defaultHint")}
            .checked=${this.isDefault}
            @change=${(event: Event): void => {
              this.isDefault = (event.target as HTMLElement & { checked: boolean }).checked;
            }}
          >
            ${this.t("availabilityDialog.default")}
          </wa-switch>
          <wa-select
            multiple
            with-clear
            label=${this.t(this.isDefault ? "availabilityDialog.notIn" : "availabilityDialog.onlyIn")}
            placeholder=${this.t("availabilityDialog.noCommunities")}
            .value=${this.exceptions}
            lang=${this.i18n?.resolvedLanguage ?? "en"}
            @change=${(event: Event): void => {
              this.exceptions = (event.target as HTMLElement & { value: string[] | null }).value ?? [];
            }}
          >
            ${communities.map(
              (community) => html`<wa-option value=${community.slug}>${community.title || community.slug}</wa-option>`,
            )}
          </wa-select>
        </div>
        <wa-button slot="footer" appearance="plain" @click=${(): void => this.close()}>
          ${this.t("availabilityDialog.cancel")}
        </wa-button>
        <wa-button slot="footer" variant="brand" ?disabled=${this.saving} @click=${(): void => void this.save()}>
          ${this.saving ? this.t("availabilityDialog.saving") : this.t("availabilityDialog.save")}
        </wa-button>
      </wa-dialog>
    `;
  }

  private async save(): Promise<void> {
    if (this.cofy === undefined || this.availability === null) return;

    this.saving = true;
    this.error = null;
    try {
      const body = { default: this.isDefault, exceptions: this.exceptions };
      const { group, type } = this.availability;
      const saved = await this.cofy.typeAvailability.replace({ group, type }, body);
      this.dispatchEvent(
        new CustomEvent("availability-saved", { detail: { type: saved.type }, bubbles: true, composed: true }),
      );
    } catch (error) {
      this.error = error as ProblemError;
    } finally {
      this.saving = false;
    }
  }

  /** The dialog closing itself - Escape, its close button - rather than a nested element hiding. */
  private onHide(event: Event): void {
    if (event.target !== event.currentTarget) return;
    this.close();
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent("dialog-closed", { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-availability-dialog": CofyAvailabilityDialog;
  }
}
