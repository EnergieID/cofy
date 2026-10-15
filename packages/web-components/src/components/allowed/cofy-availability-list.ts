import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "@awesome.me/webawesome/dist/components/scroller/scroller.js";
import "@awesome.me/webawesome/dist/components/skeleton/skeleton.js";

import { CofyElement } from "../../cofy-element.js";
import { tableStyles } from "../../theme/table.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import "../layout/cofy-heading.js";
import "../cofy-problem-details.js";
import "./cofy-availability-dialog.js";
import "./cofy-type-label.js";
import type { TypeAvailability } from "@cofy/frontend-sdk";

/** Every type, with which communities may use it, each changed in a dialog - for a system admin. */
@customElement("cofy-availability-list")
export class CofyAvailabilityList extends CofyElement {
  public static override styles = [
    tableStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
      td {
        vertical-align: middle;
      }
    `,
  ];

  /** The type whose availability is being changed in the dialog. */
  @state() private editing: TypeAvailability | null = null;

  public override render(): TemplateResult | typeof nothing {
    if (this.cofy === undefined) return nothing;

    const types = this.cofy.typeAvailability.all();
    const error = this.cofy.typeAvailability.error();

    if (error != null) return html`<cofy-problem-details .problem=${error}></cofy-problem-details>`;
    if (types === undefined) {
      return html`<div class="wa-stack">${Array.from({ length: 4 }, () => html`<wa-skeleton></wa-skeleton>`)}</div>`;
    }

    return html`
      <div class="wa-stack">
        <cofy-heading>
          <span slot="title">${this.t("availabilityList.title")}</span>
          <span slot="description">${this.t("availabilityList.description")}</span>
        </cofy-heading>

        <wa-scroller>
          <table>
            <thead>
              <tr>
                <th scope="col">${this.t("availabilityList.columns.type")}</th>
                <th scope="col">${this.t("availabilityList.columns.availability")}</th>
              </tr>
            </thead>
            <tbody>
              ${types.map((type) => this.row(type))}
            </tbody>
          </table>
        </wa-scroller>
      </div>

      <cofy-availability-dialog
        .open=${this.editing !== null}
        .availability=${this.editing}
        @dialog-closed=${(): void => {
          this.editing = null;
        }}
        @availability-saved=${(): void => {
          this.editing = null;
        }}
      ></cofy-availability-dialog>
    `;
  }

  private row(type: TypeAvailability): TemplateResult {
    return html`
      <tr
        data-key=${`${type.group}/${type.type}`}
        tabindex="0"
        @click=${(): void => this.edit(type)}
        @keydown=${(event: KeyboardEvent): void => this.onKeydown(event, type)}
      >
        <td>
          <cofy-type-label group=${type.group} type=${type.type} description=${type.description}></cofy-type-label>
        </td>
        <td>${this.summary(type)}</td>
      </tr>
    `;
  }

  /** Where a type is available: by default, and how many communities are an exception to that. */
  private summary(type: TypeAvailability): string {
    const count = (type.exceptions ?? []).length;
    return this.t((type.default ?? true) ? "availabilityList.exceptIn" : "availabilityList.onlyIn", { count });
  }

  private onKeydown(event: KeyboardEvent, type: TypeAvailability): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.edit(type);
  }

  private edit(type: TypeAvailability): void {
    this.editing = type;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-availability-list": CofyAvailabilityList;
  }
}
