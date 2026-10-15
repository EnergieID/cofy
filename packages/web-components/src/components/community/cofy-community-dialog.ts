import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CommunityBody, CommunityInfo, ProblemError } from "@cofy/frontend-sdk";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/switch/switch.js";
import "@awesome.me/webawesome/dist/components/textarea/textarea.js";
import "../cofy-problem-details.js";

import { CofyElement } from "../../cofy-element.js";
import { utilityStyles } from "../../theme/utility-styles.js";

/**
 * Creates a community, or - given `community` - changes an existing one's settings.
 *
 * Opened and closed by its host through `open`: it reports `community-saved` with the
 * community's slug once stored, and `dialog-closed` when dismissed.
 */
@customElement("cofy-community-dialog")
export class CofyCommunityDialog extends CofyElement {
  public static override styles = [
    utilityStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property({ type: Boolean }) public open = false;
  /** The community to change, or `null` to create one. */
  @property({ attribute: false }) public community: CommunityInfo | null = null;

  /**
   * The community being changed, as it was when the dialog opened: the host clears `community` as it closes, and
   * the dialog should not turn into the create form while it animates out.
   */
  @state() private changing: CommunityInfo | null = null;
  @state() private slug = "";
  @state() private communityTitle = "";
  @state() private description = "";
  @state() private debugMode = false;
  @state() private saving = false;
  @state() private error: ProblemError | null = null;

  public override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this.changing = this.community;
      this.slug = this.community?.slug ?? "";
      this.communityTitle = this.community?.title ?? "";
      this.description = this.community?.description ?? "";
      this.debugMode = this.community?.debug_mode ?? false;
      this.error = null;
    }
  }

  public override render(): TemplateResult {
    const editing = this.changing !== null;
    const label = editing
      ? this.t("communityDialog.changeTitle", { name: this.changing?.title || this.slug })
      : this.t("communityDialog.title");

    return html`
      <wa-dialog label=${label} ?open=${this.open} @wa-hide=${(event: Event): void => this.onHide(event)}>
        <div class="wa-stack">
          ${this.error === null ? nothing : html`<cofy-problem-details .problem=${this.error}></cofy-problem-details>`}
          ${editing
            ? nothing
            : html`<wa-input
                label=${this.t("communityDialog.slug")}
                hint=${this.t("communityDialog.slugHint")}
                required
                .value=${this.slug}
                @input=${(event: Event): void => {
                  this.slug = this.inputValue(event);
                }}
              ></wa-input>`}
          <wa-input
            label=${this.t("communityDialog.name")}
            required
            .value=${this.communityTitle}
            @input=${(event: Event): void => {
              this.communityTitle = this.inputValue(event);
            }}
          ></wa-input>
          <wa-textarea
            label=${this.t("communityDialog.description")}
            .value=${this.description}
            @input=${(event: Event): void => {
              this.description = this.inputValue(event);
            }}
          ></wa-textarea>
          <wa-switch
            hint=${this.t("communityDialog.debugModeHint")}
            .checked=${this.debugMode}
            @change=${(event: Event): void => {
              this.debugMode = (event.target as HTMLElement & { checked?: boolean }).checked ?? false;
            }}
          >
            ${this.t("communityDialog.debugMode")}
          </wa-switch>
        </div>
        <wa-button slot="footer" appearance="plain" @click=${(): void => this.close()}>
          ${this.t("communityDialog.cancel")}
        </wa-button>
        <wa-button
          slot="footer"
          variant="brand"
          ?disabled=${this.slug === "" || this.communityTitle === "" || this.saving}
          @click=${(): void => void this.save()}
        >
          ${this.saving
            ? this.t("communityDialog.saving")
            : editing
              ? this.t("communityDialog.save")
              : this.t("communityDialog.create")}
        </wa-button>
      </wa-dialog>
    `;
  }

  private inputValue(event: Event): string {
    return (event.target as HTMLElement & { value?: string }).value ?? "";
  }

  private body(): CommunityBody {
    return { title: this.communityTitle, description: this.description, debug_mode: this.debugMode };
  }

  private async save(): Promise<void> {
    const cofy = this.cofy;
    if (cofy === undefined) return;

    this.saving = true;
    this.error = null;
    try {
      const saved =
        this.changing === null
          ? await cofy.communities.create({ slug: this.slug, ...this.body() })
          : await cofy.communities.replace(this.changing.slug, this.body());
      this.dispatchEvent(
        new CustomEvent("community-saved", { detail: { slug: saved.slug }, bubbles: true, composed: true }),
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
    "cofy-community-dialog": CofyCommunityDialog;
  }
}
