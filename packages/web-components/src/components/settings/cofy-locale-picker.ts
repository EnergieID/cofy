import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "../../icons.js";

import { CofyElement } from "../../cofy-element.js";

/**
 * Chooses the language for the whole page, from an icon button beside `cofy-theme-picker`.
 *
 * A menu rather than radio buttons: the list of languages grows with the deployment, and a
 * European product will not stop at two. With only one language there is nothing to choose, and
 * the element hides itself, so a layout around it doesn't leave room for it either.
 */
@customElement("cofy-locale-picker")
export class CofyLocalePicker extends CofyElement {
  public static override styles = css`
    :host {
      display: inline-block;
    }
    :host([hidden]) {
      display: none;
    }
  `;

  /** The languages this deployment serves. Defaults to whatever i18next was configured with. */
  @property({ attribute: false }) public languages?: readonly string[];

  public override willUpdate(): void {
    this.hidden = !this.offersAChoice();
  }

  public override render(): TemplateResult | typeof nothing {
    if (this.i18n === undefined || !this.offersAChoice()) return nothing;
    const languages = this.languages ?? this.configured();
    const current = this.i18n.resolvedLanguage ?? this.i18n.language;
    const label = `${this.t("settings.language.legend", { defaultValue: "Language" })}: ${this.nameOf(current)}`;

    return html`
      <wa-dropdown
        placement="bottom-end"
        lang=${this.i18n.resolvedLanguage ?? "en"}
        @wa-select=${(event: CustomEvent<{ item: { value: string } }>): void => this.select(event.detail.item.value)}
      >
        <wa-button slot="trigger" appearance="plain" title=${label}>
          <wa-icon name="language" library="cofy" label=${label}></wa-icon>
        </wa-button>
        ${repeat(
          languages,
          (language) => language,
          (language): TemplateResult =>
            html`<wa-dropdown-item value=${language} lang=${language}>${this.nameOf(language)}</wa-dropdown-item>`,
        )}
      </wa-dropdown>
    `;
  }

  private offersAChoice(): boolean {
    return (this.languages ?? this.configured()).length >= 2;
  }

  /** The language's own name for itself, which is what a reader looking for it expects. */
  private nameOf(language: string): string {
    const names = new Intl.DisplayNames([language], { type: "language" });
    return names.of(language) ?? language;
  }

  private configured(): readonly string[] {
    const supported: unknown = this.i18n?.options.supportedLngs;
    if (!Array.isArray(supported)) return [];
    // i18next appends this sentinel to whatever it was given.
    return supported.filter((language): language is string => typeof language === "string" && language !== "cimode");
  }

  private select(language: string): void {
    if (language === this.i18n?.resolvedLanguage) return;
    void this.i18n?.changeLanguage(language);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-locale-picker": CofyLocalePicker;
  }
}
