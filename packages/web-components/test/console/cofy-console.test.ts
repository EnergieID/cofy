import { ApiClient, CofyStore, type Me } from "@cofy/frontend-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CofyConsole, type ConsoleMenuItem } from "../../src/console/cofy-console.js";
import { ConsoleState } from "../../src/console/states/console-state.js";
import type { NavigateDetail } from "../../src/console/states/host-location.js";

const API = "http://localhost/cofy";

/** May see community "foo" and edit what is configured in it, as a community editor. */
const EDITOR: Me = {
  email: "ann@example.com",
  name: "Ann",
  system_admin: false,
  permissions: [
    {
      slug: "foo",
      permissions: [
        { action: "read", subject: "community" },
        { action: "read", subject: "modules" },
        { action: "update", subject: "modules" },
        { action: "read", subject: "resources" },
        { action: "read", subject: "secrets" },
      ],
    },
  ],
};

/** COFY under `/cofy`, for *me*: who is logged in, and the community "foo". */
function serve(me: Me): void {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(new URL(input.toString(), "http://localhost"), init);
    return Promise.resolve(answer(new URL(request.url).pathname, me));
  });
}

function answer(path: string, me: Me): Response {
    if (path === "/cofy/auth/me") return Response.json(me);
    const klimaan = { slug: "foo", title: "Klimaan", description: "", module_count: 0, revision: 1, api_url: "" };
    if (path === "/cofy/management/communities") return Response.json([klimaan]);
    if (path === "/cofy/management/communities/foo") return Response.json(klimaan);
    return Response.json([]);
}

/** The console for community "foo", under `/w/1/cofy`, once it has rendered what it knows. */
async function embedded(me: Me = EDITOR, attributes: Partial<CofyConsole> = {}): Promise<CofyConsole> {
  serve(me);
  const element = Object.assign(new CofyConsole(), { community: "foo", basePath: "/w/1/cofy", apiPath: API }, attributes);
  document.body.append(element);
  await settled(element);
  return element;
}

function menu(element: CofyConsole): ConsoleMenuItem[] {
  return element.state!.menu();
}

