import type { Resource } from "i18next";
import { parse } from "yaml";

/** The namespace the shell's own strings live in; the console and its components bring their own. */
export const APP_NAMESPACE = "app";

/**
 * The languages the shell offers to pick from, fallback first: those with a complete enough translation to show. The
 * console and its components bring every language they have; one left out here is still used when asked for.
 */
export const LANGUAGES = ["en"] as const;

const files = import.meta.glob<string>("../locales/*/app.yaml", { query: "?raw", import: "default", eager: true });

/** The shell's own strings, bundled from `locales/<language>/app.yaml`, by language. */
export const APP_RESOURCES: Resource = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.split("/").at(-2)!, { [APP_NAMESPACE]: parse(text) as Record<string, string> }]),
);
