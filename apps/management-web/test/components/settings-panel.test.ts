import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore, type Me } from "@cofy/frontend-sdk";
import { cofyStoreContext, createI18n, i18nContext, yamlBackend } from "@cofy/web-components";
import { beforeEach, describe, expect, it } from "vitest";

import { CofySettingsPanel } from "../../src/components/cofy-settings-panel.js";
import { routeStateContext } from "../../src/context.js";
import { APP_NAMESPACE } from "../../src/i18n.js";
import { routes } from "../../src/routes.js";
import { RouteState } from "../../src/states/route-state.js";

const LOCALES = resolve(process.cwd(), "public/locales");

/** This app's own locale files, read from disk, so a key the panel asks for that doesn't exist fails here. */
async function fromDisk(url: string): Promise<Response> {
  try {
    return new Response(await readFile(join(LOCALES, url.replace("/locales/", "")), "utf8"), { status: 200 });
  } catch {
    return new Response(null, { status: 404 });
  }
}

const ANN: Me = { email: "ann@example.com", name: "Ann", system_admin: false, permissions: [] };
const ADMIN: Me = {
  email: "admin@example.com",
  name: "Admin",
  system_admin: true,
  permissions: [
    {
      slug: null,
      permissions: [
        { action: "read", subject: "allowed_types" },
        { action: "write", subject: "allowed_types" },
      ],
    },
  ],
};

async function panel(me: Me): Promise<CofySettingsPanel> {
  const fetchStub = (): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify(me), { headers: { "content-type": "application/json" } }));
  const cofy = new CofyStore(new ApiClient({ fetch: fetchStub, baseUrl: "http://localhost" }));
  await cofy.session.fetch();
  const i18n = await createI18n({
    namespaces: [APP_NAMESPACE],
    backend: yamlBackend({ fetch: fromDisk as unknown as typeof globalThis.fetch }),
    storage: null,
  });
  const host = document.createElement("div");
  new ContextProvider(host, { context: cofyStoreContext, initialValue: cofy });
  new ContextProvider(host, { context: i18nContext, initialValue: i18n });
  new ContextProvider(host, { context: routeStateContext, initialValue: new RouteState(routes, cofy.session) });
  document.body.append(host);
  const element = new CofySettingsPanel();
  host.append(element);
  await element.updateComplete;
  return element;
}

function texts(element: CofySettingsPanel): string {
  return element.shadowRoot!.querySelector("wa-drawer")!.textContent.replace(/\s+/g, " ");
}

describe("cofy-settings-panel", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows who is logged in and a way to log out, above the appearance and language", async () => {
    const element = await panel(ANN);

    expect(texts(element)).toContain("Ann");
    expect(texts(element)).toContain("ann@example.com");
    expect(texts(element)).toContain("Log out");
    const order = Array.from(element.shadowRoot!.querySelector("wa-drawer > .wa-stack")!.children).map((child) =>
      child.tagName.toLowerCase(),
    );
    expect(order).toEqual(["div", "a", "wa-divider", "cofy-theme-picker", "cofy-locale-picker"]);
  });

  it("links to the admin console's pages for whoever may use them", async () => {
    const element = await panel(ADMIN);

    const section = element.shadowRoot!.querySelector("wa-drawer section")!;
    expect(section.querySelector("h2")!.textContent).toBe("Admin console");
    expect(section.querySelector("a")!.getAttribute("href")).toBe("#/allowed-types");
    expect(section.querySelector("a")!.textContent.trim()).toBe("Allowed types");
  });
});
