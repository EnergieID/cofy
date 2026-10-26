import { beforeEach, describe, expect, it } from "vitest";
import { ContextProvider } from "@lit/context";
import type { CatalogEntry, JsonSchema } from "@cofy/frontend-sdk";

import "../../../src/components/module/cofy-module-form.js";
import { i18nContext } from "../../../src/context.js";
import { defaultFieldRegistry } from "../../../src/components/form/field-registry.js";
import type { CofyDirectiveBoundariesForm } from "../../../src/components/form/cofy-directive-boundaries-form.js";
import type { CofyModuleForm } from "../../../src/components/module/cofy-module-form.js";
import { testI18n } from "../../support/i18n.js";

type NumberInput = HTMLElement & { value: string };

const boundaries: JsonSchema = {
  type: "array",
  prefixItems: [{ type: "number" }, { type: "number" }, { type: "number" }, { type: "number" }],
  minItems: 4,
  maxItems: 4,
  title: "Boundaries",
  "x-directive-boundaries": true,
};

/** The shape pydantic gives `DirectiveSourceSettings`, as a module of its own. */
const schema: JsonSchema = {
  type: "object",
  properties: {
    type: { const: "directive", default: "directive", type: "string" },
    boundaries,
    reverse: { type: "boolean", default: false, title: "Reverse" },
  },
  required: ["type", "boundaries"],
};

const catalog: CatalogEntry[] = [{ type: "directive", description: "Directives", schema }];

async function mount(value: unknown): Promise<{ form: CofyModuleForm; values: unknown[] }> {
  const form = document.createElement("cofy-module-form");
  new ContextProvider(form, { context: i18nContext, initialValue: await testI18n() });
  form.catalog = catalog;
  form.value = value;
  const values: unknown[] = [];
  form.addEventListener("module-form-change", (event) =>
    values.push((event as CustomEvent<{ value: { boundaries: unknown } }>).detail.value.boundaries),
  );
  document.body.append(form);
  await settle(form);
  return { form, values };
}

async function settle(form: CofyModuleForm): Promise<void> {
  await form.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function find(root: ParentNode, selector: string): HTMLElement | null {
  const direct = root.querySelector<HTMLElement>(selector);
  if (direct !== null) return direct;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const found = element.shadowRoot === null ? null : find(element.shadowRoot, selector);
    if (found !== null) return found;
  }
  return null;
}

function boundariesForm(form: CofyModuleForm): CofyDirectiveBoundariesForm {
  return find(form.shadowRoot!, "cofy-directive-boundaries-form") as CofyDirectiveBoundariesForm;
}

/** The row as it reads, its inputs shown as their value in brackets. */
function row(form: CofyModuleForm): string {
  const cluster = boundariesForm(form).shadowRoot!.querySelector(".wa-cluster")!;
  return Array.from(cluster.querySelectorAll("wa-tag, span, wa-input"))
    .map((part) => (part.tagName === "WA-INPUT" ? `[${(part as NumberInput).value}]` : part.textContent.trim()))
    .join(" ");
}

function inputs(form: CofyModuleForm): NumberInput[] {
  return Array.from(boundariesForm(form).shadowRoot!.querySelectorAll<NumberInput>("wa-input"));
}

describe("cofy-directive-boundaries-form", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("is what marked boundaries dispatch to, rather than a list", () => {
    expect(defaultFieldRegistry.getFirstMatch(boundaries, schema)?.tag).toBe(
      "cofy-directive-boundaries-form",
    );
  });

  it("shows each boundary between the steps it separates, belonging to the step below it", async () => {
    const { form } = await mount({ type: "directive", boundaries: [10, 20, 30, 40], reverse: false });

    expect(row(form)).toBe("-- ≤ [10] < - ≤ [20] < 0 ≤ [30] < + ≤ [40] < ++");
  });

  it("runs the steps the other way while the reverse beside it is set", async () => {
    const { form } = await mount({ type: "directive", boundaries: [10, 20, 30, 40], reverse: true });

    expect(row(form)).toBe("++ ≤ [10] < + ≤ [20] < 0 ≤ [30] < - ≤ [40] < --");
  });

  it("follows the reverse beside it as it changes", async () => {
    const { form } = await mount({ type: "directive", boundaries: [10, 20, 30, 40] });

    form.value = { type: "directive", boundaries: [10, 20, 30, 40], reverse: true };
    await settle(form);

    expect(row(form)).toBe("++ ≤ [10] < + ≤ [20] < 0 ≤ [30] < - ≤ [40] < --");
  });

  it("reports the boundaries with the one entered replaced", async () => {
    const { form, values } = await mount({ type: "directive", boundaries: [10, 20, 30, 40], reverse: true });

    inputs(form)[0]!.value = "45";
    inputs(form)[0]!.dispatchEvent(new Event("input"));
    inputs(form)[3]!.value = "";
    inputs(form)[3]!.dispatchEvent(new Event("input"));

    expect(values).toEqual([
      [45, 20, 30, 40],
      [10, 20, 30, null],
    ]);
  });

  it("starts empty while there are no boundaries yet", async () => {
    const { form } = await mount({ type: "directive" });

    expect(row(form)).toBe("-- ≤ [] < - ≤ [] < 0 ≤ [] < + ≤ [] < ++");
  });
});
