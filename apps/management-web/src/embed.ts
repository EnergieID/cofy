/**
 * The console for embedding in another app, as `<cofy-console>`: load this module from where the app serves COFY,
 * such as `/cofy/embed.js`, and place the element. It adds nothing to the app's page but the element; the app loads
 * Web Awesome's theme from `embed.css` beside it and brings its own brand on top. The same is
 * `@cofy/web-components/console`, for an app that would rather install it.
 */
// Imported for itself as well: an app build drops an entry's exports, and with them a module only re-exported.
import "@cofy/web-components/console";

export * from "@cofy/web-components/console";
