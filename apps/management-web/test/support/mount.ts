import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore, type Me } from "@cofy/frontend-sdk";
import { cofyStoreContext, createI18n, i18nContext, yamlBackend } from "@cofy/web-components";

import { crumbStateContext, routeStateContext } from "../../src/context.js";
import { APP_NAMESPACE } from "../../src/i18n.js";
import { routes } from "../../src/routes.js";
import { CrumbState } from "../../src/states/crumb-state.js";
import { RouteState } from "../../src/states/route-state.js";

const LOCALES = resolve(process.cwd(), "public/locales");

/** This app's own locale files, read from disk, so a key a component asks for that doesn't exist fails. */
async function fromDisk(url: string): Promise<Response> {
  try {
    return new Response(await readFile(join(LOCALES, url.replace("/locales/", "")), "utf8"), { status: 200 });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export const ANN: Me = { email: "ann@example.com", name: "Ann Peeters", system_admin: false, permissions: [] };

/** *element*, rendered for *me* in the console's contexts, at *hash*. */
export async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(
  element: T,
  me: Me,
  hash = "#/",
): Promise<{ element: T; cofy: CofyStore; crumbs: CrumbState }> {
  window.location.hash = hash;
  const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  // Who is logged in, the one community "foo", called Klimaan, and nothing in it.
  const fetchStub = (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/auth/me") return Promise.resolve(json(me));
    if (url.pathname.endsWith("/status")) return Promise.resolve(json({ state: "live", revision: 1, running_revision: 1 }));
    return Promise.resolve(
      json(url.pathname.endsWith("/communities") ? [{ slug: "foo", title: "Klimaan", api_url: "" }] : []),
    );
  };
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
  const crumbs = new CrumbState();
  new ContextProvider(host, { context: crumbStateContext, initialValue: crumbs });
  document.body.append(host);
  host.append(element);
  await element.updateComplete;
  return { element, cofy, crumbs };
}
