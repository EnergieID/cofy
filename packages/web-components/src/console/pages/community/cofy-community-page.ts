import { css } from "lit";
import type { CSSResultGroup } from "lit";
import { property } from "lit/decorators.js";
import type { Crumb } from "../../../index.js";

import type { RouteName } from "../../routes.js";
import { CofyPage } from "../cofy-page.js";

/**
 * What every page of a community needs on top of {@link CofyPage}: the community it is part of,
 * and its trail.
 *
 * The trail starts at the community, which leads to its modules for now, then the section the
 * page is in, then whatever lies inside that section.
 */
export abstract class CofyCommunityPage extends CofyPage {
  public static override styles: CSSResultGroup = css`
    :host {
      display: block;
    }
  `;

  @property({ type: String }) public override slug = "";

  /** The trail through *section*, ending in *inside*; the section itself is a link only when something lies inside it. */
  protected sectionTrail(section: RouteName, ...inside: Crumb[]): Crumb[] {
    const community = this.cofy?.communities.get(this.slug);
    const label = this.t(`menu.items.${section}`);
    return [
      { label: community?.title ?? this.slug, href: this.routes.hrefFor("modules", { slug: this.slug }) },
      inside.length === 0 ? { label } : { label, href: this.routes.hrefFor(section, { slug: this.slug }) },
      ...inside,
    ];
  }
}
