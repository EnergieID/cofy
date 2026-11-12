import { ApiClient, CofyStore } from "@cofy/frontend-sdk";
import { createI18n } from "../../../src/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConsoleState } from "../../../src/console/states/console-state.js";
import { ANN } from "../support/mount.js";

/** A store whose API answers who is logged in with Ann. */
function store(): CofyStore {
  const fetch = (): Promise<Response> => Promise.resolve(Response.json(ANN));
  return new CofyStore(new ApiClient({ fetch, baseUrl: "http://localhost" }));
}

describe("ConsoleState", () => {
  let state: ConsoleState;
  let told: (string | undefined)[];

  beforeEach(() => {
    window.history.replaceState(null, "", "/console");
    state = new ConsoleState({
      store: store(),
      base: "/console",
      target: new EventTarget(),
      i18n: createI18n({ storage: null }),
    });
    told = [];
    state.subscribe((_state, key) => told.push(key));
    state.start();
  });

  afterEach(() => {
    state.stop();
  });

  it("passes on its location changing", () => {
    state.show("/communities/foo");

    expect(told).toContain("location");
  });

  it("passes on its trail changing", () => {
    state.crumbs.set([{ label: "Foo" }]);

    expect(told).toContain("crumbs");
  });

  it("passes on the session loading", async () => {
    await state.store.session.fetch();

    expect(told).toContain("session");
  });

  it("passes on its translations changing language", async () => {
    await state.i18n.changeLanguage("nl");

    expect(told).toContain("i18n");
  });

  it("passes on its translations being replaced, and then their changes", async () => {
    state.i18n = createI18n({ storage: null });
    expect(told).toContain("i18n");
    told = [];

    await state.i18n.changeLanguage("nl");

    expect(told).toContain("i18n");
  });

  it("passes on nothing once stopped", async () => {
    state.stop();

    state.show("/communities/foo");
    state.crumbs.set([{ label: "Foo" }]);
    await state.store.session.fetch();

    expect(told).toEqual([]);
  });
});
