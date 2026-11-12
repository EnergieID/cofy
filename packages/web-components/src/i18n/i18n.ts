import i18next, { type InitOptions, type Resource, type ResourceKey } from "i18next";
import { parse } from "yaml";

import { CofyI18n } from "./cofy-i18n.js";

/** The namespace this package's components keep their strings in; the console's are in `console`. */
export const COMPONENTS_NAMESPACE = "components";

/**
 * This package's own translations, bundled: `locales/<language>/<namespace>.yaml`, YAML because that is what the rest
 * of this project is written and reviewed in, and a translator editing it is less likely to break it than JSON.
 */
const files = import.meta.glob<string>("../../locales/*/*.yaml", { query: "?raw", import: "default", eager: true });

/** The translations this package ships, by language and namespace. */
export const BUNDLED: Resource = {};
for (const [path, text] of Object.entries(files)) {
  const [language, file] = path.split("/").slice(-2) as [string, string];
  BUNDLED[language] = { ...BUNDLED[language], [file.replace(/\.yaml$/, "")]: parse(text) as Record<string, unknown> };
}

export interface I18nOptions {
  /** Starting language. Defaults to a remembered one, else the browser's, narrowed to one served. */
  language?: string;
  /** Languages served, the first the fallback. Defaults to every language there are translations for. */
  supportedLanguages?: readonly string[];
  /** An app's own strings, by language and namespace, beside the bundled ones. */
  resources?: Resource;
  /** Strings replacing bundled ones - or an app's own - key by key, by language and namespace. */
  overrides?: Resource;
  /** Escape hatch for anything else i18next takes. */
  init?: InitOptions;
  /** Where the chosen language is remembered. Defaults to `localStorage`; `null` to not remember. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}

const STORAGE_KEY = "cofy.language";

/**
 * Build an i18next instance for a console, as lit-state.
 *
 * A fresh instance rather than i18next's global one, so it can be handed down through context
 * like the stores are - two consoles on a page keep their own language, and a test does not
 * inherit another test's.
 *
 * It holds the bundled translations, an app's own beside them, and its overrides on top. Fallback is per key, not per
 * file, so a half-finished translation shows what it has and English for the rest.
 *
 * Resolves once the starting language is set.
 */
export async function createI18n(options: I18nOptions = {}): Promise<CofyI18n> {
  const instance = i18next.createInstance();
  // A copy, as i18next adds to what it is given, and the bundled translations are every instance's.
  const resources = structuredClone(BUNDLED);
  for (const extra of [options.resources, options.overrides]) {
    for (const [language, namespaces] of Object.entries(extra ?? {})) {
      for (const [namespace, strings] of Object.entries(namespaces)) {
        resources[language] = { ...resources[language], [namespace]: merge(resources[language]?.[namespace], strings) as ResourceKey };
      }
    }
  }
  const supported = options.supportedLanguages ?? Object.keys(resources);
  const namespaces = [...new Set(Object.values(resources).flatMap((byNamespace) => Object.keys(byNamespace)))];

  const storage = options.storage === undefined ? safeLocalStorage() : options.storage;
  const remembered = storage?.getItem(STORAGE_KEY);

  await instance.init({
    lng: options.language ?? pick(remembered, supported) ?? preferredLanguage(supported),
    fallbackLng: supported[0] ?? "en",
    supportedLngs: [...supported],
    ns: namespaces,
    defaultNS: COMPONENTS_NAMESPACE,
    resources,
    interpolation: {
      // Values come from our own code and the API, and Lit escapes what it renders.
      escapeValue: false,
    },
    ...options.init,
  });

  // Remembered here rather than in the picker, so any route to a language change - a picker,
  // a deep link, an embedding app - is persisted the same way.
  instance.on("languageChanged", (language: string) => storage?.setItem(STORAGE_KEY, language));

  return new CofyI18n(instance);
}

/** *strings* over *base*, key by key, at every depth. */
function merge(base: unknown, strings: unknown): unknown {
  if (!isRecord(base) || !isRecord(strings)) return strings;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(strings)) merged[key] = merge(base[key], value);
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** *language*, if this deployment still serves it - a remembered one may have been dropped. */
function pick(language: string | null | undefined, supported: readonly string[]): string | undefined {
  return language !== null && language !== undefined && supported.includes(language) ? language : undefined;
}

/** `localStorage` throws rather than returning null in a blocked-cookies context. */
function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    globalThis.localStorage.getItem(STORAGE_KEY);
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** The first language the browser asks for that this deployment actually serves. */
export function preferredLanguage(supported: readonly string[]): string {
  for (const candidate of globalThis.navigator?.languages ?? []) {
    const base = candidate.split("-")[0]!;
    const match = supported.find((language) => language === candidate || language === base);
    if (match !== undefined) return match;
  }
  return supported[0] ?? "en";
}
