import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";

const workspace = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * In development, `embed.js` and `embed.css` from their sources, under the names the build gives them, so an app can
 * embed this dev server; and a stand-in for such an app: `/host/<slug>/...` serves `host.html`, which places
 * `<cofy-console>` for that community, on the API this dev server proxies, logged in through COFY's own login.
 */
function embeddingHost(): Plugin {
  return {
    name: "cofy-embedding-host",
    apply: "serve",
    resolveId(id): string | undefined {
      return id === "/embed.js" ? workspace("src/embed.ts") : undefined;
    },
    configureServer(server): void {
      server.middlewares.use((request, _response, next) => {
        const path = (request.url ?? "").split("?")[0] ?? "";
        // `?direct`: a stylesheet loaded with `<link>` comes as CSS, not as the module Vite makes of an imported one.
        if (path === "/embed.css") request.url = "/src/embed.css?direct";
        else if (path.startsWith("/host/")) request.url = "/host.html";
        next();
      });
    },
  };
}

/** Fails the build when `embed.css` is missing or isn't Web Awesome's default theme, so no build change drops it. */
function embedThemeCheck(): Plugin {
  return {
    name: "cofy-embed-theme-check",
    apply: "build",
    generateBundle(_options, bundle): void {
      const theme = bundle["embed.css"];
      if (theme?.type !== "asset" || !String(theme.source).includes(".wa-theme-default")) {
        this.error("embed.css is missing from the build, or isn't Web Awesome's default theme");
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [embeddingHost(), embedThemeCheck()],
  resolve: {
    // `@dodona/lit-state` keeps a module-level recorder and `lit` a module-level element
    // registry, so a second copy of either silently breaks reactivity. Each package has its
    // own node_modules, which is exactly how a second copy gets in.
    dedupe: ["lit", "@dodona/lit-state", "@lit/context", "@awesome.me/webawesome"],
    // In development the workspace packages resolve to their sources, so editing a component
    // is reflected immediately instead of needing a rebuild first. The production build is
    // deliberately left alone: it goes through each package's real entry points, which is
    // what an outside consumer gets, so a broken `exports` map fails here rather than after
    // publishing.
    alias: [
      // `@dodona/lit-state` ships no `exports` map, which is enough for `dedupe` above to
      // miss it - and every package having its own copy then means the store records a read
      // into one module-level recorder while the component's controller watches another, so
      // reactivity silently stops. Pinning it to a single file leaves no room for that.
      { find: /^@dodona\/lit-state$/, replacement: workspace("node_modules/@dodona/lit-state/dist/index.js") },
      ...(command === "serve"
        ? [
            { find: /^@cofy\/frontend-sdk$/, replacement: workspace("../../packages/frontend-sdk/src/index.ts") },
            { find: /^@cofy\/web-components$/, replacement: workspace("../../packages/web-components/src/index.ts") },
            {
              find: /^@cofy\/web-components\/console$/,
              replacement: workspace("../../packages/web-components/src/console/index.ts"),
            },
          ]
        : []),
    ],
  },
  server: {
    // The library's translations are taken in as text (`?raw`), which Vite only does for files it may serve: this
    // app's, and - its sources being used directly in development - the workspace packages beside it.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), workspace("../../packages")] },
    // Proxying keeps the browser on a single origin during development, so the app talks to
    // the management API exactly as it will when the API serves it - no CORS, no separate
    // base URL to configure.
    proxy: {
      "/management": {
        target: process.env["COFY_MANAGEMENT_API"] ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // The original host is kept, so the API sends the identity provider back to this dev
      // server - where the session cookie lives - rather than to itself.
      "/auth": {
        target: process.env["COFY_MANAGEMENT_API"] ?? "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      // The console, and `embed.js` and `embed.css` for an app embedding it, under names that app can rely on.
      input: {
        console: workspace("index.html"),
        embed: workspace("src/embed.ts"),
        "embed-theme": workspace("src/embed.css"),
      },
      output: {
        entryFileNames: (chunk): string => (chunk.name === "embed" ? "embed.js" : "assets/[name]-[hash].js"),
        assetFileNames: (asset): string =>
          asset.names.includes("embed-theme.css") ? "embed.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
}));
