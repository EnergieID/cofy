import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore } from "@cofy/frontend-sdk";
import { StateController } from "@dodona/lit-state";
import type { Resource } from "i18next";

import { cofyStoreContext, createI18n, i18nContext, nativeStyles, utilityStyles } from "../index.js";
import "../index.js";
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { crumbStateContext, routeStateContext } from "./context.js";
import { followLink } from "./follow-link.js";
import { CONSOLE_NAMESPACE } from "./i18n.js";
import { ConsoleState } from "./states/console-state.js";

export type { ConsoleMenuItem } from "./states/console-state.js";

/**
 * The console's pages, for a host to place: the console's own shell, or another app embedding it - then inside one
 * community, in the language of its `lang`, with any of its strings replaced through {@link translations}. Without a header, menu or pickers, or a theme: the host draws those, and sets the
 * theme's custom properties, as for any Web Awesome component.
 *
 * What a host draws around it comes from its {@link state}: the menu, the trail to the page showing. A host hands in
 * a state of its own, as the console's own shell does with its stores and translations, or reads the one the console
 * makes from its attributes, once it has rendered.
 *
 * The console's pages lie under *base-path* on the host's site, and it asks the host to go elsewhere with a
 * `cofy-navigate` event (see `HostLocation`). COFY's API is served by the host under *api-path*, so its session
 * cookie is the host's site's; without a login, the console sends the browser through COFY's login, which comes back
 * to the page it was on.
 */
@customElement("cofy-console")
export class CofyConsole extends LitElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** The community shown, by slug; without one, every page is. */
  @property() public community?: string;

  /** Where the host shows the console, such as `/w/1/cofy`; its links lead under it. */
  @property({ attribute: "base-path" }) public basePath = "";

  /** Where the host serves COFY's API, such as `/cofy`, and its login. */
  @property({ attribute: "api-path" }) public apiPath = "";

  /** The page shown as the host shows it, under the base, such as `/secrets`: set by a host that navigates itself. */
  @property() public path?: string;

  /** The id at the identity provider of whoever the host has logged in: a COFY session of someone else is ended. */
  @property() public user?: string;

  /** The language to show, falling back to English for what isn't translated; the page's when not set. */
  @property() public override lang = "";

  /** Strings replacing the console's own, key by key, by language and namespace (`console` or `components`). */
  @property({ attribute: false }) public translations?: Resource;

  /** The console's state: handed in by a host, or made from the attributes above. */
  @property({ attribute: false }) public state?: ConsoleState;

  public readonly stateController = new StateController(this);

  // Provided once there is a state, and the translations once loaded.
  private readonly cofyProvider = new ContextProvider(this, { context: cofyStoreContext });
  private readonly routeProvider = new ContextProvider(this, { context: routeStateContext });
  private readonly crumbProvider = new ContextProvider(this, { context: crumbStateContext });
  private readonly i18nProvider = new ContextProvider(this, { context: i18nContext });

  /** Whether the state is the console's own, made from its attributes, rather than its host's. */
  private ownState = false;
  @state() private translated = false;
  private unwatchPath?: () => void;
  private switchingUser = false;

  public constructor() {
    super();
    this.addEventListener("click", this.onClick);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.release();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const attributes = changed.has("community") || changed.has("basePath") || changed.has("apiPath");
    if (changed.has("state") && !this.ownState) this.adopt();
    else if (attributes && (this.state === undefined || this.ownState)) this.makeState();
    if (changed.has("lang") && this.lang !== "") void this.state?.i18n?.changeLanguage(this.lang);
    if (changed.has("path") && this.path !== undefined) this.state?.show(this.path);
  }

  public override render(): TemplateResult | typeof nothing {
    const state = this.state;
    if (state === undefined || state.i18n === undefined || !this.translated) return nothing;

    // Nothing until the login is known, which reading it asks for. Without one, the browser is already on its way to
    // log in.
    const me = state.store.session.get();
    if (me === undefined) {
      const error = state.store.session.error();
      return error !== null && error.status !== 401
        ? html`<cofy-problem-details .problem=${error}></cofy-problem-details>`
        : html``;
    }
    // Logged in as someone else than the host has: on the way to log in again, see `updated`.
    if (this.isSomeoneElse()) return html``;

    return html`
      <main class="wa-stack">
        <cofy-breadcrumbs part="breadcrumbs" .crumbs=${state.crumbs.crumbs}></cofy-breadcrumbs>
        ${state.routes.render() ??
        html`<p>${state.i18n.t("notFound", { ns: CONSOLE_NAMESPACE, path: state.routes.path })}</p>`}
      </main>
    `;
  }

  protected override updated(): void {
    if (this.isSomeoneElse()) this.switchUser();
  }

  /** The console's own state, from its attributes, replacing any earlier one. */
  private makeState(): void {
    this.release();
    const login = (): void => this.state?.store.session.login();
    const store = new CofyStore(new ApiClient({ baseUrl: this.apiPath, onUnauthenticated: login }));
    this.ownState = true;
    this.state = new ConsoleState({ store, base: this.basePath, community: this.community, target: this });
    this.state.start();
    this.provide();
    void this.loadTranslations(this.state);
  }

  /** The state a host handed in, which the host starts and stops. */
  private adopt(): void {
    this.release();
    this.provide();
  }

  /** Provide the state's parts to the pages, and follow where it is. */
  private provide(): void {
    const state = this.state;
    if (state === undefined) return;
    this.cofyProvider.setValue(state.store);
    this.routeProvider.setValue(state.routes);
    this.crumbProvider.setValue(state.crumbs);
    if (state.i18n !== undefined) this.useTranslations(state.i18n);
    // The path the host sees, also after the console went somewhere itself, so the host setting it again is a change.
    this.unwatchPath = state.location.subscribe(() => {
      this.path = state.location.hostPath;
    }, "path");
  }

  private release(): void {
    this.unwatchPath?.();
    if (this.ownState) this.state?.stop();
  }

  private async loadTranslations(state: ConsoleState): Promise<void> {
    state.i18n = await createI18n({
      language: this.lang || document.documentElement.lang || undefined,
      overrides: this.translations,
      storage: null,
    });
    if (state === this.state) this.useTranslations(state.i18n);
  }

  private useTranslations(i18n: NonNullable<ConsoleState["i18n"]>): void {
    this.i18nProvider.setValue(i18n);
    this.translated = true;
  }

  /** Whether COFY's session is someone else's than whoever the host has logged in. */
  private isSomeoneElse(): boolean {
    const me = this.state?.store.session.get();
    return this.user !== undefined && me !== undefined && me.subject !== this.user;
  }

  /** Log in as whoever the host has, whose login replaces a session that is someone else's. */
  private switchUser(): void {
    if (this.switchingUser) return;
    this.switchingUser = true;
    this.state?.store.session.login();
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (this.state !== undefined) followLink(event, this.state.location);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-console": CofyConsole;
  }
}
