import { describe, expect, it } from "vitest";

import { CommunityTypeAvailabilityStore } from "../../src/stores/community-type-availability-store.js";
import { stubbedApi } from "../support/api.js";

const billing = { group: "module", type: "billing", description: "Billing", allowed: true };
const entsoe = { group: "source", type: "entsoe_day_ahead", description: "", allowed: true };

describe("CommunityTypeAvailabilityStore", () => {
  it("lists every type with whether a community may use it", async () => {
    const { api, calls } = stubbedApi(() => ({ body: [billing, entsoe] }));
    const store = new CommunityTypeAvailabilityStore(api);

    await store.fetch("test");

    expect(store.get("test", { group: "source", type: "entsoe_day_ahead" })).toEqual(entsoe);
    expect(calls[0]!.path).toBe("/management/communities/test/allowed-types");
  });

  it("allows a type to a community or not, as the server stored it", async () => {
    const changed: string[] = [];
    const { api, calls } = stubbedApi((call) =>
      call.method === "GET" ? { body: [billing, entsoe] } : { body: { ...entsoe, allowed: false } },
    );
    const store = new CommunityTypeAvailabilityStore(api, (slug) => changed.push(slug));
    await store.fetch("test");

    await store.setAllowed("test", { group: "source", type: "entsoe_day_ahead" }, false);

    expect(calls[1]).toMatchObject({
      method: "PUT",
      path: "/management/communities/test/allowed-types/source/entsoe_day_ahead",
      body: { allowed: false },
    });
    expect(store.all("test")).toEqual([billing, { ...entsoe, allowed: false }]);
    expect(changed).toEqual(["test"]);
  });
});
