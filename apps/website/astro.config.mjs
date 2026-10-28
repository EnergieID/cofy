// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// Starlight renders the documentation, under /docs/. The marketing pages around it are plain
// Astro pages built with Web Awesome (src/pages/, with their words in src/content/home and
// src/content/pages); both draw from the same Cofy theme.

// Web Awesome's tokens switch scheme on a class, Starlight's on `data-theme`: keep the class in
// step, so the Cofy theme behind the Starlight bridge follows the reader's choice.
const followStarlightScheme = `
  const root = document.documentElement;
  const sync = () => {
    const dark = root.dataset.theme === "dark";
    root.classList.toggle("wa-dark", dark);
    root.classList.toggle("wa-light", !dark);
  };
  sync();
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
`;

export default defineConfig({
  site: "https://cofy.cloud",
  integrations: [
    starlight({
      title: "Cofy",
      description: "Cofy is EnergyID's open-source energy engine for energy communities and suppliers.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/EnergieID/cofy-api" }],
      editLink: { baseUrl: "https://github.com/EnergieID/cofy-api/edit/main/apps/website/" },
      customCss: [
        "@awesome.me/webawesome/dist/styles/themes/default.css",
        "@awesome.me/webawesome/dist/styles/color/variants.css",
        "@cofy/web-components/theme/cofy.css",
        "./src/styles/starlight-bridge.css",
      ],
      head: [{ tag: "script", content: followStarlightScheme }],
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
        { label: "Use with AI agents", items: [{ autogenerate: { directory: "docs/agents" } }] },
        { label: "Self-host", items: [{ autogenerate: { directory: "docs/self-host" } }] },
        { label: "Build and extend", items: [{ autogenerate: { directory: "docs/build" } }] },
        { label: "Energy cost", items: [{ autogenerate: { directory: "docs/energy-cost" } }] },
      ],
      // /llms.txt and friends: the docs in a form an AI agent can read in one go.
      plugins: [starlightLlmsTxt()],
    }),
  ],
});
