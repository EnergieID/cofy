import type { ApiClient } from "../api-client.js";
import { ReadonlyCollection } from "../core/collection.js";
import type { CatalogEntry } from "../types.js";

/** What a catalog lists: the module types, or the resource kinds, a community may configure. */
export type CatalogFamily = "modules" | "resources";

/**
 * What each community may configure of one family - module types or resource kinds - with their schemas, identified
 * by type.
 *
 * Which those are, and their schemas, change with the types a system admin allows; see {@link TypeAvailabilityStore}.
 */
export class CatalogStore extends ReadonlyCollection<[slug: string], CatalogEntry, string> {
  protected readonly path: `/management/communities/{slug}/catalog/${CatalogFamily}`;

  public constructor(api: ApiClient, family: CatalogFamily) {
    super(api);
    this.path = `/management/communities/{slug}/catalog/${family}`;
  }

  protected idOf(entry: CatalogEntry): string {
    return entry.type;
  }
}
