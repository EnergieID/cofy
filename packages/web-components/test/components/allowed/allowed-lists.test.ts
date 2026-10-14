import { beforeEach, describe, expect, it } from "vitest";
import { ContextProvider } from "@lit/context";
import { ApiClient, CofyStore, type TypeAvailability } from "@cofy/frontend-sdk";

import { CofyAllowedTypeList } from "../../../src/components/allowed/cofy-allowed-type-list.js";
import type { CofyAvailabilityDialog } from "../../../src/components/allowed/cofy-availability-dialog.js";
import { CofyAvailabilityList } from "../../../src/components/allowed/cofy-availability-list.js";
import { cofyStoreContext, i18nContext } from "../../../src/context.js";
import { testI18n } from "../../support/i18n.js";

interface Server {
  availability: TypeAvailability[];
  /** Every write sent, as method, path and body. */
  writes: { method: string; path: string; body: unknown }[];
}

function server(): Server {
  return {
    availability: [
      { group: "source", type: "entsoe_day_ahead", description: "", default: true, exceptions: [] },
      { group: "resource", type: "tariff", description: "An energy cost tariff.", default: false, exceptions: ["test"] },
    ],
    writes: [],
  };
}

/** Answers as the API would, with what *state* holds. */
function stubApi(state: Server): ApiClient {
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = new URL(request.url).pathname;
    const respond = (body: unknown): Response =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

    if (path === "/management/communities") {
      return respond([
        { slug: "test", title: "Test" },
        { slug: "other", title: "Other" },
      ]);
    }
    if (path === "/management/allowed-types") return respond(state.availability);
    if (path === "/management/communities/test/allowed-types") {
      return respond(
        state.availability.map(({ group, type, description, default: isDefault, exceptions }) => ({
          group,
          type,
          description,
          allowed: isDefault !== exceptions!.includes("test"),
        })),
      );
    }
    const body = (await request.json()) as object;
    state.writes.push({ method: request.method, path, body });
    const [group, type] = path.split("/").slice(-2);
    // A write answers with the type as written: its availability, or whether the community may use it.
    const { group: g, type: t, description } = state.availability.find(
      (candidate) => candidate.group === group && candidate.type === type,
    )!;
    return respond({ group: g, type: t, description, ...body });
  };
  return new ApiClient({ fetch: fetchStub, baseUrl: "http://localhost" });
}

async function settle(element: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 10));
  await element.updateComplete;
}

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(element: T, state: Server): Promise<T> {
  const host = document.createElement("div");
  new ContextProvider(host, { context: cofyStoreContext, initialValue: new CofyStore(stubApi(state)) });
  new ContextProvider(host, { context: i18nContext, initialValue: await testI18n() });
  document.body.append(host);
  host.append(element);
  await settle(element);
  return element;
}

function row(element: HTMLElement, type: string): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>(`tr[data-key="${type}"]`)!;
}

function toggle(control: Element, checked: boolean): void {
  (control as HTMLElement & { checked: boolean }).checked = checked;
  control.dispatchEvent(new Event("change"));
}

describe("cofy-allowed-type-list", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  async function list(state: Server): Promise<CofyAllowedTypeList> {
    const element = new CofyAllowedTypeList();
    element.slug = "test";
    return mount(element, state);
  }

  function checked(element: CofyAllowedTypeList, type: string): boolean {
    return row(element, type).querySelector<HTMLElement & { checked: boolean }>("wa-switch")!.checked;
  }

  it("switches on each type the community may use, with its group", async () => {
    const element = await list(server());

    expect(checked(element, "source/entsoe_day_ahead")).toBe(true);
    expect(checked(element, "resource/tariff")).toBe(true);
    expect(Array.from(row(element, "source/entsoe_day_ahead").querySelector("cofy-type-label")!.shadowRoot!.querySelectorAll("wa-tag"), (tag) => tag.textContent)).toEqual([
      "source",
      "entsoe_day_ahead",
    ]);
    expect(row(element, "resource/tariff").querySelector("cofy-type-label")!.shadowRoot!.textContent).toContain(
      "An energy cost tariff.",
    );
  });

  it("allows and disallows a type to the community", async () => {
    const state = server();
    const element = await list(state);

    toggle(row(element, "source/entsoe_day_ahead").querySelector("wa-switch")!, false);
    await settle(element);
    toggle(row(element, "resource/tariff").querySelector("wa-switch")!, false);
    await settle(element);

    expect(state.writes).toEqual([
      {
        method: "PUT",
        path: "/management/communities/test/allowed-types/source/entsoe_day_ahead",
        body: { allowed: false },
      },
      { method: "PUT", path: "/management/communities/test/allowed-types/resource/tariff", body: { allowed: false } },
    ]);
  });
});

describe("cofy-availability-list", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  async function list(state: Server): Promise<CofyAvailabilityList> {
    const element = new CofyAvailabilityList();
    return mount(element, state);
  }

  function dialog(element: CofyAvailabilityList): CofyAvailabilityDialog {
    return element.shadowRoot!.querySelector("cofy-availability-dialog")!;
  }

  it("says where each type is available", async () => {
    const element = await list(server());

    expect(row(element, "source/entsoe_day_ahead").textContent).toContain("Everywhere");
    expect(row(element, "resource/tariff").textContent).toContain("Only in 1 community");
  });

  it("changes a type's availability in a dialog", async () => {
    const state = server();
    const element = await list(state);

    row(element, "resource/tariff").click();
    await settle(element);
    await settle(dialog(element));
    const form = dialog(element).shadowRoot!;
    expect(form.querySelector<HTMLElement & { value: string[] }>("wa-select")!.value).toEqual(["test"]);
    expect(form.querySelector<HTMLElement & { label: string }>("wa-select")!.label).toBe("Only in");

    toggle(form.querySelector("wa-switch")!, true);
    const select = form.querySelector<HTMLElement & { value: string[] }>("wa-select")!;
    select.value = ["other"];
    select.dispatchEvent(new Event("change"));
    await settle(dialog(element));
    form.querySelector<HTMLElement>('wa-button[variant="brand"]')!.click();
    await settle(element);

    expect(state.writes).toEqual([
      { method: "PUT", path: "/management/allowed-types/resource/tariff", body: { default: true, exceptions: ["other"] } },
    ]);
    expect(dialog(element).open).toBe(false);
    expect(row(element, "resource/tariff").textContent).toContain("Everywhere but 1 community");
  });
});
