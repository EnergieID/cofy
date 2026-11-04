import { registerIconLibrary } from "@awesome.me/webawesome/dist/components/icon/library.js";

/**
 * The Font Awesome Free icons the console draws, bundled as inline SVG. Add an icon by adding
 * its name here.
 */
const svgs = import.meta.glob<string>(
  "/node_modules/@fortawesome/fontawesome-free/svgs/solid/{bars,circle-user,cubes,database,key,list-check,lock,people-group,right-from-bracket,sliders,user-shield}.svg",
  { query: "?raw", import: "default", eager: true },
);

const ICONS = new Map(Object.entries(svgs).map(([path, svg]) => [path.split("/").pop()!.replace(".svg", ""), svg]));

/** A transparent 1×1 SVG, as a data URI so resolving it touches no network. */
const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

/**
 * Resolve Web Awesome's default icon library from the bundled icons above, instead of Font
 * Awesome's CDN.
 *
 * Its default resolver fetches each icon from `ka-f.fontawesome.com` at runtime, which a console
 * that an operator may run on an isolated network cannot depend on. Replacing the resolver covers
 * every component, including the ones that ask for an icon on their own behalf, such as
 * `wa-page`'s hamburger. A name not bundled draws nothing rather than going to the network.
 */
export function useLocalIcons(): void {
  registerIconLibrary("default", {
    resolver: (name: string): string => {
      const svg = ICONS.get(name);
      return svg === undefined ? BLANK : `data:image/svg+xml,${encodeURIComponent(svg)}`;
    },
  });
}
