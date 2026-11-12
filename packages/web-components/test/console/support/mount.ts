import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore, type Me } from "@cofy/frontend-sdk";
import { cofyStoreContext, createI18n, i18nContext } from "../../../src/index.js";

import { crumbStateContext, routeStateContext } from "../../../src/console/context.js";
import { routes } from "../../../src/console/routes.js";
import { CrumbState } from "../../../src/console/states/crumb-state.js";
import { HostLocation } from "../../../src/console/states/host-location.js";
import { RouteState } from "../../../src/console/states/route-state.js";

export const ANN: Me = { email: "ann@example.com", name: "Ann Peeters", system_admin: false, permissions: [] };

/** *element*, rendered for *me* in the console's contexts, at *path*. */
export async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(
  element: T,
  me: Me,
  path = "/",
): Promise<{ element: T; cofy: CofyStore; crumbs: CrumbState }> {
  window.history.replaceState(null, "", path);
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
  const i18n = await createI18n({ language: "en", storage: null });
  const host = document.createElement("div");
  new ContextProvider(host, { context: cofyStoreContext, initialValue: cofy });
  new ContextProvider(host, { context: i18nContext, initialValue: i18n });
  new ContextProvider(host, { context: routeStateContext, initialValue: new RouteState(routes, cofy.session, new HostLocation("", "", host)) });
  const crumbs = new CrumbState();
  new ContextProvider(host, { context: crumbStateContext, initialValue: crumbs });
  document.body.append(host);
  host.append(element);
  await element.updateComplete;
  return { element, cofy, crumbs };
}
