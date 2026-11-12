# COFY management console

The default management console for a COFY deployment: a web UI for creating and configuring
communities and their modules against the [COFY Management API](../../packages/management-api).
It's built from [@cofy/web-components](../../packages/web-components) and
[@cofy/frontend-sdk](../../packages/frontend-sdk); route 2 in the [root README](../../README.md)
uses this app, and [apps/demo_multitenant](../demo_multitenant) packages it together with the
management API into a single deployable image.

You don't need to touch this app just to run route 2 - see
[apps/demo_multitenant](../demo_multitenant) for that. Come here if you want to run the console
on its own, customise it (branding, translations, pages), or use it as a starting point for your
own.

## Running locally

Expects a management API on `:8000` (see
[apps/demo_multitenant](../demo_multitenant#running) for how to start one against seeded local
data):

```sh
npm install
npm run dev
```

Serves the console at http://127.0.0.1:5173, proxying `/management` requests to the API so the
browser only ever talks to one origin - no CORS, no base URL to configure. Its pages are under `/console`, such as
`/console/communities/demo/secrets`, apart from the communities' APIs a deployment serves at `/communities/` on the
same site; the management API answers every path under `/console` with the console's page. Point it at a
different API with `COFY_MANAGEMENT_API=http://host:port npm run dev`.

## Customising

- **Branding** - the console uses the COFY theme from `@cofy/web-components/theme/cofy.css`.
  [src/brand.css](src/brand.css) is where you replace it with your own: one CSS custom property
  (the brand hue), and Web Awesome derives every button, link and focus ring from it. No code,
  no build step.
- **Translations** - the shell's own strings - its header and account menu - live in `locales/<lang>/app.yaml`,
  bundled. The console's and its components' strings are bundled with
  [@cofy/web-components](../../packages/web-components/locales). The languages the picker offers are `LANGUAGES` in
  [src/i18n.ts](src/i18n.ts).
- **Icons** - the console and the shell draw their own icons, the `cofy` library of
  [@cofy/web-components](../../packages/web-components/src/icons.ts), bundled, so they never fetch one from a CDN
  (useful on an isolated network). Web Awesome's own `default` library is left as it is.
- **Pages** - the console's pages, routes and state are `@cofy/web-components/console`
  ([packages/web-components/src/console](../../packages/web-components/src/console)): adding a page is one new module
  under its `pages` plus one entry in its `routes.ts`.

The pages are `<cofy-console>`, and the console's own shell ([src/main.ts](src/main.ts)) is a host of it like any
other: it hands the console a `ConsoleState` built on its own
store and translations, and draws the header, the menu and, on wide screens, the trail from it.

## Embedding the console

Another app can show the console inside its own pages, for one community at a time, as `<cofy-console>`: without the
console's header, menu or pickers, in the app's language and look. The build puts it in `embed.js`, beside the
console's own files, so the management API serves it with them, in the version it runs. An app that would rather pick
its own version installs `@cofy/web-components` and imports `@cofy/web-components/console` instead.

An app that logs its users in at the same identity provider as COFY hands the console its own access token, and
loads the console from COFY's site:

```html
<script type="module" src="https://app.cofy.example/embed.js"></script>
<cofy-console community="demo" base-path="/w/1/cofy" api-path="https://app.cofy.example" lang="nl"></cofy-console>
<script>
  document.querySelector("cofy-console").accessToken = () => auth.accessToken();
</script>
```

The console is then whoever is logged in to the app, with no login or session of its own: it sends the token with
every request, asking for it each time, so a renewed one is used. When COFY turns it away, the console shows nothing
and fires `cofy-unauthenticated`, for the app to renew the token or log in. The management API takes the app's tokens
once its client id and site are listed (see [its README](../../packages/management-api/README.md#logged-in-by-another-app)).

- `community` - the community shown, by slug. Without one, every page is, by its whole path, as in the console's
  own shell.
- `base-path` - where the app shows the console: a page of the community lies under it by its path within the
  community, so `/communities/demo/secrets` is `/w/1/cofy/secrets`.
- `api-path` - where COFY's API is, such as `https://app.cofy.example`; the page's own site when left out.
- `accessToken` - a property, not an attribute: a function giving the app's access token, or a promise of it.
- `path` - the page shown, within the community, such as `/secrets`. An app that routes itself sets it.
- `lang` - the language to show; the page's when left out. What isn't translated falls back to English, string by
  string.
- `translations` - a property, not an attribute: strings replacing the console's own, by language, namespace
  (`console`, or `components` for those of the components it is built from) and key, such as
  `{ nl: { console: { menu: { items: { secrets: "Sleutels" } } } } }`.

The app routes: `cofy-navigate` asks to show another of the console's pages, with its `path` and `href`. Cancel it
and navigate yourself, then set `path`; left alone, the console pushes the page onto the history itself.

What the app draws around the console comes from its `state`, a `ConsoleState`, once the console has rendered
(`await element.updateComplete`):

- `state.menu()` - the community's pages the person may see, each with its label, path, `href` and whether it is
  the one showing.
- `state.crumbs.crumbs` - the trail to the page showing. The console draws it too, as its `breadcrumbs` part, which
  an app drawing its own hides with `cofy-console::part(breadcrumbs) { display: none; }`.
- `state.subscribe(listener)` - calls `listener` whenever either may have changed, and returns how to stop: the state
  passes on every change of its parts - its location, trail, session and translations - under the part's name. A Lit
  app needn't: the state is lit-state, so it renders from it as from the stores.

The console adds nothing to the app's page but itself, and brings no theme: as for any Web Awesome component, the
app loads one, or sets its custom properties, such as `--wa-color-brand-fill-loud`, on `cofy-console` or its page.

In development, `npm run dev` serves a stand-in for such an app at http://localhost:5173/host/demo/. It sets no
`accessToken`, so the console logs in through COFY's own login, on the API the dev server proxies.

## Development

```sh
npm install
npm test
npm run check
npm run lint
npm run build      # outputs to dist/, served by the management API in production - see
                    # apps/demo_multitenant/management.Dockerfile
```
