import { beforeEach, describe, expect, it } from "vitest";

import { followLink } from "../../src/console/follow-link.js";
import { HostLocation } from "../../src/console/states/host-location.js";

/** A click on a link to *href*, with *init* and the link's *target*, as followed through a location under `/console`. */
function click(href: string, init: MouseEventInit = {}, target = ""): { followed: boolean; prevented: boolean; path: string } {
  const location = new HostLocation("/console", "", new EventTarget());
  const link = Object.assign(document.createElement("a"), { href, target });
  document.body.append(link);
  let result = { followed: false, prevented: false };
  link.addEventListener("click", (event) => {
    const followed = followLink(event, location);
    result = { followed, prevented: event.defaultPrevented };
    event.preventDefault();
  });
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, ...init }));
  return { ...result, path: location.path };
}

describe("followLink", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.history.replaceState(null, "", "/");
  });

  it("follows a plain click on a link to one of the console's pages", () => {
    expect(click("/console/communities/foo")).toEqual({ followed: true, prevented: true, path: "/communities/foo" });
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])(
    "leaves a click that opens the link elsewhere to the browser: %o",
    (init) => {
      expect(click("/console/communities/foo", init)).toMatchObject({ followed: false, prevented: false });
    },
  );

  it("leaves a link to another target, another site, or elsewhere on the host's to the browser", () => {
    expect(click("/console/communities/foo", {}, "_blank").followed).toBe(false);
    expect(click("https://elsewhere.example/console").followed).toBe(false);
    expect(click("/settings").followed).toBe(false);
  });
});
