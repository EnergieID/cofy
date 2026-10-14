/**
 * Browser APIs jsdom does not implement, stubbed just enough for the Web Awesome components the
 * console's own components render. Each was added because a component reached for it and threw.
 */

/** Define *name* on *target* only where the environment has not. */
function fallback(target: object, name: string, value: unknown): void {
  if (name in target) return;
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

// Every Web Awesome component is form-associated and reports its validity on its first render;
// jsdom implements `attachInternals()` but not the validity half of what it returns.
const internals: object | undefined = globalThis.ElementInternals?.prototype;
if (internals !== undefined) {
  fallback(internals, "setValidity", () => {});
  fallback(internals, "setFormValue", () => {});
  fallback(internals, "checkValidity", () => true);
  fallback(internals, "reportValidity", () => true);
  fallback(internals, "validity", { valid: true });
}
