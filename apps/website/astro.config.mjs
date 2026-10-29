// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";
import { cofyCodeThemes } from "./src/code-theme.mjs";
import { schemeScript } from "./src/scheme.mjs";

// Starlight renders the documentation, under /docs/. The marketing pages around it are plain
// Astro pages built with Web Awesome (src/pages/, with their words in src/content/home and
// src/content/pages); both draw from the same Cofy theme.

export default defineConfig({
  site: "https://cofy.cloud",
  integrations: [
    starlight({
      title: "Cofy",
      description: "Cofy is EnergyID's open-source energy engine for energy communities and suppliers.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/EnergieID/cofy" }],
      editLink: { baseUrl: "https://github.com/EnergieID/cofy/edit/main/apps/website/" },
      customCss: [
        "@awesome.me/webawesome/dist/styles/themes/default.css",
        "@awesome.me/webawesome/dist/styles/color/variants.css",
        "@cofy/web-components/theme/cofy.css",
        "@cofy/web-components/theme/syntax.css",
        "./src/styles/starlight-bridge.css",
      ],
      // Code examples in the console's editor colours, from the Cofy theme (src/code-theme.mjs).
      expressiveCode: {
        themes: cofyCodeThemes,
        useStarlightUiThemeColors: true,
        minSyntaxHighlightingColorContrast: 0,
      },
      head: [{ tag: "script", content: schemeScript }],
      components: { PageFrame: "./src/components/PageFrame.astro" },
      // English lives at the root. A language is added by adding an entry here and a folder
      // of the same name under src/content/docs/ - untranslated pages fall back to English.
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
      },
      sidebar: [
        {
          label: "Start here",
          items: [{ label: "Overview", link: "/docs/" }, "docs/concepts"],
        },
        { label: "Use the console", items: [{ autogenerate: { directory: "docs/console" } }] },
        { label: "Modules", items: [{ autogenerate: { directory: "docs/modules" } }] },
        { label: "Sources", items: [{ autogenerate: { directory: "docs/sources" } }] },
        { label: "Self-host", items: [{ autogenerate: { directory: "docs/self-host" } }] },
        { label: "Energy cost", items: [{ autogenerate: { directory: "docs/energy-cost" } }] },
        { label: "Build and extend", items: [{ autogenerate: { directory: "docs/extend" } }] },
        { label: "Use with AI agents", items: [{ autogenerate: { directory: "docs/agents" } }] },
      ],
      // /llms.txt and friends: the docs in a form an AI agent can read in one go.
      plugins: [starlightLlmsTxt()],
    }),
  ],
});
