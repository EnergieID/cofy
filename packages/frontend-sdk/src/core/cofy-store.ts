import type { ApiClient } from "../api-client.js";
import { CatalogStore } from "../stores/catalog-store.js";
import { CommunityStatusStore } from "../stores/community-status-store.js";
import { CommunityStore } from "../stores/community-store.js";
import { CommunityTypeAvailabilityStore } from "../stores/community-type-availability-store.js";
import { GrantStore } from "../stores/grant-store.js";
import { ModuleStore } from "../stores/module-store.js";
import { ResourceStore } from "../stores/resource-store.js";
import { SecretStore } from "../stores/secret-store.js";
import { SessionStore } from "../stores/session-store.js";
import { TokenStore } from "../stores/token-store.js";
import { TypeAvailabilityStore } from "../stores/type-availability-store.js";
import type { Cache } from "./cache.js";

/**
 * Every store of the management API, against one client.
 *
 * The stores do not know of each other; what a write to one makes out of date in another is
 * decided here, in one place.
 */
export class CofyStore {
  public readonly session: SessionStore;
  public readonly communities: CommunityStore;
  public readonly status: CommunityStatusStore;
  public readonly modules: ModuleStore;
  public readonly moduleCatalog: CatalogStore;
  public readonly resources: ResourceStore;
  public readonly resourceCatalog: CatalogStore;
  public readonly typeAvailability: TypeAvailabilityStore;
  public readonly communityTypeAvailability: CommunityTypeAvailabilityStore;
  public readonly secrets: SecretStore;
  public readonly tokens: TokenStore;
  public readonly grants: GrantStore;

  public constructor(api: ApiClient, location: Location = window.location) {
    this.session = new SessionStore(api, location);
    this.status = new CommunityStatusStore(api);

    // What a community may configure follows from the availability of each type, which a module or resource may
    // also hold inline - so the schemas of both change with any type. The availability of each type is seen both
    // across communities and from each one, so a change through either makes the other out of date.
    this.moduleCatalog = new CatalogStore(api, "modules");
    this.resourceCatalog = new CatalogStore(api, "resources");
    this.typeAvailability = new TypeAvailabilityStore(api, () => {
      this.moduleCatalog.invalidateAll();
      this.resourceCatalog.invalidateAll();
      this.communityTypeAvailability.invalidateAll();
    });
    this.communityTypeAvailability = new CommunityTypeAvailabilityStore(api, (slug) => {
      this.moduleCatalog.invalidate(slug);
      this.resourceCatalog.invalidate(slug);
      this.typeAvailability.invalidate();
    });

    this.communities = new CommunityStore(api, ({ action, id: slug }) => {
      // What the person logged in may do is reported per community, so a new one is missing from it.
      if (action === "create") this.session.invalidate();
      // Changing a community's settings leaves its API behind until it reloads.
      if (action === "replace") this.status.invalidate(slug);
      if (action === "delete") {
        this.forget(slug);
        // A deleted community is no exception to any type any more.
        this.typeAvailability.invalidate();
      }
    });

    // Any change to what a community's API runs leaves that API behind until it reloads.
    this.modules = new ModuleStore(api, ({ action, scope: [slug] }) => {
      this.status.invalidate(slug);
      // The listing counts each community's modules.
      if (action !== "replace") this.communities.invalidate();
    });
    this.resources = new ResourceStore(api, ({ scope: [slug] }) => this.status.invalidate(slug));
    this.secrets = new SecretStore(api, ({ scope: [slug] }) => this.status.invalidate(slug));
    this.tokens = new TokenStore(api, ({ scope: [slug] }) => this.status.invalidate(slug));

    // A grant may be to the person logged in, which changes what they may do - and which
    // communities they may see at all. Revoking one may leave them seeing nothing of it.
    this.grants = new GrantStore(api, ({ action, scope: [slug] }) => {
      this.session.invalidate();
      if (action === "delete") {
        this.communities.invalidate();
        this.invalidate(slug);
      }
    });
  }

  /** Mark everything cached about *slug* as out of date. */
  private invalidate(slug: string): void {
    for (const store of this.perCommunity()) store.invalidate(slug);
  }

  /** Drop everything cached about *slug*, a community that no longer exists. */
  private forget(slug: string): void {
    for (const store of this.perCommunity()) store.forget(slug);
  }

  /** The stores that cache something per community. */
  private perCommunity(): Cache<[slug: string], unknown>[] {
    return [
      this.status,
      this.modules,
      this.moduleCatalog,
      this.resources,
      this.resourceCatalog,
      this.communityTypeAvailability,
      this.secrets,
      this.tokens,
      this.grants,
    ];
  }
}
