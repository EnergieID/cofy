import { registerIconLibrary } from "@awesome.me/webawesome/dist/components/icon/library.js";

/**
 * This package's own icons, registered under the "cofy" library name.
 *
 * Kept to exactly the icons its components use, as inline SVG resolved through a data URI -
 * so using one never makes a network request, unlike Web Awesome's own "default" library,
 * which fetches from Font Awesome's CDN.
 *
 * Importing this module is the registration: `registerIconLibrary` is safe to call more than
 * once, and ES modules only evaluate a module the first time it is imported.
 */
const ICONS: Record<string, string> = {
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor">
    <path d="M27 16.76v-1.53l1.92-1.68A2 2 0 0 0 29.3 11l-2.36-4a2 2 0 0 0-1.73-1 2 2 0 0 0-.64.1l-2.43.82a11.35 11.35 0 0 0-1.31-.75l-.51-2.52a2 2 0 0 0-2-1.61h-4.68a2 2 0 0 0-2 1.61l-.51 2.52a11.48 11.48 0 0 0-1.32.75l-2.38-.82a2 2 0 0 0-.64-.1 2 2 0 0 0-1.73 1L2.7 11a2 2 0 0 0 .38 2.52L5 15.24v1.53l-1.92 1.68A2 2 0 0 0 2.7 21l2.36 4a2 2 0 0 0 1.73 1 2 2 0 0 0 .64-.1l2.43-.82a11.35 11.35 0 0 0 1.31.75l.51 2.52a2 2 0 0 0 2 1.61h4.72a2 2 0 0 0 2-1.61l.51-2.52a11.48 11.48 0 0 0 1.32-.75l2.42.82a2 2 0 0 0 .64.1 2 2 0 0 0 1.73-1l2.28-4a2 2 0 0 0-.38-2.52ZM25.21 24l-3.43-1.16a9 9 0 0 1-2.71 1.57L18.36 28h-4.72l-.71-3.55a9.36 9.36 0 0 1-2.7-1.57L6.79 24l-2.36-4 2.72-2.4a8.9 8.9 0 0 1 0-3.13L4.43 12l2.36-4 3.43 1.16a9 9 0 0 1 2.71-1.57L13.64 4h4.72l.71 3.55a9.36 9.36 0 0 1 2.7 1.57L25.21 8l2.36 4-2.72 2.4a8.9 8.9 0 0 1 0 3.13L27.57 20Z"/>
    <path d="M16 22a6 6 0 1 1 6-6 6 6 0 0 1-6 6Zm0-10a4 4 0 1 0 4 4 4 4 0 0 0-4-4Z"/>
  </svg>`,
  dots: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
  </svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>`,
  // The pickers' icons are Font Awesome Free's (CC BY 4.0), credited inside each SVG.
  "circle-half-stroke": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M448 256c0-106-86-192-192-192l0 384c106 0 192-86 192-192zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M288-32c8.4 0 16.3 4.4 20.6 11.7L364.1 72.3 468.9 46c8.2-2 16.9 .4 22.8 6.3S500 67 498 75.1l-26.3 104.7 92.7 55.5c7.2 4.3 11.7 12.2 11.7 20.6s-4.4 16.3-11.7 20.6L471.7 332.1 498 436.8c2 8.2-.4 16.9-6.3 22.8S477 468 468.9 466l-104.7-26.3-55.5 92.7c-4.3 7.2-12.2 11.7-20.6 11.7s-16.3-4.4-20.6-11.7L211.9 439.7 107.2 466c-8.2 2-16.8-.4-22.8-6.3S76 445 78 436.8l26.2-104.7-92.6-55.5C4.4 272.2 0 264.4 0 256s4.4-16.3 11.7-20.6L104.3 179.9 78 75.1c-2-8.2 .3-16.8 6.3-22.8S99 44 107.2 46l104.7 26.2 55.5-92.6 1.8-2.6c4.5-5.7 11.4-9.1 18.8-9.1zm0 144a144 144 0 1 0 0 288 144 144 0 1 0 0-288zm0 240a96 96 0 1 1 0-192 96 96 0 1 1 0 192z"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c68.8 0 131.3-27.2 177.3-71.4 7.3-7 9.4-17.9 5.3-27.1s-13.7-14.9-23.8-14.1c-4.9 .4-9.8 .6-14.8 .6-101.6 0-184-82.4-184-184 0-72.1 41.5-134.6 102.1-164.8 9.1-4.5 14.3-14.3 13.1-24.4S322.6 8.5 312.7 6.3C294.4 2.2 275.4 0 256 0z"/></svg>`,
  palette: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M512 256c0 .9 0 1.8 0 2.7-.4 36.5-33.6 61.3-70.1 61.3L344 320c-26.5 0-48 21.5-48 48 0 3.4 .4 6.7 1 9.9 2.1 10.2 6.5 20 10.8 29.9 6.1 13.8 12.1 27.5 12.1 42 0 31.8-21.6 60.7-53.4 62-3.5 .1-7 .2-10.6 .2-141.4 0-256-114.6-256-256S114.6 0 256 0 512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>`,
  language: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M160 0c17.7 0 32 14.3 32 32l0 32 128 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-9.6 0-8.4 23.1c-16.4 45.2-41.1 86.5-72.2 122 14.2 8.8 29 16.6 44.4 23.5l50.4 22.4 62.2-140c5.1-11.6 16.6-19 29.2-19s24.1 7.4 29.2 19l128 288c7.2 16.2-.1 35.1-16.2 42.2s-35.1-.1-42.2-16.2l-20-45-157.5 0-20 45c-7.2 16.2-26.1 23.4-42.2 16.2s-23.4-26.1-16.2-42.2l39.8-89.5-50.4-22.4c-23-10.2-45-22.4-65.8-36.4-21.3 17.2-44.6 32.2-69.5 44.7L78.3 380.6c-15.8 7.9-35 1.5-42.9-14.3s-1.5-35 14.3-42.9l34.5-17.3c16.3-8.2 31.8-17.7 46.4-28.3-13.8-12.7-26.8-26.4-38.9-40.9L81.6 224.7c-11.3-13.6-9.5-33.8 4.1-45.1s33.8-9.5 45.1 4.1l10.2 12.2c11.5 13.9 24.1 26.8 37.4 38.7 27.5-30.4 49.2-66.1 63.5-105.4l.5-1.2-210.3 0C14.3 128 0 113.7 0 96S14.3 64 32 64l96 0 0-32c0-17.7 14.3-32 32-32zM416 270.8L365.7 384 466.3 384 416 270.8z"/></svg>`,
  brand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 0.5 6 7">
    <style>
      .arc { fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 0.6; }
      .end-arc { stroke-linecap: butt; }
    </style>
    <path class="arc end-arc" d="M 4 1 C 3.0557 1.3148 2.3148 2.0557 2 3"/>
    <path class="arc end-arc" d="M 6.4495 2 C 6.0708 1.5361 5.5681 1.1894 5 1"/>
    <path class="arc" d="M 5.8559 3 C 5.6013 2.5274 5.1759 2.1698 4.6667 2"/>
    <path class="arc end-arc" d="M 4.6667 6 C 5.0541 5.8708 5.3958 5.6319 5.65 5.3122"/>
    <path class="arc" d="M 5 7 C 5.9443 6.6852 6.6852 5.9443 7 5"/>
    <path class="arc end-arc" d="M 3.65 5.6192 C 3.852 5.7877 4.0838 5.9168 4.3333 6"/>
    <path class="arc end-arc" d="M 3 4.6667 C 3.078 4.9007 3.1965 5.1192 3.35 5.3122"/>
    <path class="arc end-arc" d="M 2 5 C 2.3148 5.9443 3.0557 6.6852 4 7"/>
    <path class="arc end-arc" d="M 4.3333 2 C 4.0838 2.0832 3.852 2.2123 3.65 2.3808"/>
    <path class="arc end-arc" d="M 3.35 2.6878 C 3.1965 2.8808 3.078 3.0993 3 3.3333"/>
    <path class="arc end-arc" d="M 2 3.6667 L 2 4.6667"/>
    <path class="arc" d="M 2 4.6667 L 2 5"/>
    <path class="arc" d="M 2 4.6667 L 3 4.6667"/>
    <path class="arc" d="M 4.6667 6 L 4.6667 7"/>
    <path class="arc" d="M 4.6667 7 L 5 7"/>
    <path class="arc end-arc" d="M 5.8559 5 L 7 5"/>
    <path class="arc end-arc" d="M 5.8559 3 L 7 3"/>
    <path class="arc" d="M 4.6667 6 L 4.3333 6"/>
    <path class="arc" d="M 4.6667 2 L 4.6667 1"/>
    <path class="arc" d="M 4.6667 1 L 5 1"/>
    <path class="arc" d="M 4.6667 2 L 4.3333 2"/>
    <path class="arc" d="M 4.6667 1 L 4 1"/>
    <path class="arc" d="M 3 4.6667 L 3 3.3333"/>
  </svg>`
};

registerIconLibrary("cofy", {
  resolver: (name) => `data:image/svg+xml,${encodeURIComponent(ICONS[name] ?? "")}`,
});
