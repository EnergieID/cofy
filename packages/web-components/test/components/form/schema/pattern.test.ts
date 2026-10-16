import { describe, expect, it } from "vitest";

import { inputPattern } from "../../../../src/components/form/schema/pattern.js";

/** Whether *value* passes *pattern* as a browser applies an input's `pattern`: whole-value, with the `v` flag. */
function passes(pattern: string, value: string): boolean {
  return new RegExp(`^(?:${pattern})$`, "v").test(value);
}

describe("inputPattern", () => {
  it("matches anywhere in the value, as a JSON Schema pattern does, not only the whole of it", () => {
    const pattern = inputPattern("abc")!;
    expect(passes(pattern, "xabcx")).toBe(true);
    expect(passes(pattern, "xyz")).toBe(false);
  });

  it("keeps an anchored pattern anchored", () => {
    const pattern = inputPattern("^abc$")!;
    expect(passes(pattern, "abc")).toBe(true);
    expect(passes(pattern, "xabc")).toBe(false);
  });

  it("escapes the characters a v-flag character class reserves, like a name's trailing dash", () => {
    const pattern = inputPattern("^[a-zA-Z0-9_-]+$")!;
    expect(pattern).toBeDefined();
    expect(passes(pattern, "entsoe_key-2")).toBe(true);
    expect(passes(pattern, "has space")).toBe(false);
  });

  it("escapes a dash at the start of a class, negated or not, and the class's other reserved characters", () => {
    expect(passes(inputPattern("^[-a]+$")!, "-a")).toBe(true);
    expect(passes(inputPattern("^[^-a]+$")!, "b")).toBe(true);
    expect(passes(inputPattern("^[(|)]+$")!, "(|)")).toBe(true);
  });

  it("leaves what is already escaped as it is", () => {
    expect(passes(inputPattern("^[a\\-z]+$")!, "a-z")).toBe(true);
    expect(passes(inputPattern("^\\[x\\]$")!, "[x]")).toBe(true);
  });

  it("gives nothing for a pattern a browser can't compile", () => {
    expect(inputPattern("(unclosed")).toBeUndefined();
  });
});
