import { html } from "lit";

import type { Action, Subject } from "@cofy/frontend-sdk";

import type { Access, RouteDefinition, RouteParams } from "./router.js";
import "./pages/allowed-page.js";
import "./pages/communities-page.js";
import "./pages/module-page.js";
import "./pages/community-page.js";
import "./pages/new-module-page.js";
import "./pages/new-resource-page.js";
import "./pages/resource-page.js";

/**
 * Every page, keyed by the name the rest of the app navigates by.
 *
 * Adding a page means writing its module and adding one entry here: the name, the path it
 * answers, what to render, and who may see it. `render` receives only the captured path
 * parameters; everything else - stores, routing, the breadcrumb trail - a page consumes from
 * context.
 *
 * Matching runs in declaration order, so a pattern with a literal segment must come before
 * one whose parameter would also match it.
 */
/** A page for whoever may do *action* to *subject*: in the community it is about, or outside any one without a slug. */
function may(action: Action, subject: Subject): NonNullable<RouteDefinition["allows"]> {
  return (access: Access, { slug }: RouteParams): boolean => access.can(action, subject, slug ?? null);
}

export const routes = {
  communities: {
    path: "/",
    render: () => html`<cofy-communities-page></cofy-communities-page>`,
  },
  typeAvailability: {
    path: "/allowed-types",
    render: () => html`<cofy-allowed-page></cofy-allowed-page>`,
    allows: may("read", "allowed_types"),
  },
  modules: {
    path: "/communities/:slug",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="modules"></cofy-community-page>`,
    allows: may("read", "modules"),
  },
  resources: {
    path: "/communities/:slug/resources",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="resources"></cofy-community-page>`,
    allows: may("read", "resources"),
  },
  secrets: {
    path: "/communities/:slug/secrets",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="secrets"></cofy-community-page>`,
    allows: may("read", "secrets"),
  },
  tokens: {
    path: "/communities/:slug/tokens",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="tokens"></cofy-community-page>`,
    allows: may("read", "tokens"),
  },
  grants: {
    path: "/communities/:slug/grants",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="grants"></cofy-community-page>`,
    allows: may("read", "grants"),
  },
  allowedTypes: {
    path: "/communities/:slug/allowed-types",
    render: ({ slug }) => html`<cofy-community-page .slug=${slug} tab="allowedTypes"></cofy-community-page>`,
    allows: may("write", "allowed_types"),
  },
  newModule: {
    path: "/communities/:slug/modules/new",
    render: ({ slug }) => html`<cofy-new-module-page .slug=${slug}></cofy-new-module-page>`,
    allows: may("write", "modules"),
  },
  newResource: {
    path: "/communities/:slug/resources/new",
    render: ({ slug }) => html`<cofy-new-resource-page .slug=${slug}></cofy-new-resource-page>`,
    allows: may("write", "resources"),
  },
  resource: {
    path: "/communities/:slug/resources/:name",
    render: ({ slug, name }) => html`<cofy-resource-page .slug=${slug} .name=${name}></cofy-resource-page>`,
    allows: may("read", "resources"),
  },
  module: {
    path: "/communities/:slug/modules/:type/:name",
    render: ({ slug, type, name }) =>
      html`<cofy-module-page .slug=${slug} .moduleId=${{ type, name }}></cofy-module-page>`,
    allows: may("read", "modules"),
  },
} as const satisfies Record<string, RouteDefinition>;

/** The name of a page, for navigating and linking. */
export type RouteName = keyof typeof routes;
