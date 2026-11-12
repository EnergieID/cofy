# COFY Management API

COFY Management API provides endpoints to manage one or more COFY configurations.

It depends on cofy-api and uses its module settings models for polymorphic module configuration.

This is the backend for route 2 in the [root README](../../README.md), hosting more than one
community behind a single management layer. It's a plain CRUD/config API with no UI of its own -
pair it with [packages/frontend-sdk](../frontend-sdk) and
[packages/web-components](../web-components) (or the default console,
[apps/management-web](../../apps/management-web)) for a UI, or drive it directly if you're
building your own tooling. [apps/demo_multitenant](../../apps/demo_multitenant) shows the whole
stack running together.

## Configuration

`COFY_MANAGEMENT_DATA_DIR` and `COFY_MANAGEMENT_COMMUNITIES_DIR` must be set to writable
directories - there is no built-in default. The first holds who may do what in
`access/users.yaml`, and which types communities may configure in `access/allowed.yaml`; the second the community
configs, as `<slug>.yaml`. They are apart so the
community configs can live elsewhere: the [runner](../runner) serving them needs nothing else. See [apps/demo_multitenant](../../apps/demo_multitenant)
for a worked example, including a reset script that restores its data to committed defaults.

Every write replaces a file whole, renaming a new one over it, so whatever reads the files without
going through this API never sees one half-written; the locks writes take are on hidden `.lock`
files beside them. A community config's `revision` is raised by one on every write; raise it when
editing one by hand too, so the change shows as a new revision.

`COFY_MANAGEMENT_COMMUNITIES_URL` must be set to where the communities' APIs are served, such as
`https://cofy.example/communities` - by the [runner](../runner), or anything else serving each
under its slug. A community's `api_url` is its slug under it, and
`/management/communities/{slug}/status` asks its `/health` for the revision it runs, answering in
one of three states: `live` when that is the saved one, `pending` while it is an earlier one - for
a few seconds after a change, or for as long as the change fails to apply - and `unavailable`. Why
is in the log of what serves it, not in the answer.

`COFY_MANAGEMENT_SECRETS_ENCRYPTION_KEY` must be set to the public key of a key pair made with `task keypair`, which
prints it and the runner's private key as the lines to put in a `.env`. Every secret written through this API is stored encrypted with it, so only what holds the private key - the
[runner](../runner) - can read it. The API won't start without it.

## Logging in

Every route needs a login, except the login itself. The API doesn't keep accounts: it logs people
in through an OpenID Connect provider of your choice - Keycloak, Authentik, Entra ID, Duende
IdentityServer, ... - as a confidential client using the authorization code flow with PKCE, and
keeps who logged in in a signed, HTTP-only session cookie. The browser never holds a token.

| Variable                             | Meaning                                                       |
|--------------------------------------|---------------------------------------------------------------|
| `COFY_MANAGEMENT_OIDC_ISSUER`        | The provider's issuer URL, where its discovery document is.   |
| `COFY_MANAGEMENT_OIDC_CLIENT_ID`     | This API's client id at the provider.                         |
| `COFY_MANAGEMENT_OIDC_CLIENT_SECRET` | Its client secret.                                            |
| `COFY_MANAGEMENT_OIDC_SCOPES`        | Optional, `openid profile email` by default.                  |
| `COFY_MANAGEMENT_SESSION_SECRET`     | A long random value the session cookie is signed with.        |
| `COFY_MANAGEMENT_SESSION_LIFETIME`   | Optional, how long a login lasts, as an ISO 8601 duration; `PT8H` by default. |
| `COFY_MANAGEMENT_SECURE_COOKIES`     | Optional, `true` by default; `false` only to develop over plain HTTP. |

The API won't start without the first four. At the provider, register the redirect URI
`https://<host>/auth/callback`, and have it report a verified `email` claim, in the ID token or
from its userinfo endpoint.

Behind a TLS-terminating proxy, run uvicorn with `--proxy-headers` so that callback URL is built
with the public scheme and host.

### Served through another app

