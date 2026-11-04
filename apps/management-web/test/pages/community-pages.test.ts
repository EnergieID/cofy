import { beforeEach, describe, expect, it } from "vitest";

import { CofyModulesPage } from "../../src/pages/community/modules/modules-page.js";
import { CofyNewResourcePage } from "../../src/pages/community/resources/new-resource-page.js";
import { CofySecretsPage } from "../../src/pages/community/secrets-page.js";
import { ANN, mount } from "../support/mount.js";

/** Once the community's name has loaded and the trail is published. */
async function settled(element: HTMLElement & { updateComplete: Promise<boolean> }): Promise<void> {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 10));
  await element.updateComplete;
}

function page<T extends HTMLElement & { slug: string }>(element: T): T {
  element.slug = "foo";
  return element;
}

describe("a community's pages", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("trail from the community to their section", async () => {
    const { element, crumbs } = await mount(page(new CofySecretsPage()), ANN, "#/communities/foo/secrets");
    await settled(element);

    expect(crumbs.crumbs).toEqual([{ label: "Klimaan", href: "#/communities/foo" }, { label: "Secrets" }]);
  });

  it("lead from the community to its modules", async () => {
    const { element, crumbs } = await mount(page(new CofyModulesPage()), ANN, "#/communities/foo");
    await settled(element);

    expect(crumbs.crumbs).toEqual([{ label: "Klimaan", href: "#/communities/foo" }, { label: "Modules" }]);
  });

  it("head each section with the community's header", async () => {
    const { element } = await mount(page(new CofySecretsPage()), ANN, "#/communities/foo/secrets");

    expect(element.shadowRoot!.querySelector("cofy-community-header")).not.toBeNull();
  });

  it("trail through the section to a page inside it, which goes without the header", async () => {
    const { element, crumbs } = await mount(page(new CofyNewResourcePage()), ANN, "#/communities/foo/resources/new");
    await settled(element);

    expect(crumbs.crumbs).toEqual([
      { label: "Klimaan", href: "#/communities/foo" },
      { label: "Resources", href: "#/communities/foo/resources" },
      { label: "New resource" },
    ]);
    expect(element.shadowRoot!.querySelector("cofy-community-header")).toBeNull();
  });
});
