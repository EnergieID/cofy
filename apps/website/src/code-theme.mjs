// @ts-check
/*
 * The colours of the code examples in the docs: the same eight roles as the console's YAML
 * editor (@cofy/web-components/theme/syntax.css), as CSS variables, so they follow the theme and
 * switch with light and dark by themselves. Starlight wants a light and a dark theme; they are the
 * same rules.
 *
 * Expressive Code needs real colours for the editor background and foreground, to derive its
 * frame from; Starlight draws the frame from its own colours instead (useStarlightUiThemeColors),
 * so those two are never seen. The text itself takes its colour from the rules below.
 *
 * Astro caches rendered Markdown, code blocks included, across restarts. After changing this
 * file, start the dev server with `--force` once to render the code again.
 */
/** @param {string} name */
const role = (name) => ({ foreground: `var(--cofy-syntax-${name})` });

const tokenColors = [
  {
    scope: ["source", "text"],
    settings: { foreground: "var(--sl-color-text)" },
  },
  {
    scope: [
      "entity.name.tag",
      "support.type.property-name",
      "meta.object-literal.key",
      "entity.name.function",
      "support.function",
      "meta.function-call.generic",
      "entity.name.command",
    ],
    settings: role("key"),
  },
  { scope: ["string"], settings: role("string") },
  // A shell argument is a word, not a string.
  {
    scope: ["string.unquoted.argument.shell"],
    settings: { foreground: "var(--sl-color-text)" },
  },
  {
    scope: ["constant.numeric", "constant.other.timestamp"],
    settings: role("number"),
  },
  {
    scope: [
      "constant.language",
      "keyword",
      "storage",
      "variable.language",
      "entity.name.type",
      "support.type",
    ],
    settings: role("atom"),
  },
  {
    scope: ["comment", "punctuation.definition.comment"],
    settings: role("comment"),
  },
  {
    scope: [
      "meta.decorator",
      "entity.name.function.decorator",
      "keyword.other.directive",
      "entity.name.type.anchor",
    ],
    settings: role("meta"),
  },
  { scope: ["punctuation", "keyword.operator"], settings: role("punctuation") },
  { scope: ["invalid"], settings: role("invalid") },
];

export const cofyCodeThemes = [
  {
    name: "cofy-light",
    type: "light",
    colors: { "editor.background": "#ffffff", "editor.foreground": "#000000" },
    tokenColors,
  },
  {
    name: "cofy-dark",
    type: "dark",
    colors: { "editor.background": "#000000", "editor.foreground": "#ffffff" },
    tokenColors,
  },
];
