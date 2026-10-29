import { beforeEach, describe, expect, it } from "vitest";
import { forEachDiagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";

import type { CofyYamlEditor } from "../src/components/editor/cofy-yaml-editor.js";
import { locate } from "../src/components/editor/cofy-yaml-editor.js";

async function mountEditor(text: string): Promise<CofyYamlEditor> {
  // `document` below is this file's own YAML fixture text, not the DOM global - `globalThis`
  // reaches the real one instead of shadowing into it.
  const element = globalThis.document.createElement("cofy-yaml-editor");
  element.text = text;
  globalThis.document.body.append(element);
  await element.updateComplete;
  return element;
}

const document = `type: tariff
name: spot
source:
  type: entsoe_day_ahead
  api_key: { type: "secret", name: "entsoe_key" }
formats:
  - type: kiwatt
    source: COFY-API-Demo
`;

describe("locate", () => {
  it("finds a top-level value", () => {
    const range = locate(document, "/name")!;
    expect(document.slice(range[0], range[1])).toBe("spot");
  });

  it("finds a nested value through its path, not by name", () => {
    // `source` appears twice in this document; the pointer has to pick the right one
    const range = locate(document, "/source/type")!;
    expect(document.slice(range[0], range[1])).toBe("entsoe_day_ahead");
  });

  it("finds a value inside a list", () => {
    const range = locate(document, "/formats/0/source")!;
    expect(document.slice(range[0], range[1])).toBe("COFY-API-Demo");
  });

  it("returns nothing for a path the document does not have", () => {
    expect(locate(document, "/nope/missing")).toBeNull();
  });

  it("returns nothing for the document root", () => {
    expect(locate(document, "")).toBeNull();
  });

  it("returns nothing when the document does not parse", () => {
    expect(locate("key: [unclosed", "/key")).toBeNull();
  });

  it("decodes the escapes a JSON Pointer may contain", () => {
    const escaped = 'a/b: 1\na~b: 2\n';
    expect(escaped.slice(...locate(escaped, "/a~1b")!)).toBe("1");
    expect(escaped.slice(...locate(escaped, "/a~0b")!)).toBe("2");
  });
});

function shownMessages(element: CofyYamlEditor): string[] {
  const view = EditorView.findFromDOM(element.renderRoot.querySelector<HTMLElement>(".cm-editor")!)!;
  const messages: string[] = [];
  forEachDiagnostic(view.state, (diagnostic) => messages.push(diagnostic.message));
  return messages;
}

describe("cofy-yaml-editor's issues property", () => {
  beforeEach(() => {
    globalThis.document.body.replaceChildren();
  });

  it("shows issues that arrive after the debounced lint has already run", async () => {
    const element = await mountEditor(document);
    element.issues = [{ pointer: "/name", message: "first" }];
    await element.updateComplete;
    await expect.poll(() => shownMessages(element)).toEqual(["first"]);

    element.issues = [{ pointer: "/name", message: "second" }];
    await element.updateComplete;
    await expect.poll(() => shownMessages(element), { timeout: 100 }).toEqual(["second"]);

    element.issues = [];
    await element.updateComplete;
    await expect.poll(() => shownMessages(element), { timeout: 100 }).toEqual([]);
  });
});
