import type { HostLocation } from "./states/host-location.js";

/**
 * Follow a click on a link to one of the console's pages through *location*, rather than letting the browser load the
 * host's page anew - but not a click that opens it elsewhere: with a modifier key, another button, or another target.
 *
 * Whether it followed: a host can do more on top, such as closing a menu.
 */
export function followLink(event: MouseEvent, location: HostLocation): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const anchor = event.composedPath().find((target): target is HTMLAnchorElement => target instanceof HTMLAnchorElement);
  if (anchor === undefined || anchor.href === "" || (anchor.target !== "" && anchor.target !== "_self")) return false;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin || !location.follow(url.pathname)) return false;
  event.preventDefault();
  return true;
}
