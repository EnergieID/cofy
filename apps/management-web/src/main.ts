// Web Awesome's theme, native-element styles and utility classes. First, so that everything
// after it - including the app's own rules - wins on ordinary cascade order. Its component
// styles sit in `@layer wa-component`, which unlayered CSS beats regardless.
import "@awesome.me/webawesome/dist/styles/webawesome.css";

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/page/page.js";
import type WaPage from "@awesome.me/webawesome/dist/components/page/page.js";

import { provide } from "@lit/context";
import { ApiClient, CofyStore } from "@cofy/frontend-sdk";
import { StateController } from "@dodona/lit-state";
import {
  ThemeState,
  cofyStoreContext,
  createI18n,
  i18nContext,
  nativeStyles,
  themeStateContext,
  utilityStyles,
} from "@cofy/web-components";
import "@cofy/web-components";
import { LitElement, css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, query } from "lit/decorators.js";

import { ConsoleState, MENU_FOOTER_GROUPS, MENU_GROUPS, followLink } from "@cofy/web-components/console";
import "./components/cofy-account-menu.js";
import "./components/cofy-navigation.js";
import { APP_NAMESPACE, APP_RESOURCES, LANGUAGES } from "./i18n.js";
import "./styles.css";
import "@cofy/web-components/theme/cofy.css";
import "@cofy/web-components/theme/energyid.css";
import "./brand.css";
import "@cofy/web-components/theme/syntax.css";

// Awaited before anything renders: the shell's strings beside the console's and its components', bundled.
const i18n = await createI18n({
  supportedLanguages: LANGUAGES,
  resources: APP_RESOURCES,
});

// Puts the colour scheme on the root element and keeps following the operating system while
// the reader has not chosen otherwise. The brand colour is CSS (the COFY theme, then `brand.css`), not code.
const theme = new ThemeState();
theme.start();

/**
 * Where the console's pages are: apart from the communities' own APIs, which a deployment serves at
 * `/communities/<slug>/` on the same site.
 */
const BASE = "/console";

// The site's root is the console's home.
if (window.location.pathname === "/") window.history.replaceState(null, "", BASE);

/**
 * The console shell: the header and the menu around `<cofy-console>`, which shows the pages - as it does embedded in
 * another app. It knows about no individual page: adding one is a new module and one entry in `routes.ts`.
 *
 * It owns the store, the theme and the translations, which the header's pickers and account menu share with the
 * console, and the console's state, from which it draws the menu and, where there is room, the trail. A link in the
 * header or the menu goes to its page the way one in the console does.
 *
 * It does not extend `CofyElement` the way the pages do: an element that both provides and
 * consumes a context is deliberately skipped by its own provider, so the shell reads the
 * instance it built directly.
 */
@customElement("cofy-app")
export class CofyApp extends LitElement {
  public static override styles = [
    nativeStyles,
    utilityStyles,
    css`
      :host {
        display: block;
        min-block-size: 100vh;
      }
      /* A column for the menu only when there is one: someone without any community has none. */
      wa-page {
        --menu-width-desktop: 16rem;
        --menu-width: 0px;
        background-color: var(--cofy-page-background);
      }
      wa-page:has(> [slot="navigation"]) {
        --menu-width: var(--menu-width-desktop);
      }
      wa-page[view="mobile"] {
        --menu-width: auto;
      }
      wa-page[view="desktop"]:has(> [slot="navigation"])::part(menu) {
        border-inline-end: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      }
      /* As high as the docs' header, Starlight's 3.5rem and 4rem from 50rem on, unless the theme sets a height. */
      [slot="header"] {
        inline-size: 100%;
        block-size: var(--cofy-header-height, 3.5rem);
        padding-block: 0;
        padding-inline: var(--wa-space-l);
        border-block-end: var(--wa-border-width-s) solid var(--wa-color-surface-border);
        background-color: var(--cofy-header-background);
        /* What the plain buttons in it are drawn with. Their menus draw nothing with these but a
           submenu's arrow, so they keep the page's colours. */
        --wa-color-neutral-on-quiet: var(--cofy-header-control);
        --wa-color-neutral-fill-quiet: var(--cofy-header-control-hover);
      }
      [slot="header"] cofy-breadcrumbs {
        --wa-color-text-link: var(--cofy-header-link);
        --wa-color-text-quiet: var(--cofy-header-text);
      }
      /* In the header where there is room for it, above the page where there isn't. */
      wa-page[view="desktop"] cofy-console::part(breadcrumbs) {
        display: none;
      }
      /* On a short screen the menu scrolls above its foot, rather than running under it. */
      [slot="navigation"] {
        overflow-y: auto;
      }
      /* A menu with nothing to list hides itself, which wa-page's own display for what it holds would undo. */
      cofy-navigation[hidden] {
        display: none;
      }
      /* Full width, also in the mobile drawer, whose footer would push it to the end. */
      [slot="navigation-footer"] {
        inline-size: 100%;
        border-block-start: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      }
      /* The brand at the size the docs give it, on the website too: COFY in the brand colour, what
         this is beside it. */
      .brand {
        color: var(--cofy-header-brand);
        font-size: var(--wa-font-size-xl);
        font-weight: var(--wa-font-weight-bold);
        text-decoration: none;
        white-space: nowrap;
      }
      .brand wa-icon {
        font-size: var(--cofy-header-logo-size, var(--wa-space-2xl));
      }
      .brand .sub-brand {
        color: var(--cofy-header-text);
        font-size: var(--wa-font-size-l);
        font-weight: var(--wa-font-weight-normal);
      }
      @media (min-width: 50rem) {
        [slot="header"] {
          block-size: var(--cofy-header-height, var(--wa-space-4xl));
        }
      }
      wa-page[view="mobile"] [slot="header"] {
        padding-inline: var(--wa-space-xs);
      }
      wa-page::part(drawer) {
        --spacing: 0;
      }
      /* On desktop the trail starts where the page under it does: the brand's column is as wide as
         what lies left of the page's column. */
      wa-page[view="desktop"] [slot="header"] {
        display: grid;
        /* Never narrower than the brand, which without a menu may be wider than what lies left of the page. */
        grid-template-columns: minmax(max-content, var(--content-start)) minmax(0, 1fr) auto;
        gap: 0;
      }
      wa-page[view="mobile"] .brand {
        font-size: var(--wa-font-size-l);
      }
      wa-page[view="mobile"] .brand wa-icon {
        font-size: var(--cofy-header-logo-size, var(--wa-space-xl));
      }
      wa-page[view="mobile"] .brand .sub-brand {
        font-size: var(--wa-font-size-m);
      }
      /* What the page says lines up in one column, centred on the screen rather than beside the
         menu where there is room for that, as in the docs. */
      cofy-console {
        max-inline-size: 60rem;
        margin-inline: auto;
        padding: var(--wa-space-l);
      }
      wa-page[view="desktop"] {
        /* Where the page's column starts: centred on the screen, or else right beside the menu. */
        --content-start: max(var(--menu-width), (100vw - 60rem) / 2);
      }
      wa-page[view="desktop"] cofy-console {
        margin-inline-start: calc(var(--content-start) - var(--menu-width));
      }
    `,
  ];