An app embedding the console (see [apps/management-web](../../apps/management-web#embedding-the-console)) serves the
API and console under a path of its own site, such as `https://app.example/cofy`, by proxying that path here. Then
the session cookie is that site's, and logging in has to come back there. List such URLs in
`COFY_MANAGEMENT_PROXIED_URLS`, comma-separated; the proxy sends the path it serves this under in
`X-Forwarded-Prefix` (`/cofy`), and may strip it from the request's path or not. Only the URLs listed are honoured,
each with a path of its own. Register each one's callback, such as `https://app.example/cofy/auth/callback`, at the
identity provider too.

### Who may do what

Everyone who may do something is listed in `access/users.yaml` in the data directory, each with
the role they have in each community:

```yaml
users:
  - email: you@example.com
    system_admin: true
  - email: ann@example.com
    grants:
      demo: community_admin
```

- **System admins** may do everything. Who they are is edited in this file on the server, not
  through the API.
- **Community admins** may manage the communities they are granted, including who else has
  access to them, through `/management/communities/{slug}/grants`. Deleting a community takes
  away every role in it.
- **Community editors** may change the modules of the communities they are granted, but not add
  or remove any, and manage their resources and secrets. Their tokens and who has access are
  out of their reach.

- **Clients** are programs, such as an app that creates communities for its users. See [Clients](#clients).

Access is granted to an email, since that is all anyone knows of a person who hasn't logged in yet.
At that person's first login with a verified email, their identity at the provider is written
in beside it and matched on from then on, so changing their email there neither loses their
access nor hands it to whoever gets the address next.

A permission is an action - `read` or `write` - on a subject of a community: its own settings,
its modules, resources, secrets, grants, or the types it may use (`cofy/management/auth/access.py`). A role is a
set of permissions, so adding one - a viewer, say - is a matter of listing what it may do.

Every route is registered with the rule of `cofy/management/policies/` guarding it, and a router
refuses a route without one. One policy covers every subject alike: seeing it takes `read` on it,
changing it `write`. A subject whose rules differ gets a subclass, as communities do, which only
a system admin may delete. System admins are let through every rule.

`/auth/me` reports what the person logged in may do, per community, and outside any one community
(`slug: null`), such as creating communities, for a system admin or with a global role. Listing communities takes
being able to see at least one; anyone else is refused, as for a community they can't see. It also reports the
person's account at the provider (`issuer`, `subject`), for an app embedding the console to check it is theirs.

### Clients

A program calls the API with an API key, as `Authorization: Bearer <key>`, instead of logging in. Clients are listed
in `access/users.yaml` beside the people, by a system admin, with the hash of their key:

```yaml
clients:
  - name: energyid
    hash: sha256:...
    roles: [community_creator]
```

Make a key and its hash with
`uv run python -c "from cofy.api import generate_key, hash_key; k = generate_key(); print(k, hash_key(k))"`, list the
hash, and give the key to whoever runs the client; it is not stored.

Besides the roles they are granted in a community, people and clients alike may have **global roles**, outside any
one community, in `roles`. A **community creator** may create communities, and gets a role in each one it creates: a
person becomes its community admin, and a client gets the **integration** role, to look after it for whoever it
created it for: it may see that community, manage its API tokens, and manage who has access to it - but only through
the grants it manages, never its configuration. A system admin can give a client that role in an existing community
by adding it to the client's `grants`.

A client manages grants as a whole: `PUT /management/communities/{slug}/managed-grants` with every grant it wants
there replaces the grants it manages, granting, changing and revoking to match, and leaves every other grant be. A
grant may name the person's account (`issuer` and `subject`), so it is theirs from the start rather than from their
first login; the client is trusted to say whose account goes with an email. Someone with a grant there the client
doesn't manage, or whose email is bound to another account than the one given, is left as they are and reported back
as `skipped`. People see a managed grant in the console, but can't change or revoke it: only its client does.

### Which types communities may configure

System admins restrict which types each community may use. A type belongs to a group: a module type (`module`), a
kind of resource holding one type of value (`resource`, such as `tariff`), or a member of the family a kind of
resource holds (named after that kind: `source`, such as `entsoe_day_ahead`, or `member_source`, such as
`demo_members`). Each type is available by default or
not, and its exceptions are the communities for which the opposite holds; a type that isn't listed is available
everywhere. They are kept in `access/allowed.yaml` in the data directory, apart from the community configs, as they
are not the community's to change:

```yaml
module:
  directive:
    default: false
    exceptions: [demo]
source:
  entsoe_day_ahead:
    default: true
    exceptions: [acme]
```

- `/management/allowed-types` lists every type with its availability, and a `PUT` of
  `/management/allowed-types/{group}/{type}` replaces one.
- `/management/communities/{slug}/allowed-types` lists every type with whether that community may use it, and a
  `PUT` of `.../allowed-types/{group}/{type}` with `{"allowed": ...}` allows one to it or not, keeping its default:
  the community becomes an exception to it, or no longer is one.
- `/management/communities/{slug}/catalog/modules` and `.../catalog/resources` list the module types and resource
  kinds a community may configure, to whoever may see its modules or resources. In their JSON Schemas, a type it may
  not use is one nothing is valid against (`{"not": {}}`), wherever it is nested; the console offers no such branch of
  a union, and explains a field nothing fits. A resource kind is listed while one of the types it holds may be used.
- A type a community may not use can't be given anywhere: not as a module, not in a resource, and not inline in a
  module or resource either. What it already has keeps running, but can only be deleted - or, for a resource, still
  be referenced.

Deleting a community drops it from every type's exceptions.

### EnergyID

EnergyID's identity server is a Duende IdentityServer, configured in its database. The
management API needs a client there with:

- a client secret, the `authorization_code` grant, PKCE required and consent off;
- the redirect URI `https://<host>/auth/callback`, and `https://<host>/` as post-logout redirect URI;
- the scopes `openid`, `profile` and `email`, with the `email` identity resource present.

Each such client counts towards the clients the Duende license allows.

For development, `task dev-idp` runs a local provider built on Duende as well - see
[apps/demo_multitenant](../../apps/demo_multitenant).

## Development

```sh
uv sync --group dev
poe run
```

Common commands:

```sh
poe test
poe lint
poe format
poe check
```
