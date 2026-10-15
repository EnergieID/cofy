import { ContextProvider } from "@lit/context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, CofyStore, type CommunityInfo } from "@cofy/frontend-sdk";

import type { CofyCommunityDialog } from "../../src/components/community/cofy-community-dialog.js";
import { CofyCommunityList } from "../../src/components/community/cofy-community-list.js";
import { cofyStoreContext, i18nContext } from "../../src/context.js";
import { testI18n } from "../support/i18n.js";

const communities: CommunityInfo[] = [
  { slug: "demo", title: "Demo Energy Community", description: "", debug_mode: false, module_count: 2, revision: 4, api_url: "http://localhost/demo/" },
  { slug: "riverside", title: "", description: "", debug_mode: false, module_count: 0, revision: null, api_url: "http://localhost/riverside/" },
];

type Permission = { action: string; subject: string };

const READ_COMMUNITY: Permission = { action: "read", subject: "community" };
const WRITE_COMMUNITY: Permission = { action: "write", subject: "community" };

/** Who is logged in: a system administrator may do anything, in any community and outside them. */
const systemAdmin = [
  { slug: null, permissions: [READ_COMMUNITY, WRITE_COMMUNITY] },
  { slug: "demo", permissions: [READ_COMMUNITY, WRITE_COMMUNITY] },
  { slug: "riverside", permissions: [READ_COMMUNITY, WRITE_COMMUNITY] },
];
/** A community administrator manages what is in their community, but not the community itself. */
const demoAdmin = [{ slug: "demo", permissions: [READ_COMMUNITY] }];

interface State {
  communities: CommunityInfo[];
  permissions: { slug: string | null; permissions: Permission[] }[];
  /** Every write sent, as method, path and body. */
  writes: { method: string; path: string; body: unknown }[];
}

function stubApi(state: State): ApiClient {
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = new URL(request.url).pathname;
    let body: unknown;
    let status = 200;
    if (path === "/auth/me") {
      body = { email: "ann@example.com", name: "Ann", system_admin: false, permissions: state.permissions };
    } else if (path.endsWith("/status")) {
      body = { state: "live", revision: 1, running_revision: 1 };
    } else if (request.method === "GET") {
      body = state.communities;
    } else {
      const sent: unknown = request.method === "DELETE" ? undefined : await request.json();
      state.writes.push({ method: request.method, path, body: sent });
      const slug = path.split("/").pop();
      body = { slug, module_count: 0, revision: 1, api_url: `http://localhost/${slug}/`, ...(sent as object) };
      status = request.method === "POST" ? 201 : request.method === "DELETE" ? 204 : 200;
    }
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return new ApiClient({ fetch: fetchStub, baseUrl: "http://localhost" });
}

async function settle(element: CofyCommunityList): Promise<void> {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 10));
  await element.updateComplete;
}

async function mount(
  rows: CommunityInfo[] = communities,
  permissions: State["permissions"] = [],
): Promise<{ element: CofyCommunityList; state: State }> {
  const state: State = { communities: rows, permissions, writes: [] };
  const element = new CofyCommunityList();
  // Provided rather than set, so the dialog inside the list gets them too.
  const host = document.createElement("div");
  new ContextProvider(host, { context: cofyStoreContext, initialValue: new CofyStore(stubApi(state)) });
  new ContextProvider(host, { context: i18nContext, initialValue: await testI18n() });
  document.body.append(host);
  host.append(element);
  await settle(element);
  return { element, state };
}

function rows(element: CofyCommunityList): string[] {
  return Array.from(element.shadowRoot!.querySelectorAll("tr[data-slug]")).map(
    (row) => row.getAttribute("data-slug") ?? "",
  );
}

/** The labels of the buttons in *slug*'s row. */
function actions(element: CofyCommunityList, slug: string): string[] {
  return Array.from(element.shadowRoot!.querySelectorAll(`tr[data-slug="${slug}"] td.actions wa-button`)).map(
    (button) => button.textContent.trim(),
  );
}

function addButton(element: CofyCommunityList): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>('cofy-heading wa-button[variant="brand"]');
}

function button(element: CofyCommunityList, slug: string, label: string): HTMLElement {
  return Array.from(
    element.shadowRoot!.querySelectorAll<HTMLElement>(`tr[data-slug="${slug}"] td.actions wa-button`),
  ).find((candidate) => candidate.textContent.trim() === label)!;
}

function dialog(element: CofyCommunityList): CofyCommunityDialog {
  return element.shadowRoot!.querySelector("cofy-community-dialog")!;
}

/** Type into a Web Awesome control, as its own input event reports it. */
function type(control: Element, value: string): void {
  (control as HTMLElement & { value: string }).value = value;
  control.dispatchEvent(new Event("input"));
}

