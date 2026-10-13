import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { CommunityInfo, ProblemError } from "@cofy/frontend-sdk";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/skeleton/skeleton.js";
import "@awesome.me/webawesome/dist/components/scroller/scroller.js";

import { CofyElement } from "../../cofy-element.js";
import { tableStyles } from "../../theme/table.js";
import { utilityStyles } from "../../theme/utility-styles.js";
import "../layout/cofy-heading.js";
import "../cofy-problem-details.js";
import "./cofy-community-dialog.js";
import "./cofy-community-status.js";

/**
 * The communities this API will show.
 *
 * The same table pattern as the module list, so the two read alike, and a row is the
 * affordance for opening one. Selecting a community raises `community-selected`; where that
 * leads is the host's business, which is what keeps this usable outside the console's routing.
 *
 * Who may create, change or delete a community gets the buttons to do so; a community just
 * created is selected, so it opens like any other.
 */
@customElement("cofy-community-list")
export class CofyCommunityList extends CofyElement {
  public static override styles = [
    tableStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
      th.actions,
      td.actions {
        inline-size: 1%;
        white-space: nowrap;
        text-align: end;
      }
    `,
  ];

  /** The community the dialog is open for: `null` to create one, `undefined` while it is closed. */
  @state() private editing: CommunityInfo | null | undefined = undefined;
  @state() private deleting = false;
  @state() private deleteError: ProblemError | null = null;

  public override render(): TemplateResult | typeof nothing {
    if (this.cofy === undefined) return nothing;

    const communities = this.cofy.communities.all();
    const error = this.cofy.communities.error();

    if (error !== null) return html`<cofy-problem-details .problem=${error}></cofy-problem-details>`;
    if (communities === undefined) {
      return html`<div class="wa-stack">
        ${Array.from({ length: 4 }, () => html`<wa-skeleton></wa-skeleton>`)}
      </div>`;
    }

    return html`
      <div class="wa-stack">
        <cofy-heading>
          <span slot="title">${this.t("communityList.title")}</span>
          <span slot="description">${this.t("communityList.description")}</span>
          ${this.mayManage()
            ? html`<wa-button
                slot="actions"
                variant="brand"
                @click=${(): void => {
                  this.editing = null;
                }}
              >
                ${this.t("communityList.add")}
              </wa-button>`
            : nothing}
        </cofy-heading>

        ${this.deleteError === null
          ? nothing
          : html`<cofy-problem-details .problem=${this.deleteError}></cofy-problem-details>`}

        <wa-scroller>
          <table>
            <thead>
              <tr>
                <th scope="col">${this.t("communityList.columns.community")}</th>
                <th scope="col">${this.t("communityList.columns.slug")}</th>
                <th scope="col">${this.t("communityList.columns.modules")}</th>
                <th scope="col">${this.t("communityList.columns.status")}</th>
                <th scope="col" class="actions"><span class="wa-visually-hidden">${this.t("communityList.columns.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              ${communities.length === 0
                ? html`<tr class="empty">
                    <td class="secondary" colspan="5">${this.t("communityList.empty")}</td>
                  </tr>`
                : communities.map((community): TemplateResult => this.row(community))}
            </tbody>
          </table>
        </wa-scroller>
      </div>

      <cofy-community-dialog
        .open=${this.editing !== undefined}
        .community=${this.editing ?? null}
        @community-saved=${(event: CustomEvent<{ slug: string }>): void => this.onSaved(event.detail.slug)}
        @dialog-closed=${(): void => {
          this.editing = undefined;
        }}
      ></cofy-community-dialog>
    `;
  }

  /**
   * A row opens its community; the buttons in it change or delete it.
   *
   * `<tr>` is not focusable of its own accord the way a framework's row component is, so the
   * keyboard handling here is what keeps the list usable without a mouse.
   */
  private row(community: CommunityInfo): TemplateResult {
    return html`
      <tr
        data-slug=${community.slug}
        tabindex="0"
        @click=${(): void => this.select(community.slug)}
        @keydown=${(event: KeyboardEvent): void => this.onKeydown(event, community)}
      >
        <td>${community.title || community.slug}</td>
        <td class="secondary">${community.slug}</td>
        <td>${community.module_count}</td>
        <td><cofy-community-status .slug=${community.slug}></cofy-community-status></td>
        <td class="actions">${this.actions(community)}</td>
      </tr>
    `;
  }

  /** Each button stops its click, or the row's own handler would also open the community. */
  private actions(community: CommunityInfo): TemplateResult {
    if (!this.mayManage()) return html``;

    return html`
      <wa-button
        appearance="plain"
        size="small"
        @click=${(event: MouseEvent): void => {
          event.stopPropagation();
          this.editing = community;
        }}
      >
        ${this.t("communityList.edit")}
      </wa-button>
      <wa-button
        appearance="plain"
        size="small"
        ?disabled=${this.deleting}
        @click=${(event: MouseEvent): void => {
          event.stopPropagation();
          void this.deleteCommunity(community);
        }}
      >
        ${this.deleting ? this.t("communityList.deleting") : this.t("communityList.delete")}
      </wa-button>
    `;
  }

  /** Whether the person logged in may create and delete communities - outside any one of them. */
  private mayManage(): boolean {
    return this.cofy.session.can("write", "community", null);
  }

  private onSaved(slug: string): void {
    const created = this.editing === null;
    this.editing = undefined;
    if (created) this.select(slug);
  }

  /** Delete one community, after asking: everything configured in it goes with it. */
  private async deleteCommunity(community: CommunityInfo): Promise<void> {
    const name = community.title || community.slug;
    if (!window.confirm(this.t("communityList.deleteConfirm", { name }))) return;

    this.deleting = true;
    this.deleteError = null;
    try {
      await this.cofy.communities.delete(community.slug);
    } catch (error) {
      this.deleteError = error as ProblemError;
    } finally {
      this.deleting = false;
    }
  }

  private onKeydown(event: KeyboardEvent, community: CommunityInfo): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.select(community.slug);
  }

  private select(slug: string): void {
    this.dispatchEvent(
      new CustomEvent("community-selected", {
        detail: { slug },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-community-list": CofyCommunityList;
  }
}
