/**
 * The console: `<cofy-console>` with its pages, and the state a host draws its menu and trail from. Imported as
 * `@cofy/web-components/console`, apart from the components, so an app using only those doesn't carry it along.
 */
import "../icons.js";

export { CofyConsole } from "./cofy-console.js";
export { followLink } from "./follow-link.js";
export { CONSOLE_NAMESPACE } from "./i18n.js";
export { MENU_FOOTER_GROUPS, MENU_GROUPS } from "./routes.js";
export { ConsoleState, type ConsoleMenuItem, type ConsoleStateOptions } from "./states/console-state.js";
export type { NavigateDetail } from "./states/host-location.js";
