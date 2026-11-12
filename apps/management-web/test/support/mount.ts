import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore, type Me } from "@cofy/frontend-sdk";
import { cofyStoreContext, createI18n, i18nContext } from "@cofy/web-components";

import { APP_RESOURCES } from "../../src/i18n.js";

export const ANN: Me = { issuer: null, subject: null, email: "ann@example.com", name: "Ann Peeters", system_admin: false, permissions: [] };

/** *element*, rendered in the shell's contexts - its store, for *me*, and its translations. */
export async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(
  element: T,
  me: Me,
): Promise<{ element: T; cofy: CofyStore }> {
  const fetchStub = (): Promise<Response> => Promise.resolve(Response.json(me));
  const cofy = new CofyStore(new ApiClient({ fetch: fetchStub, baseUrl: "http://localhost" }));
  await cofy.session.fetch();
  const i18n = await createI18n({ language: "en", resources: APP_RESOURCES, storage: null });
  const host = document.createElement("div");
  new ContextProvider(host, { context: cofyStoreContext, initialValue: cofy });
  new ContextProvider(host, { context: i18nContext, initialValue: i18n });
  document.body.append(host);
  host.append(element);
  await element.updateComplete;
  return { element, cofy };
}
