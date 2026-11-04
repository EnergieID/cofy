import { consume } from "@lit/context";
import { css, html } from "lit";
import type { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "../../icons.js";

import { CofyElement } from "../../cofy-element.js";
import { themeStateContext } from "../../context.js";
import { COLOR_SCHEMES, type ColorScheme, type ThemeState } from "../../theme/theme-state.js";

/** The icon each scheme is shown with, on the button and in the menu. */
const ICONS: Record<ColorScheme, string> = {
  system: "circle-half-stroke",
  light: "sun",
  dark: "moon",
  energyid: "palette",
};

/**
 * Chooses the colour scheme for the whole page, from an icon button. The button shows the same
 * icon whatever is chosen, as on the website: it names the control, not the choice.
 *
 * "System" is a standing choice rather than a one-off reading: pick it and the page follows the
 * operating system from then on, including a change made while the page is open.
 */
@customElement("cofy-theme-picker")
export class CofyThemePicker extends CofyElement {
  public static override styles = css`
    :host {
      display: inline-block;
    }
  `;

  @consume({ context: themeStateContext, subscribe: true })
  public theme!: ThemeState;

  public override render(): TemplateResult {
    const label = this.t("settings.theme.legend", { defaultValue: "Appearance" });

    return html`
      <wa-dropdown
        placement="bottom-end"
        lang=${this.i18n?.resolvedLanguage ?? "en"}
        @wa-select=${(event: CustomEvent<{ item: { value: string } }>): void => this.select(event.detail.item.value)}
      >
        <wa-button slot="trigger" appearance="plain" title=${label}>
          <wa-icon name=${ICONS.system} library="cofy" label=${label}></wa-icon>
        </wa-button>
        ${repeat(
          COLOR_SCHEMES,
          (option) => option,
          (option): TemplateResult => html`
            <wa-dropdown-item value=${option}>
              <wa-icon slot="icon" name=${ICONS[option]} library="cofy"></wa-icon>
              ${this.nameOf(option)}
            </wa-dropdown-item>
          `,
        )}
      </wa-dropdown>
    `;
  }

  private nameOf(scheme: ColorScheme): string {
    return this.t(`settings.theme.names.${scheme}`, { defaultValue: scheme });
  }

  private select(scheme: string): void {
    if ((COLOR_SCHEMES as readonly string[]).includes(scheme)) this.theme.select(scheme as ColorScheme);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-theme-picker": CofyThemePicker;
  }
}
