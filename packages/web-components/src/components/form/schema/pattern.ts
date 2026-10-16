/** Characters a `v`-flag character class reserves, which a `u`-flag one takes literally. */
const RESERVED_IN_CLASS = new Set(["(", ")", "[", "{", "}", "/", "|"]);

/**
 * A JSON Schema `pattern` as an input's `pattern` attribute takes it, or `undefined` where it can't be expressed as one.
 *
 * The two differ in two ways. An input's pattern has to match the whole value, where a JSON Schema one only has to match
 * somewhere in it - so it is wrapped to match anywhere. And a browser compiles it with the `v` flag, whose character
 * classes reserve characters a `u`-flag one takes literally, like the `-` that ends `[a-zA-Z0-9_-]` - so those are
 * escaped. A pattern that still doesn't compile is left to the validator, which reports it either way.
 */
export function inputPattern(pattern: string): string | undefined {
  const wrapped = `[\\s\\S]*(?:${escapeClasses(pattern)})[\\s\\S]*`;
  try {
    new RegExp(`^(?:${wrapped})$`, "v");
    return wrapped;
  } catch {
    return undefined;
  }
}

function escapeClasses(pattern: string): string {
  let out = "";
  let inClass = false;
  let classStart = 0;

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]!;
    if (char === "\\") {
      out += pattern.slice(i, i + 2);
      i += 1;
      continue;
    }
    if (!inClass) {
      if (char === "[") {
        inClass = true;
        // A leading `^` negates the class; the class's own characters start after it.
        classStart = pattern[i + 1] === "^" ? i + 2 : i + 1;
      }
      out += char;
      continue;
    }
    if (char === "]") {
      inClass = false;
      out += char;
      continue;
    }
    // A `-` between two characters is a range; one at either end of the class is the character itself.
    const literalDash = char === "-" && (i === classStart || pattern[i + 1] === "]");
    out += RESERVED_IN_CLASS.has(char) || literalDash ? `\\${char}` : char;
  }
  return out;
}
