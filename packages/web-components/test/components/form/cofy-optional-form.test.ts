import { beforeEach, describe, expect, it } from "vitest";
import { ContextProvider } from "@lit/context";
import type { JsonSchema } from "@cofy/frontend-sdk";

import type { CofyActionMenu } from "../../../src/components/form/cofy-action-menu.js";
import "../../../src/components/form/cofy-any-form.js";
import type { CofyAnyForm } from "../../../src/components/form/cofy-any-form.js";
import type { CofyFieldShell } from "../../../src/components/form/cofy-field-shell.js";
import { i18nContext } from "../../../src/context.js";
import { testI18n } from "../../support/i18n.js";

/** `X | None`, as pydantic emits it for a field defaulting to `None`. */
function optional(inner: JsonSchema, title = "Field"): JsonSchema {
  return { title, anyOf: [inner, { type: "null" }], default: null };
}

/** Mounted through `cofy-any-form`, as every form mounts its fields, inside a provider of the translations it uses. */
async function mount(schema: JsonSchema, value: unknown): Promise<{ element: CofyAnyForm; changes: unknown[] }> {
  const host = document.createElement("div");
  new ContextProvider(host, { context: i18nContext, initialValue: await testI18n() });
  document.body.append(host);

  const element = document.createElement("cofy-any-form");
  element.schema = schema;
  element.root = schema;
  element.pointer = "/field";
  element.value = value;
  const changes: unknown[] = [];
  element.addEventListener("field-change", (event) => changes.push((event as CustomEvent<{ value: unknown }>).detail.value));
  host.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { element, changes };
}

/** The first *selector* in *root* or any shadow root below it. */
function deepQuery<T extends Element>(root: ParentNode, selector: string): T | null {
  const direct = root.querySelector<T>(selector);
  if (direct !== null) return direct;
  for (const element of Array.from(root.querySelectorAll("*"))) {
    const found = element.shadowRoot === null ? null : deepQuery<T>(element.shadowRoot, selector);
    if (found !== null) return found;
  }
  return null;
}

function menu(element: CofyAnyForm): string[] {
  return deepQuery<CofyActionMenu>(element.shadowRoot!, "cofy-action-menu")?.actions.map((action) => action.id) ?? [];
}

function runAction(element: CofyAnyForm, id: string): void {
  deepQuery<CofyActionMenu>(element.shadowRoot!, "cofy-action-menu")!.actions.find((action) => action.id === id)!.run();
}

function createItem(element: CofyAnyForm): HTMLElement | null {
  return deepQuery<HTMLElement>(element.shadowRoot!, 'wa-details[summary="Create"]');
}

const thing: JsonSchema = { type: "object", properties: { a: { type: "string", default: "x" } } };

describe("cofy-optional-form", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("offers to create a container that is not there, under the field's own label", async () => {
    const { element } = await mount(optional(thing, "Cache"), null);

    expect(createItem(element)).not.toBeNull();
    expect(deepQuery<CofyFieldShell>(element.shadowRoot!, "cofy-field-shell")!.label).toBe("Cache");
    expect(deepQuery(element.shadowRoot!, "cofy-object-form")).toBeNull();
    expect(menu(element)).toEqual([]);
  });

  it("creates it from what it holds, not from its own default of null", async () => {
    const { element, changes } = await mount(optional(thing), null);

    createItem(element)!.dispatchEvent(new CustomEvent("wa-show", { cancelable: true }));

    expect(changes).toEqual([{ a: "x" }]);
  });

  it("shows a container that is there as its own form, with clearing it back to null among its actions", async () => {
    const { element, changes } = await mount(optional(thing, "Cache"), { a: "y" });

    expect(createItem(element)).toBeNull();
    expect(deepQuery(element.shadowRoot!, "cofy-object-form")).not.toBeNull();
    expect(deepQuery<CofyFieldShell>(element.shadowRoot!, "cofy-field-shell")!.label).toBe("Cache");
    expect(menu(element)).toEqual(["toggle-yaml", "clear"]);

    runAction(element, "clear");
    expect(changes).toEqual([null]);
  });

  it("always shows a single input, empty while null, offering to clear it only once it holds something", async () => {
    const empty = await mount(optional({ type: "string" }), null);
    expect(createItem(empty.element)).toBeNull();
    expect(deepQuery<HTMLElement & { value: string }>(empty.element.shadowRoot!, "wa-input")!.value).toBe("");
    expect(menu(empty.element)).toEqual([]);

    const filled = await mount(optional({ type: "string" }), "spot");
    expect(menu(filled.element)).toEqual(["clear"]);
    runAction(filled.element, "clear");
    expect(filled.changes).toEqual([null]);
  });

  it("holds several types as a union of them", async () => {
    const { element } = await mount(
      { anyOf: [{ $ref: "#/$defs/A" }, { $ref: "#/$defs/B" }, { type: "null" }], default: null, $defs: { A: thing, B: thing } },
      { a: "y" },
    );

    expect(deepQuery(element.shadowRoot!, "cofy-union-form")).not.toBeNull();
  });

  it("creates a value nothing is valid against as something that says so, which can be cleared again", async () => {
    const { element, changes } = await mount(optional({ not: {} }), null);

    createItem(element)!.dispatchEvent(new CustomEvent("wa-show", { cancelable: true }));
    expect(changes).toEqual([{}]);

    const created = await mount(optional({ not: {} }), {});
    expect(deepQuery(created.element.shadowRoot!, "cofy-never-form")).not.toBeNull();
    expect(menu(created.element)).toEqual(["clear"]);
  });
});

describe("cofy-field-shell", () => {
  it("shows its actions beside its label, or beside the control itself where it has no label", async () => {
    const { element } = await mount(optional({ type: "string" }), "spot");
    const shell = deepQuery<CofyFieldShell>(element.shadowRoot!, "cofy-field-shell")!;
    expect(shell.shadowRoot!.querySelector('.header slot[name="actions"]')).not.toBeNull();
    expect(shell.shadowRoot!.querySelector('.body slot[name="actions"]')).toBeNull();

    shell.label = "";
    await shell.updateComplete;
    expect(shell.shadowRoot!.querySelector(".header")).toBeNull();
    expect(shell.shadowRoot!.querySelector("label")).toBeNull();
    expect(shell.shadowRoot!.querySelector('.body slot[name="actions"]')).not.toBeNull();
  });
});