  // A request turned away for want of a login sends the browser off to log in, coming back here.
  private readonly api: ApiClient = new ApiClient({ onUnauthenticated: (): void => this.cofy.session.login() });

  @provide({ context: cofyStoreContext })
  public cofy = new CofyStore(this.api);

  @provide({ context: i18nContext })
  public i18n = i18n;

  @provide({ context: themeStateContext })
  public theme = theme;

  /** Where the console is, what it shows and lists: for the console, and for the menu and the trail here. */
  public consoleState = new ConsoleState({ store: this.cofy, base: BASE, target: this, i18n });

  public readonly stateController = new StateController(this);

  @query("wa-page") private page?: WaPage;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.consoleState.start();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.consoleState.stop();
  }

  public override render(): TemplateResult {
    // Nothing until the login is known, which reading it asks for. Without one, the browser is
    // already on its way to log in.
    if (this.cofy.session.get() === undefined) {
      const error = this.cofy.session.error();
      return error !== null && error.status !== 401
        ? html`<cofy-problem-details .problem=${error}></cofy-problem-details>`
        : html``;
    }

    return html`
      <wa-page
        @click=${(event: MouseEvent): void => {
          // The menu's drawer on mobile closes itself only for a link in its own tree, which the menu's shadow root
          // hides from it. A link in the console is followed by the console, before this.
          if (followLink(event, this.consoleState.location)) this.page?.hideNavigation();
        }}
      >
        <header slot="header" class="wa-split wa-flex-nowrap">
          <div class="wa-cluster wa-gap-xs wa-flex-nowrap">
            ${this.hasMenu()
              ? html`
                  <wa-button data-toggle-nav appearance="plain" class="wa-mobile-only" title=${this.t("menu.open")}>
                    <wa-icon name="bars" library="cofy" label=${this.t("menu.open")}></wa-icon>
                  </wa-button>
                `
              : nothing}
            <a class="brand wa-cluster wa-gap-xs" href=${BASE}>
              <wa-icon name="brand" library="cofy"></wa-icon>
              <span>${this.t("product")} <span class="sub-brand">${this.t("subtitle")}</span></span>
            </a>
          </div>
          <cofy-breadcrumbs class="wa-desktop-only" .crumbs=${this.consoleState.crumbs.crumbs}></cofy-breadcrumbs>
          <div class="wa-cluster wa-gap-2xs wa-flex-nowrap">
            <cofy-locale-picker></cofy-locale-picker>
            <cofy-theme-picker></cofy-theme-picker>
            <cofy-account-menu></cofy-account-menu>
          </div>
        </header>

        ${this.menu()}

        <cofy-console .state=${this.consoleState}></cofy-console>
      </wa-page>
    `;
  }

  /**
   * The menu down the side, unless it would list nothing - then wa-page leaves out its column, and
   * the toggle that opens it on mobile.
   */
  private menu(): TemplateResult | typeof nothing {
    const items = this.consoleState.menu();
    if (items.length === 0) return nothing;
    return html`
      <cofy-navigation slot="navigation" .items=${items} .groups=${MENU_GROUPS}></cofy-navigation>
      <cofy-navigation slot="navigation-footer" .items=${items} .groups=${MENU_FOOTER_GROUPS}></cofy-navigation>
    `;
  }

  private hasMenu(): boolean {
    return this.consoleState.menu().length > 0;
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.i18n.t(key, { ns: APP_NAMESPACE, ...params });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cofy-app": CofyApp;
  }
}
