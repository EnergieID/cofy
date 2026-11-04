import { html } from "lit";

import type { Action, Subject } from "@cofy/frontend-sdk";

import { buildPath, type Access, type RouteDefinition, type RouteParams } from "./router.js";
import "./pages/admin/allowed-page.js";
import "./pages/communities-page.js";
import "./pages/community/allowed-types-page.js";
import "./pages/community/grants-page.js";
import "./pages/community/modules/module-page.js";
import "./pages/community/modules/modules-page.js";
import "./pages/community/modules/new-module-page.js";
import "./pages/community/resources/new-resource-page.js";
import "./pages/community/resources/resource-page.js";
import "./pages/community/resources/resources-page.js";
import "./pages/community/secrets-page.js";
import "./pages/community/tokens-page.js";
import "./pages/home-page.js";

/**
 * The menu's groups, in order: down the side, then at its foot. The first is the console's top
 * level and goes without a heading; the menu lists a community's pages only inside a community,
 * as their paths need its slug.
 */
export const MENU_GROUPS = ["console", "configuration", "permissions"] as const;
export const MENU_FOOTER_GROUPS = ["administration"] as const;

/**
 * Every page, keyed by the name the rest of the app navigates by.
 *
 * Adding a page means writing its module and adding one entry here: the name, the path it
 * answers, what to render, who may see it and, for a page the menu lists, where. `render`
 * receives only the captured path parameters; everything else - stores, routing, the breadcrumb
 * trail - a page consumes from context.
 *
 * Matching runs in declaration order, so a pattern with a literal segment must come before
 * one whose parameter would also match it.
 */
/** A page for whoever may do *action* to *subject*: in the community it is about, or outside any one without a slug. */
function may(action: Action, subject: Subject): NonNullable<RouteDefinition["allows"]> {
  return (access: Access, { slug }: RouteParams): boolean => access.can(action, subject, slug ?? null);
}

/** The communities someone has a role in. */
function communitiesOf(access: Access): string[] {
  return access.get()?.permissions.flatMap(({ slug }) => (slug === null ? [] : [slug])) ?? [];
}

/** Whether someone has communities to pick from: several of them, or the right to create one. A list of one is not a choice. */
function picks(access: Access): boolean {
  return access.can("write", "community", null) || communitiesOf(access).length > 1;
}

export const routes = {
  /** Where the brand leads: the communities to pick from, the one community someone has, or - with none - a page saying so. */
  home: {
    path: "/",
    render: () => html`<cofy-home-page></cofy-home-page>`,
    redirect: (access): string | undefined => {
      if (picks(access)) return routes.communities.path;
      const [only] = communitiesOf(access);
      return only === undefined ? undefined : buildPath(routes.modules.path, { slug: only });
    },
  },
  communities: {
    path: "/communities",
    render: () => html`<cofy-communities-page></cofy-communities-page>`,
    allows: picks,
    menu: { group: "console", icon: "people-group" },
  },
  typeAvailability: {
    path: "/allowed-types",
    render: () => html`<cofy-allowed-page></cofy-allowed-page>`,
    allows: may("read", "allowed_types"),
    menu: { group: "administration", icon: "sliders" },
  },
  modules: {
    path: "/communities/:slug",
    render: ({ slug }) => html`<cofy-modules-page .slug=${slug}></cofy-modules-page>`,
    allows: may("read", "modules"),
    menu: { group: "configuration", icon: "cubes" },
  },
  resources: {
    path: "/communities/:slug/resources",
    render: ({ slug }) => html`<cofy-resources-page .slug=${slug}></cofy-resources-page>`,
    allows: may("read", "resources"),
    menu: { group: "configuration", icon: "database" },
  },
  secrets: {
    path: "/communities/:slug/secrets",
    render: ({ slug }) => html`<cofy-secrets-page .slug=${slug}></cofy-secrets-page>`,
    allows: may("read", "secrets"),
    menu: { group: "configuration", icon: "lock" },
  },
  tokens: {
    path: "/communities/:slug/tokens",
    render: ({ slug }) => html`<cofy-tokens-page .slug=${slug}></cofy-tokens-page>`,
    allows: may("read", "tokens"),
    menu: { group: "permissions", icon: "key" },
  },
  grants: {
    path: "/communities/:slug/grants",
    render: ({ slug }) => html`<cofy-grants-page .slug=${slug}></cofy-grants-page>`,
    allows: may("read", "grants"),
    menu: { group: "permissions", icon: "user-shield" },
  },
  allowedTypes: {
    path: "/communities/:slug/allowed-types",
    render: ({ slug }) => html`<cofy-community-allowed-page .slug=${slug}></cofy-community-allowed-page>`,
    allows: may("write", "allowed_types"),
    menu: { group: "permissions", icon: "list-check" },
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
