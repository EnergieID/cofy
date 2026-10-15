import type { ApiClient } from "../api-client.js";
import { ReadonlyCollection } from "../core/collection.js";
import { withProblem } from "../errors.js";
import type { CommunityTypeAvailability, TypeId } from "../types.js";

/**
 * Every type, with whether each community may use it, identified by group and type - the same restrictions as
 * {@link TypeAvailabilityStore}, seen from one community.
 */
export class CommunityTypeAvailabilityStore extends ReadonlyCollection<
  [slug: string],
  CommunityTypeAvailability,
  TypeId
> {
  protected readonly path = "/management/communities/{slug}/allowed-types";
  private readonly itemPath = "/management/communities/{slug}/allowed-types/{group}/{type_name}";

  private readonly onChange?: (slug: string) => void;

  /** *onChange* is called after every change that succeeded, to invalidate what depends on it. */
  public constructor(api: ApiClient, onChange?: (slug: string) => void) {
    super(api);
    this.onChange = onChange;
  }

  /** Allow the type *id* identifies to the community *slug* or not; the server keeps its default for the others. */
  public async setAllowed(slug: string, id: TypeId, allowed: boolean): Promise<CommunityTypeAvailability> {
    const params = CommunityTypeAvailabilityStore.params(this.itemPath, [slug, ...this.idParts(id)]);
    const changed = (await withProblem(() =>
      this.api.PUT(this.itemPath, { params: { path: params }, body: { allowed } } as never),
    ));
    this.update([slug], (items) => items.map((item) => (this.matches(item, id) ? changed : item)));
    this.onChange?.(slug);
    return changed;
  }

  protected idOf(availability: CommunityTypeAvailability): TypeId {
    return { group: availability.group, type: availability.type };
  }

  protected override idParts(id: TypeId): unknown[] {
    return [id.group, id.type];
  }
}
