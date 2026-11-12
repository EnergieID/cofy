import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUNDLED, COMPONENTS_NAMESPACE, createI18n, preferredLanguage } from "../../src/i18n/i18n.js";
function memoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>(initial === undefined ? [] : [["cofy.language", initial]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("createI18n", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bundles this package's translations, for its components and its console", async () => {
    const i18n = await createI18n({ language: "en", storage: null });

    expect(i18n.t("moduleList.title")).toBe("Modules");
    expect(i18n.t("menu.items.secrets", { ns: "console" })).toBe("Secrets");
    expect(i18n.options.ns).toEqual(expect.arrayContaining([COMPONENTS_NAMESPACE, "console"]));
  });

  it("serves every bundled language unless told which", async () => {
    const i18n = await createI18n({ storage: null });

    expect(i18n.options.supportedLngs).toEqual(expect.arrayContaining(Object.keys(BUNDLED)));
  });

  it("falls back key by key, so a half-finished translation is still worth serving", async () => {
    const i18n = await createI18n({
      language: "nl",
      resources: { en: { app: { title: "COFY", subtitle: "console" } }, nl: { app: { title: "COFY NL" } } },
      storage: null,
    });

    expect(i18n.t("title", { ns: "app" })).toBe("COFY NL");
    expect(i18n.t("subtitle", { ns: "app" })).toBe("console");
  });

  it("takes an app's own strings in namespaces of its own", async () => {
    const i18n = await createI18n({ language: "en", resources: { en: { app: { title: "COFY console" } } }, storage: null });

    expect(i18n.t("title", { ns: "app" })).toBe("COFY console");
    expect(i18n.t("moduleList.title")).toBe("Modules");
  });

  it("overrides bundled strings key by key, leaving the rest", async () => {
    const i18n = await createI18n({
      language: "en",
      overrides: { en: { console: { menu: { items: { secrets: "Credentials" } } } } },
      storage: null,
    });

    expect(i18n.t("menu.items.secrets", { ns: "console" })).toBe("Credentials");
    expect(i18n.t("menu.items.resources", { ns: "console" })).toBe("Resources");
  });

  it("keeps an override to its own instance", async () => {
    await createI18n({ language: "en", overrides: { en: { console: { notFound: "Gone" } } }, storage: null });
    const other = await createI18n({ language: "en", storage: null });

    expect(other.t("notFound", { ns: "console", path: "/x" })).toBe("No page for /x.");
  });

  it("keeps instances apart, so two consoles on a page do not share a language", async () => {
    const one = await createI18n({ language: "en", storage: null });
    const two = await createI18n({ language: "nl", storage: null });

    expect(one.t("menu.items.resources", { ns: "console" })).toBe("Resources");
    expect(two.t("menu.items.resources", { ns: "console" })).toBe("Bronnen");
  });

  it("remembers a language change, so the choice survives a reload", async () => {
    const storage = memoryStorage();
    const i18n = await createI18n({ language: "en", supportedLanguages: ["en", "nl"], storage });

    await i18n.changeLanguage("nl");

    expect(storage.getItem("cofy.language")).toBe("nl");
    const reloaded = await createI18n({ supportedLanguages: ["en", "nl"], storage });
    expect(reloaded.resolvedLanguage).toBe("nl");
  });

  it("ignores a remembered language this deployment no longer serves", async () => {
    const i18n = await createI18n({
      supportedLanguages: ["en"],
      storage: memoryStorage("nl"),
    });

    expect(i18n.resolvedLanguage).toBe("en");
  });
});

describe("preferredLanguage", () => {
  it.each([
    [["nl-BE", "en"], ["en", "nl"], "nl"],
    [["fr-FR"], ["en", "nl"], "en"],
    [["nl"], ["en", "nl"], "nl"],
  ])("picks %s out of %s as %s", (browser, supported, expected) => {
    vi.spyOn(globalThis.navigator, "languages", "get").mockReturnValue(browser);

    expect(preferredLanguage(supported)).toBe(expected);
  });
});
