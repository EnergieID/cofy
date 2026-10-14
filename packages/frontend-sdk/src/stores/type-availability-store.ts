import type { ApiClient } from "../api-client.js";
import { ReadonlyCollection } from "../core/collection.js";
import { withProblem } from "../errors.js";
import type { Availability, TypeAvailability, TypeId } from "../types.js";

/**
 * Every type a system admin may restrict - module types, and the types resources hold - with which communities may
 * use it, identified by group and type.
 *
 * Changing one changes what the communities may configure, and the schemas they are served for it.
 */
export class TypeAvailabilityStore extends ReadonlyCollection<[], TypeAvailability, TypeId> {
  protected readonly path = "/management/allowed-types";
  private readonly itemPath = "/management/allowed-types/{group}/{type_name}";

  private readonly onChange?: (id: TypeId) => void;

  /** *onChange* is called after every change that succeeded, to invalidate what depends on it. */
  public constructor(api: ApiClient, onChange?: (id: TypeId) => void) {
    super(api);
    this.onChange = onChange;
  }

  /** Replace which communities may use the type *id* identifies. */
  public async replace(id: TypeId, body: Availability): Promise<TypeAvailability> {
    const params = TypeAvailabilityStore.params(this.itemPath, this.idParts(id));
    const replaced = (await withProblem(() =>
      this.api.PUT(this.itemPath, { params: { path: params }, body } as never),
    ));
    this.update([], (items) => items.map((item) => (this.matches(item, id) ? replaced : item)));
    this.onChange?.(id);
    return replaced;
  }

  protected idOf(availability: TypeAvailability): TypeId {
    return { group: availability.group, type: availability.type };
  }

  protected override idParts(id: TypeId): unknown[] {
    return [id.group, id.type];
  }
}