describe("cofy-community-list", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders a row per community", async () => {
    expect(rows((await mount()).element)).toEqual(["demo", "riverside"]);
  });

  it("falls back to the slug when a community has no title", async () => {
    const { element } = await mount();

    const cells = Array.from(element.shadowRoot!.querySelectorAll("tr[data-slug] td:first-child"));

    expect(cells.map((cell) => cell.textContent.trim())).toEqual(["Demo Energy Community", "riverside"]);
  });

  it("carries its own heading, so a page adds no chrome", async () => {
    const { element } = await mount();

    expect(element.shadowRoot!.querySelector('cofy-heading [slot="title"]')?.textContent?.trim()).toBe(
      "Communities",
    );
  });

  it("shows each community's status", async () => {
    const { element } = await mount();

    const statuses = Array.from(element.shadowRoot!.querySelectorAll("cofy-community-status"));

    expect(statuses.map((status) => status.slug)).toEqual(["demo", "riverside"]);
  });

  it("says so when there are no communities", async () => {
    const { element } = await mount([]);

    expect(rows(element)).toEqual([]);
    expect(element.shadowRoot!.querySelector("tr.empty")?.textContent?.trim()).toBe(
      "There are no communities you have access to. Ask an administrator to grant you access.",
    );
  });

  it("asks to be taken to a community rather than routing itself", async () => {
    const { element } = await mount();
    const events: unknown[] = [];
    element.addEventListener("community-selected", (event) => events.push((event as CustomEvent).detail));

    element.shadowRoot!.querySelector('tr[data-slug="riverside"]')!.dispatchEvent(new MouseEvent("click"));

    expect(events).toEqual([{ slug: "riverside" }]);
  });

  it("opens a community from the keyboard, which a plain row does not do by itself", async () => {
    const { element } = await mount();
    const events: unknown[] = [];
    element.addEventListener("community-selected", (event) => events.push((event as CustomEvent).detail));

    const row = element.shadowRoot!.querySelector('tr[data-slug="demo"]')!;
    expect(row.getAttribute("tabindex")).toBe("0");
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(events).toEqual([{ slug: "demo" }]);
  });

  it("offers no changes to someone who may only look", async () => {
    const { element } = await mount();

    expect(addButton(element)).toBeNull();
    expect(actions(element, "demo")).toEqual([]);
    expect(actions(element, "riverside")).toEqual([]);
  });

  it("offers a community's administrator no changes to the community itself", async () => {
    const { element } = await mount(communities, demoAdmin);

    expect(addButton(element)).toBeNull();
    expect(actions(element, "demo")).toEqual([]);
  });

  it("lets a system administrator create, change and delete any community", async () => {
    const { element } = await mount(communities, systemAdmin);

    expect(addButton(element)?.textContent.trim()).toBe("New community");
    expect(actions(element, "demo")).toEqual(["Edit", "Delete"]);
    expect(actions(element, "riverside")).toEqual(["Edit", "Delete"]);
  });

  it("creates a community and then opens it", async () => {
    const { element, state } = await mount(communities, systemAdmin);
    const events: unknown[] = [];
    element.addEventListener("community-selected", (event) => events.push((event as CustomEvent).detail));

    addButton(element)!.click();
    await settle(element);
    const [slug, title] = Array.from(dialog(element).shadowRoot!.querySelectorAll("wa-input"));
    type(slug!, "harbour");
    type(title!, "Harbour Energy");
    type(dialog(element).shadowRoot!.querySelector("wa-textarea")!, "By the sea");
    await dialog(element).updateComplete;
    dialog(element).shadowRoot!.querySelector<HTMLElement>('wa-button[variant="brand"]')!.click();
    await settle(element);

    expect(state.writes).toEqual([
      {
        method: "POST",
        path: "/management/communities",
        body: { slug: "harbour", title: "Harbour Energy", description: "By the sea", debug_mode: false },
      },
    ]);
    expect(rows(element)).toContain("harbour");
    expect(dialog(element).open).toBe(false);
    expect(events).toEqual([{ slug: "harbour" }]);
  });

  it("changes a community's settings without opening it or touching its slug", async () => {
    const { element, state } = await mount(communities, systemAdmin);
    const events: unknown[] = [];
    element.addEventListener("community-selected", (event) => events.push((event as CustomEvent).detail));

    button(element, "demo", "Edit").click();
    await settle(element);
    const inputs = Array.from(dialog(element).shadowRoot!.querySelectorAll("wa-input"));
    expect(inputs).toHaveLength(1);
    type(inputs[0]!, "Renamed");
    await dialog(element).updateComplete;
    dialog(element).shadowRoot!.querySelector<HTMLElement>('wa-button[variant="brand"]')!.click();
    await settle(element);

    expect(state.writes).toEqual([
      {
        method: "PUT",
        path: "/management/communities/demo",
        body: { title: "Renamed", description: "", debug_mode: false },
      },
    ]);
    expect(dialog(element).open).toBe(false);
    expect(events).toEqual([]);
  });

  it("stays the edit form while it closes, rather than turning into the create form", async () => {
    const { element } = await mount(communities, systemAdmin);

    button(element, "demo", "Edit").click();
    await settle(element);
    dialog(element).shadowRoot!.querySelector<HTMLElement>('wa-button[appearance="plain"]')!.click();
    await settle(element);

    expect(dialog(element).open).toBe(false);
    expect(dialog(element).shadowRoot!.querySelectorAll("wa-input")).toHaveLength(1);
    expect(dialog(element).shadowRoot!.querySelector("wa-dialog")?.getAttribute("label")).toBe(
      "Change Demo Energy Community",
    );
  });

  it("deletes a community after asking, without opening it", async () => {
    const { element, state } = await mount(communities, systemAdmin);
    const events: unknown[] = [];
    element.addEventListener("community-selected", (event) => events.push((event as CustomEvent).detail));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    button(element, "riverside", "Delete").click();
    await settle(element);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("riverside"));
    expect(state.writes).toEqual([{ method: "DELETE", path: "/management/communities/riverside", body: undefined }]);
    expect(rows(element)).toEqual(["demo"]);
    expect(events).toEqual([]);
  });

  it("keeps a community when deleting it is not confirmed", async () => {
    const { element, state } = await mount(communities, systemAdmin);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    button(element, "demo", "Delete").click();
    await settle(element);

    expect(state.writes).toEqual([]);
    expect(rows(element)).toEqual(["demo", "riverside"]);
  });
});
