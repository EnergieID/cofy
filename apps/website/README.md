# COFY website

The public website at [cofy.cloud](https://cofy.cloud): the marketing pages, built with
[Web Awesome](https://webawesome.com) like the console, and the documentation under `/docs/`,
built with [Starlight](https://starlight.astro.build). All words live in Markdown files.

## Running locally

```sh
npm install
npm run dev
```

Serves the site at http://127.0.0.1:4321. `npm run build` writes the static site to `dist/`.

## Deploying

[Dockerfile](Dockerfile) builds the site, from the repository root, into an image serving it with Caddy on port 8080
([Caddyfile](Caddyfile)). EnergyID builds and deploys it with the management API and runner of its hosted COFY, and
runs it beside them on the same server.

## Where things are

- **Home page** - its words are [src/content/home/en.md](src/content/home/en.md): each section
  in the frontmatter, the closing "who's behind COFY" story as the body. The layout is
  [src/pages/index.astro](src/pages/index.astro).
- **Other marketing pages** - one Markdown (or MDX) file each in
  [src/content/pages/en/](src/content/pages/en), served at its path: `vision.mdx` at
  `/vision/`, `customers/klimaan.md` at `/customers/klimaan/`. Adding a page is adding a file;
  [src/pages/[...page].astro](src/pages/[...page].astro) renders them all. Web Awesome elements
  such as `<wa-card>` and `<wa-badge>` work inside them.
- **Documentation** - everything under [src/content/docs/docs](src/content/docs/docs), served
  at `/docs/`. The sidebar groups are set in [astro.config.mjs](astro.config.mjs); a group
  lists the pages in its folder, so adding a page to a group is adding a file.
- **Layout** - [src/layouts/Marketing.astro](src/layouts/Marketing.astro) is the header,
  navigation and footer of the marketing pages, built on `<wa-page>`;
  [src/layouts/Article.astro](src/layouts/Article.astro) frames a Markdown page in it. The Web
  Awesome components the pages use are registered in
  [src/scripts/web-awesome.ts](src/scripts/web-awesome.ts).
- **Theme** - every page draws its colours and fonts from Web Awesome's tokens with the COFY
  theme on top (`@cofy/web-components/theme/cofy.css`), the same theme as the console. Starlight
  can't use Web Awesome's components, so
  [src/styles/starlight-bridge.css](src/styles/starlight-bridge.css) maps its `--sl-*` variables
  onto those tokens, and a small script in [astro.config.mjs](astro.config.mjs) keeps Web
  Awesome's `wa-light` / `wa-dark` class in step with Starlight's theme switch. Both halves
  remember the reader's choice in the same place. The logo is
  [src/assets/logo.svg](src/assets/logo.svg), the favicon [public/favicon.svg](public/favicon.svg).
- **Footer** - [src/components/Credits.astro](src/components/Credits.astro): links, the EU
  co-funding line and EnergyID's legal details, on every page: across the bottom of the docs
  through [src/components/PageFrame.astro](src/components/PageFrame.astro), and in the marketing
  layout.
  The SmartCORE co-funding logo sits beside "Where COFY comes from" on the home page, at the
  size Interreg asks for.
- **Contact** - the "Talk to us" page gives the address `contact@cofy.cloud`.
- **Visuals** - the mockups beside each feature, and the Klimaan charts, are components in
  [src/components/visuals/](src/components/visuals) and
  [src/components/DirectiveStrip.astro](src/components/DirectiveStrip.astro): drawn from Web
  Awesome tokens, not screenshots, so they follow the theme. The directive colours are in
  [src/styles/site.css](src/styles/site.css).
- **Icons** - Font Awesome Free, bundled from its npm package instead of fetched from a CDN.
  [src/scripts/web-awesome.ts](src/scripts/web-awesome.ts) lists the ones in use; add a name
  there to use another.
- **Links to the console** - its address is in [src/site.ts](src/site.ts).
- **For AI agents** - [starlight-llms-txt](https://github.com/delucis/starlight-llms-txt)
  publishes the docs at `/llms.txt` and `/llms-full.txt`.

## Translations

English lives at the root. For the docs, add the language to `locales` in
[astro.config.mjs](astro.config.mjs) and put translated pages in a folder of the same name, e.g.
`src/content/docs/nl/docs/concepts.md` for `/nl/docs/concepts/`; pages that aren't translated
yet fall back to English. The marketing pages' words are already filed by language
(`src/content/home/en.md`, `src/content/pages/en/`), so a translation is a copy of those files
under `nl`; the routes for it are still to be added.
