/*
 * The Web Awesome components the marketing pages use, and the icons they draw.
 *
 * Web Awesome's default icon library is Font Awesome, fetched from its CDN at runtime. Here the
 * same icons come from the Font Awesome Free package instead, bundled as inline SVG: only the
 * ones listed below, and no request ever leaves the site. Add an icon by adding its name.
 */
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/card/card.js";
import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/tag/tag.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/carousel/carousel.js";
import "@awesome.me/webawesome/dist/components/carousel-item/carousel-item.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/textarea/textarea.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";
import { registerIconLibrary } from "@awesome.me/webawesome/dist/components/icon/library.js";

const svgs = import.meta.glob<string>(
  "/node_modules/@fortawesome/fontawesome-free/svgs/solid/{arrow-right,bars,bolt,chart-pie,circle-half-stroke,code,display,earth-europe,eye,file-invoice,handshake,lock-open,moon,people-group,plug,right-to-bracket,server,solar-panel,sun,cloud}.svg",
  { query: "?raw", import: "default", eager: true },
);

const ICONS = new Map(Object.entries(svgs).map(([path, svg]) => [path.split("/").pop()!.replace(".svg", ""), svg]));

const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

registerIconLibrary("default", {
  resolver: (name: string): string => {
    const svg = ICONS.get(name);
    return svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : BLANK;
  },
});