async function settled(element: CofyConsole): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await element.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("cofy-console", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.history.replaceState(null, "", "/w/1/cofy");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists in its state the community's pages it may see, as the host links to them", async () => {
    const element = await embedded();

    expect(menu(element).map((item) => [item.name, item.label, item.path, item.href, item.current])).toEqual([
      ["modules", "Modules", "/", "/w/1/cofy", true],
      ["resources", "Resources", "/resources", "/w/1/cofy/resources", false],
      ["secrets", "Secrets", "/secrets", "/w/1/cofy/secrets", false],
    ]);
  });

  it("tells a host subscribed to its state when the menu changes", async () => {
    const element = await embedded();
    const seen: string[] = [];
    element.state!.subscribe(() => seen.push(menu(element).find((item) => item.current)!.name));

    element.path = "/secrets";
    await settled(element);

    expect(seen).toContain("secrets");
  });

  it("stops telling a host that unsubscribed", async () => {
    const element = await embedded();
    let told = 0;
    const stop = element.state!.subscribe(() => told++);
    stop();

    element.path = "/secrets";
    await settled(element);

    expect(told).toBe(0);
  });

  it("has a trail in its state, for a host to draw", async () => {
    const element = await embedded(EDITOR, { path: "/secrets" });

    expect(element.state!.crumbs.crumbs.map((crumb) => crumb.label)).toEqual(["Klimaan", "Secrets"]);
  });

  it("shows the page the host sets", async () => {
    const element = await embedded(EDITOR, { path: "/secrets" });

    expect(element.shadowRoot!.querySelector("cofy-secrets-page")).not.toBeNull();
    expect(menu(element).find((item) => item.current)?.name).toBe("secrets");
  });

  it("asks the host to follow a link to one of its pages", async () => {
    const element = await embedded();
    const asked: NavigateDetail[] = [];
    element.addEventListener("cofy-navigate", (event) => {
      asked.push((event as CustomEvent<NavigateDetail>).detail);
      event.preventDefault();
    });
    const link = Object.assign(document.createElement("a"), { href: "/w/1/cofy/resources" });
    element.shadowRoot!.append(link);

    link.click();

    expect(asked).toEqual([{ path: "/resources", href: "/w/1/cofy/resources" }]);
  });

  it("leaves a link elsewhere on the host's site to the browser", async () => {
    const element = await embedded();
    const asked: unknown[] = [];
    element.addEventListener("cofy-navigate", (event) => asked.push(event));
    const link = Object.assign(document.createElement("a"), { href: "/w/1/settings" });
    element.shadowRoot!.append(link);
    link.addEventListener("click", (event) => event.preventDefault());

    link.click();

    expect(asked).toEqual([]);
  });

  it("leaves the host's page as it is", async () => {
    const before = { classes: document.documentElement.className, head: document.head.innerHTML };

    await embedded();

    expect({ classes: document.documentElement.className, head: document.head.innerHTML }).toEqual(before);
  });

  it("shows the page the host sets again, after going elsewhere itself", async () => {
    const element = await embedded(EDITOR, { path: "/secrets" });
    element.addEventListener("cofy-navigate", (event) => event.preventDefault());
    const link = Object.assign(document.createElement("a"), { href: "/w/1/cofy/resources" });
    element.shadowRoot!.append(link);
    link.click();
    element.path = "/resources";
    await settled(element);

    element.path = "/secrets";
    await settled(element);

    expect(element.shadowRoot!.querySelector("cofy-secrets-page")).not.toBeNull();
  });

  it("follows the back button again once put back on the page", async () => {
    const element = await embedded();
    element.remove();
    document.body.append(element);

    window.history.pushState(null, "", "/w/1/cofy/secrets");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settled(element);

    expect(element.shadowRoot!.querySelector("cofy-secrets-page")).not.toBeNull();
  });

  it("shows from a state the host hands in after it made its own, leaving its own behind", async () => {
    const element = await embedded();
    const own = element.state!;
    const store = new CofyStore(new ApiClient({ baseUrl: API }));
    const handed = new ConsoleState({ store, base: "/w/1/cofy", community: "foo", target: element, i18n: own.i18n });
    handed.start();

    element.state = handed;
    await element.updateComplete;
    window.history.pushState(null, "", "/w/1/cofy/secrets");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settled(element);

    expect(element.shadowRoot!.querySelector("cofy-secrets-page")).not.toBeNull();
    expect(own.location.path).toBe("/communities/foo");
    handed.stop();
  });

  describe("without a community", () => {
    /** May read everything in the communities *slugs*. */
    function member(...slugs: string[]): Me {
      const subjects = ["community", "modules", "resources", "secrets", "tokens", "grants"] as const;
      const permissions = subjects.map((subject) => ({ action: "read" as const, subject }));
      return { ...EDITOR, permissions: slugs.map((slug) => ({ slug, permissions })) };
    }

    async function at(path: string, me: Me): Promise<CofyConsole> {
      window.history.replaceState(null, "", path);
      return embedded(me, { community: undefined, basePath: "" });
    }

    it("lists the communities outside one", async () => {
      const element = await at("/", member("foo", "bar"));

      expect(menu(element).map((item) => [item.name, item.href])).toEqual([["communities", "/communities"]]);
    });

    it("lists a community's pages inside it, by their whole path", async () => {
      const element = await at("/communities/foo/secrets", member("foo", "bar"));

      expect(menu(element).map((item) => [item.name, item.path, item.current])).toEqual([
        ["communities", "/communities", false],
        ["modules", "/communities/foo", false],
        ["resources", "/communities/foo/resources", false],
        ["secrets", "/communities/foo/secrets", true],
        ["tokens", "/communities/foo/tokens", false],
        ["grants", "/communities/foo/grants", false],
      ]);
    });

    it("leaves out the communities for whoever has only one, whose home is that one", async () => {
      const element = await at("/", member("foo"));

      expect(menu(element).find((item) => item.current)?.name).toBe("modules");
      expect(menu(element).map((item) => item.name)).not.toContain("communities");
    });

    it("lists the administration for a system admin", async () => {
      const element = await at("/allowed-types", { ...EDITOR, system_admin: true, permissions: [
        { slug: null, permissions: [{ action: "read", subject: "allowed_types" }, { action: "create", subject: "community" }] },
      ] });

      expect(menu(element).filter((item) => item.group === "administration").map((item) => item.name)).toEqual([
        "typeAvailability",
      ]);
    });
  });
});
