# @cofy/web-components

Lit components for building a COFY management console: config forms generated from JSON
Schema, a YAML editor, community and module lists, theming and translations. This is what
[apps/management-web](../../apps/management-web) is built from, and what you'd reach for to
build your own console instead (route 3 in the [root README](../../README.md)). It's built on
[Web Awesome](https://webawesome.com/) and depends on
[@cofy/frontend-sdk](../frontend-sdk) for its data.

## What's in it

- **Schema-driven forms** (`components/form/*`) - `CofyAnyForm` dispatches a JSON Schema node to
  the right field component (string, number, boolean, enum, object, list, dict, union, a
  secret, a raw YAML fallback) via a `FieldRegistry`. The registry is overridable per subtree
  (provide your own ahead of the built-ins through `fieldRegistryContext`), so a deployment can
  add a field for its own module types without forking the package.
- **Community and module management** (`components/community/*`, `components/module/*`) -
  `CofyCommunityList`, `CofyModuleList`, `CofyModuleEditor`, `CofyModuleCreate`: the pieces a
  console needs to list, create and edit communities and their modules against
  `@cofy/frontend-sdk`'s stores.
- **A YAML editor** (`components/editor/*`) - `CofyYamlEditor`, a CodeMirror-based editor with
  YAML syntax highlighting and lint diagnostics, backing the raw-YAML fallback form and
  anywhere else config needs hand-editing.
- **Theming** (`theme/*`) - `ThemeState` (light/dark/system/EnergyID, persisted), plus shared styles
  (`nativeStyles`, `utilityStyles`, `tableStyles`) built on Web Awesome's `--wa-*` tokens.
  `theme/cofy.css` is the COFY theme - every colour built from one lightness and chroma ladder
  and a hue per colour, and a softer dark background - shared by the console and the website. See
  [apps/management-web/src/brand.css](../../apps/management-web/src/brand.css) for how a
  deployment sets its own brand hue on top of it - a CSS custom property, no code or build step
  involved. `theme/energyid.css` is the EnergyID theme on top of it: EnergyID's green and blue
  navigation bar, light only.
- **Translations** (`i18n/*`) - `createI18n`, `CofyI18n`, built on
  [i18next](https://www.i18next.com/). The library's own strings are written as YAML under
  [locales/](locales) - `components` for the components, `console` for the console - and bundled. An app adds its own
  namespaces with `resources`, and replaces any string with `overrides`, key by key; what a language leaves out falls
  back to English, string by string. Adding a language is adding its files here.
- **Icons** (`icons.ts`) - the library's own, registered as Web Awesome's `cofy` icon library and drawn with
  `library="cofy"`: inline SVG, so none is ever fetched. Web Awesome's `default` library is left to the page.
- **The console** (`console/*`, imported as `@cofy/web-components/console`) - `<cofy-console>` with every page of
  the console, and `ConsoleState`, which a host draws its menu and trail from. What
  [apps/management-web](../../apps/management-web) builds into the console and `embed.js`; see its README for
  embedding.
- `CofyElement` - a small `LitElement` base most components extend, wiring up the contexts
  above.

## Install

Not published to a registry yet - consume it as a workspace dependency the way
[apps/management-web](../../apps/management-web) does, or build it and reference
`packages/web-components/dist`:

```sh
npm install
npm run build
```

`@awesome.me/webawesome`, `@cofy/frontend-sdk`, `@dodona/lit-state` and `lit` are peer
dependencies - your app supplies one copy of each, which is also what keeps their module-level
state (Lit's element registry, lit-state's recorder) from silently duplicating across two
copies of the same package.

## Usage

Provide the store and shared state a component tree needs, then use the components in a
template:

```ts
import { provide } from "@lit/context";
import { ApiClient, CofyStore } from "@cofy/frontend-sdk";
import { cofyStoreContext } from "@cofy/web-components";
import "@cofy/web-components/components/community/cofy-community-list";

class MyConsole extends LitElement {
  private readonly api = new ApiClient({ baseUrl: "http://127.0.0.1:8000" });

  @provide({ context: cofyStoreContext })
  public cofy = new CofyStore(this.api);
}
```

See [apps/management-web/src/main.ts](../../apps/management-web/src/main.ts) for the full set
of contexts a real console provides (store, theme, i18n, routing state).

## Development

```sh
npm install
npm test
npm run check
npm run lint
```
