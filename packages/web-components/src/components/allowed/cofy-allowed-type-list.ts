import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CommunityTypeAvailability, ProblemError, TypeId } from "@cofy/frontend-sdk";

import "@awesome.me/webawesome/dist/components/scroller/scroller.js";
import "@awesome.me/webawesome/dist/components/skeleton/skeleton.js";
import "@awesome.me/webawesome/dist/components/switch/switch.js";

import { CofyElement } from "../../cofy-element.js";
import { tableStyles } from "../../theme/table.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import "../layout/cofy-heading.js";
import "../cofy-problem-details.js";
import "./cofy-type-label.js";

/** Every type, each with a switch allowing it to a community or not - for a system admin. */
@customElement("cofy-allowed-type-list")
export class CofyAllowedTypeList extends CofyElement {
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
      tbody tr,
      tbody tr:hover {
        cursor: default;
        background: none;
      }
      td.allowed {
        inline-size: 1%;
        white-space: nowrap;
      }
    `,
  ];

  @property({ type: String }) public slug = "";

  /** The types whose change is under way, by group and type, so their switches can't be changed again before it is done. */
  @state() private changing: ReadonlySet<string> = new Set();
  @state() private changeError: ProblemError | null = null;

  public override render(): TemplateResult | typeof nothing {
    if (this.cofy === undefined || this.slug === "") return nothing;

    const types = this.cofy.communityTypeAvailability.all(this.slug);
    const error = this.changeError ?? this.cofy.communityTypeAvailability.error(this.slug);

    if (error != null) return html`<cofy-problem-details .problem=${error}></cofy-problem-details>`;
    if (types === undefined) {
      return html`<div class="wa-stack">${Array.from({ length: 4 }, () => html`<wa-skeleton></wa-skeleton>`)}</div>`;
    }

    return html`
      <div class="wa-stack">
        <cofy-heading>
          <span slot="title">${this.t("allowedTypeList.title")}</span>
          <span slot="description">${this.t("allowedTypeList.description")}</span>
        </cofy-heading>

        <wa-scroller>
          <table>
            <thead>
              <tr>
                <th scope="col">${this.t("allowedTypeList.columns.type")}</th>
                <th scope="col">${this.t("allowedTypeList.columns.allowed")}</th>
              </tr>
            </thead>
            <tbody>
              ${types.map((type) => this.row(type))}
            </tbody>
          </table>
        </wa-scroller>
      </div>
    `;
  }

  private row(type: CommunityTypeAvailability): TemplateResult {
    return html`
      <tr data-key=${key(type)}>
        <td>
          <cofy-type-label group=${type.group} type=${type.type} description=${type.description}></cofy-type-label>
        </td>
        <td class="allowed">
          <wa-switch
            aria-label=${this.t("allowedTypeList.allow", { type: type.type })}
            .checked=${type.allowed}
            ?disabled=${this.changing.has(key(type))}
            @change=${(event: Event): void => {
              void this.change(type, (event.target as HTMLElement & { checked: boolean }).checked);
            }}
          ></wa-switch>
        </td>
      </tr>
    `;
  }

  private async change(id: TypeId, allowed: boolean): Promise<void> {
    this.changing = new Set([...this.changing, key(id)]);
    this.changeError = null;
    try {
      await this.cofy.communityTypeAvailability.setAllowed(this.slug, { group: id.group, type: id.type }, allowed);
    } catch (error) {
      this.changeError = error as ProblemError;
    } finally {
      this.changing = new Set([...this.changing].filter((changing) => changing !== key(id)));
    }
  }
}

/** The key of a type, unique among them. */
function key(id: TypeId): string {
  return `${id.group}/${id.type}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-allowed-type-list": CofyAllowedTypeList;
  }
}
