// Light or dark, in one place for the whole site. Web Awesome's tokens switch scheme on a `wa-light` / `wa-dark` class
// on <html>. On the docs, Starlight decides the scheme and sets `data-theme`; the class follows it. On the marketing
// pages, the reader's choice decides, remembered where Starlight remembers its own, so both halves of the site agree.

const STORAGE_KEY = "starlight-theme";
const CHANGED = "cofy-theme-change";

/** Sets the scheme class now, before the first paint, and keeps it right as the choice, Starlight or the system changes. */
function followScheme(storageKey, changed) {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const stored = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null; // Storage can be off limits, such as with blocked site data: then there is no choice.
    }
  };
  let chosen = null; // Chosen on this page: what storage says, unless storage is off limits.
  const apply = () => {
    const theme = root.dataset.theme ?? chosen ?? stored();
    const dark = theme === "dark" || (theme !== "light" && system.matches);
    root.classList.toggle("wa-dark", dark);
    root.classList.toggle("wa-light", !dark);
  };
  apply();
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  system.addEventListener("change", apply);
  document.addEventListener(changed, (event) => {
    chosen = event.detail;
    apply();
  });
}

/** The inline script running {@link followScheme}, for the <head> of every page. */
export const schemeScript = `(${followScheme})(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(CHANGED)});`;

/**
 * Remembers the reader's choice and applies it.
 * @param {"auto" | "light" | "dark"} theme
 */
export function chooseTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme === "auto" ? "" : theme);
  } catch {
    // Not remembered, but still applied to this page.
  }
  document.dispatchEvent(new CustomEvent(CHANGED, { detail: theme }));
}
