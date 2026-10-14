import { describe, expect, it } from "vitest";

import { TypeAvailabilityStore } from "../../src/stores/type-availability-store.js";
import { stubbedApi } from "../support/api.js";

const billing = { group: "module", type: "billing", description: "Billing", default: true, exceptions: [] };
const tariff = { group: "resource", type: "tariff", description: "Tariff", default: false, exceptions: ["test"] };
// The same name in another group is another type.
const directive = { group: "source", type: "billing", description: "Not billing", default: true, exceptions: [] };

describe("TypeAvailabilityStore", () => {
  it("lists the availability of every type, without a scope, identified by group and type", async () => {
    const { api, calls } = stubbedApi(() => ({ body: [billing, tariff, directive] }));
    const store = new TypeAvailabilityStore(api);

    await store.fetch();

    expect(store.get({ group: "resource", type: "tariff" })).toEqual(tariff);
    expect(store.get({ group: "source", type: "billing" })).toEqual(directive);
    expect(calls[0]!.path).toBe("/management/allowed-types");
  });

  it("replaces one type's availability with what the server stored", async () => {
    const changed: unknown[] = [];
    const replaced = { ...billing, default: false, exceptions: ["other"] };
    const { api, calls } = stubbedApi((call) =>
      call.method === "GET" ? { body: [billing, directive] } : { body: replaced },
    );
    const store = new TypeAvailabilityStore(api, (id) => changed.push(id));
    await store.fetch();

    await store.replace({ group: "module", type: "billing" }, { default: false, exceptions: ["other"] });

    expect(calls[1]).toMatchObject({
      method: "PUT",
      path: "/management/allowed-types/module/billing",
      body: { default: false, exceptions: ["other"] },
    });
    expect(store.all()).toEqual([replaced, directive]);
    expect(changed).toEqual([{ group: "module", type: "billing" }]);
  });
});
