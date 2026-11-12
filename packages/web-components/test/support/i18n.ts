import { createI18n } from "../../src/i18n/i18n.js";
import type { CofyI18n } from "../../src/i18n/cofy-i18n.js";

/**
 * An i18n instance with this package's real, bundled translations.
 *
 * Using the shipped YAML rather than a fixture means a component asking for a key that does
 * not exist fails here, instead of showing the raw key to a user.
 */
export async function testI18n(language = "en", supportedLanguages: readonly string[] = ["en"]): Promise<CofyI18n> {
  // A test must not inherit the language another one chose, nor leave one behind.
  return createI18n({ language, supportedLanguages, storage: null });
}
