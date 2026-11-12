import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HostLocation, type NavigateDetail } from "../../../src/console/states/host-location.js";

/** Community `foo`'s pages under `/w/1/cofy` on the host's site, as an app embedding the console has them. */
function embedded(target: EventTarget = new EventTarget()): HostLocation {
  return new HostLocation("/w/1/cofy", "/communities/foo", target);
}

/** Every page under `/console`, as the console's own shell has them. */
function standalone(): HostLocation {
  return new HostLocation("/console", "", new EventTarget());
}

describe("HostLocation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("starts at the page the host's address shows", () => {
    window.history.replaceState(null, "", "/w/1/cofy/secrets");

    expect(embedded().path).toBe("/communities/foo/secrets");
  });

  it("starts at its prefix elsewhere on the host's site", () => {
    window.history.replaceState(null, "", "/w/1/settings");

    expect(embedded().path).toBe("/communities/foo");
    expect(standalone().path).toBe("/");
  });

  it("links under the host's prefix", () => {
    expect(embedded().href("/communities/foo/modules/tariff/spot")).toBe("/w/1/cofy/modules/tariff/spot");
    expect(embedded().href("/communities/foo")).toBe("/w/1/cofy");
    expect(standalone().href("/communities/foo")).toBe("/console/communities/foo");
    expect(standalone().href("/")).toBe("/console");
  });

  it("links to a path outside the console's prefix whole, under the host's", () => {
    expect(embedded().href("/communities")).toBe("/w/1/cofy/communities");
  });

  it("tells a path as the host shows it", () => {
    window.history.replaceState(null, "", "/w/1/cofy/secrets");

    expect(embedded().hostPath).toBe("/secrets");
    expect(embedded().hostPathOf("/communities/foo")).toBe("/");
  });

  it("asks the host to navigate, and leaves it to a host that does", () => {
    const target = new EventTarget();
    const asked: NavigateDetail[] = [];
    target.addEventListener("cofy-navigate", (event) => {
      asked.push((event as CustomEvent<NavigateDetail>).detail);
      event.preventDefault();
    });
    const location = embedded(target);

    location.go("/communities/foo/secrets");

    expect(asked).toEqual([{ path: "/secrets", href: "/w/1/cofy/secrets" }]);
    expect(window.location.pathname).toBe("/");
    expect(location.path).toBe("/communities/foo");
  });

  it("navigates through the history for a host that doesn't", () => {
    const location = embedded();

    location.go("/communities/foo/secrets");

    expect(window.location.pathname).toBe("/w/1/cofy/secrets");
    expect(location.path).toBe("/communities/foo/secrets");
  });

  it("follows a link under the host's prefix, and only there", () => {
    const location = standalone();

    expect(location.follow("/elsewhere")).toBe(false);
    expect(location.follow("/console/communities/foo")).toBe(true);
    expect(location.path).toBe("/communities/foo");
  });

  it("shows what the host navigated to", () => {
    const location = embedded();

    location.show("/secrets");
    expect(location.path).toBe("/communities/foo/secrets");
    location.show("/");
    expect(location.path).toBe("/communities/foo");
  });

  it("follows the back button within the host's prefix, until stopped", () => {
    const location = embedded();
    location.start();

    window.history.replaceState(null, "", "/w/1/cofy/resources");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(location.path).toBe("/communities/foo/resources");

    window.history.replaceState(null, "", "/w/1/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(location.path).toBe("/communities/foo/resources");

    location.stop();
    window.history.replaceState(null, "", "/w/1/cofy/secrets");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(location.path).toBe("/communities/foo/resources");
  });
});
